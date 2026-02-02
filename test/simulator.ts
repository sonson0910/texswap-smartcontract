import {
    CircuitContext,
    createConstructorContext,
    createCircuitContext,
    emptyZswapLocalState,
    EncodedShieldedCoinInfo,
    EncodedQualifiedShieldedCoinInfo,
    sampleContractAddress,
    ConstructorResult,
    StateValue
} from "@midnight-ntwrk/compact-runtime"
import { Contract, ledger } from "../dist/faucet-amm/contract/index.js"
import { type Address } from "./addresses"

const dummyCoinPublicKey = { bytes: new Uint8Array(32) }

export class Simulator {
    private contract: Contract<unknown, {}>
    readonly address: string
    private circuitContext: CircuitContext<unknown>
    private contractState: any
    private stateValue: StateValue
    lpReserves: EncodedQualifiedShieldedCoinInfo
    xReserves: EncodedQualifiedShieldedCoinInfo
    yReserves: EncodedQualifiedShieldedCoinInfo
    private xColor: Uint8Array
    private yColor: Uint8Array
    private _feeBps: bigint

    constructor(treasury: Address) {
        const fee = 10n
        this._feeBps = fee
        this.xColor = new Uint8Array(32).fill(9)
        this.yColor = new Uint8Array(32).fill(10)

        this.contract = new Contract({})

        // Create constructor context with empty private state
        const constructorCtx = createConstructorContext({}, dummyCoinPublicKey)

        // Initialize the contract
        const constructorResult: ConstructorResult = this.contract.initialState(
            constructorCtx,
            fee
        )

        this.address = sampleContractAddress()
        this.contractState = constructorResult.currentContractState

        // Get the state value for ledger queries
        this.stateValue = this.contractState.data

        // Create circuit context for subsequent calls
        this.circuitContext = createCircuitContext(
            this.address,
            dummyCoinPublicKey,
            this.contractState,
            {}
        )

        // Initialize reserves tracking
        this.lpReserves = {
            nonce: new Uint8Array(32),
            color: new Uint8Array(32), // LP token color will be determined later
            value: 0n,
            mt_index: 0n
        }

        this.xReserves = {
            nonce: new Uint8Array(32),
            color: this.xColor,
            value: 0n,
            mt_index: 0n
        }

        this.yReserves = {
            nonce: new Uint8Array(32),
            color: this.yColor,
            value: 0n,
            mt_index: 0n
        }
    }

    private getLedger() {
        return ledger(this.stateValue)
    }

    getFeeBps(): bigint {
        return this.getLedger().feeBps
    }

    getLPCirculatingSupply(): bigint {
        return this.getLedger().lpCirculatingSupply
    }

    getXColor(): Uint8Array {
        return this.xColor
    }

    getXLiquidity(): bigint {
        return this.getLedger().xLiquidity
    }

    getXRewards(): bigint {
        return this.getLedger().xRewards
    }

    getYColor(): Uint8Array {
        return this.yColor
    }

    getYLiquidity(): bigint {
        return this.getLedger().yLiquidity
    }

    private createRecipient(): Address {
        return {
            is_left: true,
            left: { bytes: new Uint8Array(32).fill(1) },
            right: { bytes: new Uint8Array(32) }
        }
    }

    initLiquidity({ xIn, yIn, lpOut }: { xIn: bigint, yIn: bigint, lpOut?: bigint }) {
        const userDefinedLPOut = !!lpOut

        lpOut = lpOut ?? BigInt(Math.round(Math.sqrt(Number(xIn) * Number(yIn))))

        if (!userDefinedLPOut) {
            while (lpOut * lpOut > xIn * yIn) {
                lpOut -= 1n
            }
        }

        const nonce = new Uint8Array(32)
        const recipient = this.createRecipient()

        const result = this.contract.circuits.initLiquidity(
            this.circuitContext,
            xIn,
            yIn,
            lpOut,
            recipient,
            nonce
        )

        this.syncCircuitContext(result.context)

        // Update reserves
        this.xReserves.value = xIn
        this.yReserves.value = yIn
    }

    addLiquidity({ xIn, yIn, lpOut }: { xIn: bigint, yIn: bigint, lpOut?: bigint }) {
        lpOut = lpOut ?? BigInt(Math.round(Math.sqrt(Number(xIn) * Number(yIn))))

        const nonce = new Uint8Array(32)
        const recipient = this.createRecipient()

        const result = this.contract.circuits.addLiquidity(
            this.circuitContext,
            xIn,
            yIn,
            lpOut,
            recipient,
            nonce
        )

        this.syncCircuitContext(result.context)

        // Update reserves
        this.xReserves.value += xIn
        this.yReserves.value += yIn
    }

    removeLiquidity({ lpIn, xOut, yOut }: { lpIn: bigint, xOut: bigint, yOut: bigint }) {
        const nonce = new Uint8Array(32)
        const recipient = this.createRecipient()

        const result = this.contract.circuits.removeLiquidity(
            this.circuitContext,
            lpIn,
            xOut,
            yOut,
            recipient,
            nonce
        )

        this.syncCircuitContext(result.context)

        // Update reserves
        this.xReserves.value -= xOut
        this.yReserves.value -= yOut
    }

    swapXToY({ xIn, xFee, yOut }: { xIn: bigint, xFee?: bigint, yOut?: bigint }) {
        xFee = xFee ?? this.calcSwapXToYFee(xIn)
        yOut = yOut ?? this.calcSwapXToYOut(xIn, xFee)

        const nonce = new Uint8Array(32)
        const recipient = this.createRecipient()

        const result = this.contract.circuits.swapXToY(
            this.circuitContext,
            xIn,
            xFee,
            yOut,
            recipient,
            nonce
        )

        this.syncCircuitContext(result.context)

        // Update reserves
        this.xReserves.value += xIn - xFee
        this.yReserves.value -= yOut
    }

    swapYToX({ yIn, xFee, xOut }: { yIn: bigint, xFee?: bigint, xOut?: bigint }) {
        xOut = xOut ?? this.calcSwapYToXOut(yIn)
        xFee = xFee ?? this.calcSwapYToXFee(xOut)

        const nonce = new Uint8Array(32)
        const recipient = this.createRecipient()

        const result = this.contract.circuits.swapYToX(
            this.circuitContext,
            yIn,
            xFee,
            xOut,
            recipient,
            nonce
        )

        this.syncCircuitContext(result.context)

        // Update reserves
        this.xReserves.value -= xOut + xFee
        this.yReserves.value += yIn
    }

    private calcSwapXToYFee(xIn: bigint): bigint {
        const feeBps = this._feeBps
        let xFee = BigInt(Math.round(Number(xIn) * Number(feeBps) / 10000))

        while (xFee * 10000n < feeBps * xIn) {
            xFee += 1n
        }

        return xFee
    }

    private calcSwapXToYOut(xIn: bigint, xFee: bigint): bigint {
        const initialK = this.xReserves.value * this.yReserves.value

        let yOut = this.yReserves.value - BigInt(Math.round(Number(initialK) / Number(this.xReserves.value + xIn - xFee)));

        while (initialK > (this.yReserves.value - yOut) * (this.xReserves.value + xIn - xFee)) {
            yOut -= 1n
        }

        return yOut
    }

    private calcSwapYToXFee(xOut: bigint): bigint {
        const feeBps = this._feeBps
        let xFee = BigInt(Math.round(Number(xOut) * Number(feeBps) / (10000 - Number(feeBps))))

        while (xFee * (10000n - feeBps) < feeBps * xOut) {
            xFee += 1n
        }

        return xFee
    }

    private calcSwapYToXOut(yIn: bigint): bigint {
        const initialK = this.xReserves.value * this.yReserves.value

        let xOutWithoutFee = this.xReserves.value - BigInt(Math.round(Number(initialK) / Number(this.yReserves.value + yIn)));

        while (initialK > (this.xReserves.value - xOutWithoutFee) * (this.yReserves.value + yIn)) {
            xOutWithoutFee -= 1n
        }

        const xFee = this.calcSwapXToYFee(xOutWithoutFee)

        return xOutWithoutFee - xFee
    }

    private syncCircuitContext(context: CircuitContext<unknown>) {
        // Update state value from the context's query context
        this.stateValue = context.currentQueryContext.state

        // Create new circuit context with updated state
        this.circuitContext = createCircuitContext(
            this.address,
            dummyCoinPublicKey,
            this.stateValue,
            {}
        )
    }
}
