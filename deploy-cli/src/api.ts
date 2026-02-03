import { type Logger } from 'pino';
import * as Rx from 'rxjs';
import { WebSocket } from 'ws';
import * as bip39 from '@scure/bip39';
import { wordlist as english } from '@scure/bip39/wordlists/english.js';

import {
    type FaucetAMMProviders,
    type DeployedFaucetAMMContract,
    type FaucetAMMCircuits,
} from './common-types.js';
import { type Config, contractConfig } from './config.js';

// Import the FaucetAMMUnshielded contract and wrap with CompiledContract API
// Use namespace import since module has no default export
// IMPORTANT: Import from local dist/ (not root build/) to use same node_modules
import * as FaucetAMMContractModule from '../dist/faucet-amm-unshielded/contract/index.js';
const Contract = FaucetAMMContractModule.Contract;
const ledger = FaucetAMMContractModule.ledger;

import { type ContractAddress } from '@midnight-ntwrk/compact-runtime';
import * as CompiledContract from '@midnight-ntwrk/compact-js/effect/CompiledContract';
import * as mnLedger from '@midnight-ntwrk/ledger-v7';

import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { assertIsContractAddress } from '@midnight-ntwrk/midnight-js-utils';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import {
    type FinalizedTxData,
    type MidnightProvider,
    type WalletProvider,
    type UnboundTransaction,
} from '@midnight-ntwrk/midnight-js-types';

import {
    createKeystore,
    InMemoryTransactionHistoryStorage,
    PublicKey as UnshieldedPublicKey,
    type UnshieldedKeystore,
    UnshieldedWallet,
} from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import { ShieldedWallet } from '@midnight-ntwrk/wallet-sdk-shielded';
import { DustWallet } from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import { HDWallet, Roles } from '@midnight-ntwrk/wallet-sdk-hd';

let logger: Logger;

// @ts-expect-error: It's needed to enable WebSocket usage through apollo
globalThis.WebSocket = WebSocket;

export function setLogger(_logger: Logger) {
    logger = _logger;
}

// Types for wallet context
export interface WalletContext {
    wallet: WalletFacade;
    shieldedSecretKeys: mnLedger.ZswapSecretKeys;
    dustSecretKey: mnLedger.DustSecretKey;
    unshieldedKeystore: UnshieldedKeystore;
}

// FaucetAMMUnshielded CompiledContract instance wrapped for compact-js@2.4.0
export const faucetAMMContractInstance = CompiledContract.withCompiledFileAssets(
    CompiledContract.withVacantWitnesses(
        CompiledContract.make('FaucetAMMUnshielded', Contract)
    ),
    './dist/faucet-amm-unshielded'
);

export const getLedgerState = async (
    providers: FaucetAMMProviders,
    contractAddress: ContractAddress,
): Promise<{ feeBps: bigint; xLiquidity: bigint; yLiquidity: bigint; lpCirculatingSupply: bigint } | null> => {
    assertIsContractAddress(contractAddress);
    logger.info('Checking contract ledger state...');
    const state = await providers.publicDataProvider
        .queryContractState(contractAddress)
        .then((contractState) => {
            if (contractState != null) {
                const l = ledger(contractState.data);
                return {
                    feeBps: l.feeBps,
                    xLiquidity: l.xLiquidity,
                    yLiquidity: l.yLiquidity,
                    lpCirculatingSupply: l.lpCirculatingSupply,
                };
            }
            return null;
        });
    if (state) {
        logger.info({
            section: 'Ledger State',
            feeBps: state.feeBps.toString(),
            xLiquidity: state.xLiquidity.toString(),
            yLiquidity: state.yLiquidity.toString(),
            lpCirculatingSupply: state.lpCirculatingSupply.toString(),
        });
    }
    return state;
};

export const joinContract = async (
    providers: FaucetAMMProviders,
    contractAddress: string,
): Promise<DeployedFaucetAMMContract> => {
    // FaucetAMM is Contract<undefined> - no private state needed
    // Don't use privateStateId as SDK will try to load non-existent state
    const contract = await findDeployedContract(providers, {
        contractAddress,
        compiledContract: faucetAMMContractInstance as any,
    });
    logger.info(`Joined contract at address: ${contract.deployTxData.public.contractAddress}`);
    return contract as DeployedFaucetAMMContract;
};

// Alias for interact CLI
export const findContract = joinContract;

export const deploy = async (
    providers: FaucetAMMProviders,
    feeBps: bigint = 10n,
): Promise<DeployedFaucetAMMContract> => {
    logger.info(`Deploying FaucetAMMUnshielded contract with feeBps = ${feeBps}...`);
    const contract = await deployContract(providers, {
        compiledContract: faucetAMMContractInstance as any,
        privateStateId: 'faucet_amm_unshielded_private_state',
        initialPrivateState: undefined,
        args: [feeBps],
    });
    logger.info(`Deployed at: ${contract.deployTxData.public.contractAddress}`);
    return contract as DeployedFaucetAMMContract;
};

export const displayLedgerState = async (
    providers: FaucetAMMProviders,
    contract: DeployedFaucetAMMContract,
): Promise<{ state: Awaited<ReturnType<typeof getLedgerState>>; contractAddress: string }> => {
    const contractAddress = contract.deployTxData.public.contractAddress;
    const state = await getLedgerState(providers, contractAddress);
    if (state === null) {
        logger.info(`There is no FaucetAMM contract deployed at ${contractAddress}.`);
    } else {
        logger.info(`Current state - feeBps: ${state.feeBps}, xLiquidity: ${state.xLiquidity}, yLiquidity: ${state.yLiquidity}`);
    }
    return { contractAddress, state };
};

export const createWalletAndMidnightProvider = async (
    walletContext: WalletContext,
): Promise<WalletProvider & MidnightProvider> => {
    const state = await Rx.firstValueFrom(walletContext.wallet.state().pipe(Rx.filter((s) => s.isSynced)));
    logger.info({
        section: 'DUST Wallet State',
        dust: state.dust,
    });
    logger.info({
        section: 'Shielded Wallet State',
        shielded: state.shielded,
    });
    logger.info({
        section: 'Unshielded Wallet State',
        unshielded: state.unshielded,
    });
    return {
        getCoinPublicKey(): mnLedger.CoinPublicKey {
            return walletContext.shieldedSecretKeys.coinPublicKey as unknown as mnLedger.CoinPublicKey;
        },
        getEncryptionPublicKey(): mnLedger.EncPublicKey {
            return walletContext.shieldedSecretKeys.encryptionPublicKey as unknown as mnLedger.EncPublicKey;
        },
        async balanceTx(
            tx: UnboundTransaction,
            ttl?: Date,
        ): Promise<mnLedger.FinalizedTransaction> {
            const txTtl = ttl ?? new Date(Date.now() + 30 * 60 * 1000); // 30 min default TTL
            const secretKeys = {
                shieldedSecretKeys: walletContext.shieldedSecretKeys,
                dustSecretKey: walletContext.dustSecretKey,
            };
            try {
                logger.info('DEBUG balanceTx: Starting balanceUnboundTransaction...');
                // Use balanceUnboundTransaction for proven/unbound transactions
                // Skip shielded balancing (which requires proving) since we only need dust/fee
                const recipe = await walletContext.wallet.balanceUnboundTransaction(
                    tx as any,
                    secretKeys as any,
                    { ttl: txTtl, tokenKindsToBalance: ['dust', 'unshielded'] },
                );
                logger.info(`DEBUG balanceTx: Recipe type = ${recipe.type}, has balancingTx = ${!!recipe.balancingTransaction}`);
                // Finalize the recipe to get FinalizedTransaction
                logger.info('DEBUG balanceTx: Starting finalizeRecipe...');
                const finalizedTx = await walletContext.wallet.finalizeRecipe(recipe);
                logger.info('DEBUG balanceTx: finalizeRecipe succeeded');
                return finalizedTx as mnLedger.FinalizedTransaction;
            } catch (error: any) {
                logger.error(`DEBUG balanceTx error: ${error.message}`);
                logger.error(`DEBUG balanceTx error stack: ${error.stack}`);
                if (error.cause) {
                    logger.error(`DEBUG balanceTx error cause: ${JSON.stringify(error.cause, null, 2)}`);
                }
                throw error;
            }
        },
        async submitTx(tx: mnLedger.FinalizedTransaction): Promise<mnLedger.TransactionId> {
            return await walletContext.wallet.submitTransaction(tx);
        },
    };
};

export const waitForSync = (wallet: WalletFacade) =>
    Rx.firstValueFrom(
        wallet.state().pipe(
            Rx.throttleTime(5_000),
            Rx.tap((state) => {
                logger.info(`Waiting for wallet sync. Synced: ${state.isSynced}`);
            }),
            Rx.filter((state) => state.isSynced),
        ),
    );

export const waitForFunds = (wallet: WalletFacade) =>
    Rx.firstValueFrom(
        wallet.state().pipe(
            Rx.throttleTime(10_000),
            Rx.tap((state) => {
                const unshielded = state.unshielded?.balances[mnLedger.nativeToken().raw] ?? 0n;
                const shielded = state.shielded?.balances[mnLedger.nativeToken().raw] ?? 0n;
                logger.info(`Waiting for funds. Synced: ${state.isSynced}, Unshielded: ${unshielded}, Shielded: ${shielded}`);
            }),
            Rx.filter((state) => state.isSynced),
            Rx.map(
                (s) =>
                    (s.unshielded?.balances[mnLedger.nativeToken().raw] ?? 0n) +
                    (s.shielded?.balances[mnLedger.nativeToken().raw] ?? 0n),
            ),
            Rx.filter((balance) => balance > 0n),
        ),
    );

export const displayWalletBalances = async (
    wallet: WalletFacade,
): Promise<{ unshielded: bigint; shielded: bigint; total: bigint }> => {
    const state = await Rx.firstValueFrom(wallet.state());
    const unshielded = state.unshielded?.balances[mnLedger.nativeToken().raw] ?? 0n;
    const shielded = state.shielded?.balances[mnLedger.nativeToken().raw] ?? 0n;
    const total = unshielded + shielded;

    logger.info(`Unshielded balance: ${unshielded} tSTAR`);
    logger.info(`Shielded balance: ${shielded} tSTAR`);
    logger.info(`Total balance: ${total} tSTAR`);

    return { unshielded, shielded, total };
};

export const registerNightForDust = async (walletContext: WalletContext): Promise<boolean> => {
    const state = await Rx.firstValueFrom(walletContext.wallet.state().pipe(Rx.filter((s) => s.isSynced)));

    // Get available coins using wallet-sdk@1.0.0 API via capabilities
    const availableCoins = state.unshielded?.capabilities?.coinsAndBalances?.getAvailableCoins?.(state.unshielded?.state) ?? [];

    logger.info({
        section: 'DUST Registration Debug',
        availableCoinsCount: availableCoins.length,
        dustBalance: state.dust?.walletBalance(new Date()) ?? 0n,
        coinsMeta: availableCoins.map((c: any) => ({
            registeredForDustGeneration: c.meta?.registeredForDustGeneration,
            hasMetaField: !!c.meta
        })),
    });

    const unregisteredNightUtxos = availableCoins.filter(
        (coin: any) => coin.meta?.registeredForDustGeneration === false
    );

    if (unregisteredNightUtxos.length === 0) {
        logger.info('All Night UTXOs are already registered for dust generation');
        const dustBalance = state.dust?.walletBalance(new Date()) ?? 0n;
        logger.info(`Current dust balance: ${dustBalance}`);

        if (dustBalance > 0n) {
            return true;
        }

        // Wait for dust to be generated from registered UTXOs
        if (availableCoins.length > 0) {
            logger.info('Waiting for dust to be generated from registered UTXOs...');
            await Rx.firstValueFrom(
                walletContext.wallet.state().pipe(
                    Rx.throttleTime(5_000),
                    Rx.tap((s) => {
                        const currentDust = s.dust?.walletBalance(new Date()) ?? 0n;
                        logger.info(`Waiting for dust. Current balance: ${currentDust}`);
                    }),
                    Rx.filter((s) => (s.dust?.walletBalance(new Date()) ?? 0n) > 0n),
                    Rx.timeout(60_000), // 60 second timeout
                ),
            ).catch(() => {
                logger.warn('Timed out waiting for dust generation. Proceeding anyway...');
            });
            const finalDustBalance = (await Rx.firstValueFrom(walletContext.wallet.state())).dust?.walletBalance(new Date()) ?? 0n;
            logger.info(`Final dust balance: ${finalDustBalance}`);
            return finalDustBalance > 0n;
        }

        return false;
    }

    logger.info(`Found ${unregisteredNightUtxos.length} unshielded Night UTXOs not registered for dust generation`);
    logger.info('Registering Night UTXOs for dust generation...');

    try {
        const recipe = await walletContext.wallet.registerNightUtxosForDustGeneration(
            unregisteredNightUtxos,
            walletContext.unshieldedKeystore.getPublicKey(),
            (payload) => walletContext.unshieldedKeystore.signData(payload)
        );

        logger.info('Finalizing dust registration transaction...');
        // recipe has shape { type: 'UNPROVEN_TRANSACTION', transaction: ... }
        // Need to pass the transaction, not the whole recipe
        const finalizedTx = await walletContext.wallet.finalizeTransaction(recipe.transaction);

        logger.info('Submitting dust registration transaction...');
        const txId = await walletContext.wallet.submitTransaction(finalizedTx);
        logger.info(`Dust registration submitted with tx id: ${txId}`);

        logger.info('Waiting for dust to be generated...');
        await Rx.firstValueFrom(
            walletContext.wallet.state().pipe(
                Rx.throttleTime(5_000),
                Rx.tap((s) => {
                    const dustBalance = s.dust?.walletBalance(new Date()) ?? 0n;
                    logger.info(`Dust balance: ${dustBalance}`);
                }),
                Rx.filter((s) => (s.dust?.walletBalance(new Date()) ?? 0n) > 0n),
            ),
        );

        logger.info('Dust registration complete!');
        return true;
    } catch (e) {
        logger.error(`Failed to register Night UTXOs for dust: ${e}`);
        return false;
    }
};

const mnemonicToSeed = async (mnemonic: string): Promise<Buffer> => {
    const seed = await bip39.mnemonicToSeed(mnemonic);
    return Buffer.from(seed);
};

export const initWalletWithSeed = async (
    seed: Buffer,
    config: Config,
): Promise<WalletContext> => {
    const hdWallet = HDWallet.fromSeed(seed);

    if (hdWallet.type !== 'seedOk') {
        throw new Error('Failed to initialize HDWallet');
    }

    const derivationResult = hdWallet.hdWallet
        .selectAccount(0)
        .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust])
        .deriveKeysAt(0);

    if (derivationResult.type !== 'keysDerived') {
        throw new Error('Failed to derive keys');
    }

    hdWallet.hdWallet.clear();

    const shieldedSecretKeys = mnLedger.ZswapSecretKeys.fromSeed(derivationResult.keys[Roles.Zswap]);
    const dustSecretKey = mnLedger.DustSecretKey.fromSeed(derivationResult.keys[Roles.Dust]);
    // @ts-expect-error - networkId type mismatch
    const unshieldedKeystore = createKeystore(derivationResult.keys[Roles.NightExternal], config.networkId);

    // @ts-expect-error - config type mismatch
    const walletConfiguration = {
        networkId: config.networkId,
        costParameters: {
            additionalFeeOverhead: 300_000_000_000_000n,
            feeBlocksMargin: 5,
        },
        relayURL: new URL(config.node),
        provingServerUrl: new URL(config.proofServer),
        indexerClientConnection: {
            indexerHttpUrl: config.indexer,
            indexerWsUrl: config.indexerWS,
        },
        indexerUrl: config.indexerWS,
    };

    const shieldedWallet = ShieldedWallet(walletConfiguration).startWithSecretKeys(shieldedSecretKeys);
    const dustWallet = DustWallet(walletConfiguration).startWithSecretKey(
        dustSecretKey,
        mnLedger.LedgerParameters.initialParameters().dust,
    );
    const unshieldedWallet = UnshieldedWallet({
        ...walletConfiguration,
        txHistoryStorage: new InMemoryTransactionHistoryStorage(),
    }).startWithPublicKey(UnshieldedPublicKey.fromKeyStore(unshieldedKeystore));

    const facade: WalletFacade = new WalletFacade(shieldedWallet, unshieldedWallet, dustWallet);
    await facade.start(shieldedSecretKeys, dustSecretKey);

    return { wallet: facade, shieldedSecretKeys, dustSecretKey, unshieldedKeystore };
};

export const buildWalletAndWaitForFunds = async (
    config: Config,
    mnemonic: string,
): Promise<WalletContext> => {
    logger.info('Building wallet from mnemonic...');

    const seed = await mnemonicToSeed(mnemonic);
    const walletContext = await initWalletWithSeed(seed, config);

    logger.info(`Your wallet address: ${walletContext.unshieldedKeystore.getBech32Address().asString()}`);

    logger.info('Waiting for wallet to sync...');
    await waitForSync(walletContext.wallet);

    logger.info('DEBUG: Wallet synced, checking balances...');
    const { total } = await displayWalletBalances(walletContext.wallet);
    logger.info(`DEBUG: Total balance: ${total}`);

    if (total === 0n) {
        logger.info('Waiting to receive tokens...');
        await waitForFunds(walletContext.wallet);
        await displayWalletBalances(walletContext.wallet);
    }

    logger.info('DEBUG: Starting dust registration...');
    await registerNightForDust(walletContext);
    logger.info('DEBUG: Dust registration complete.');

    return walletContext;
};

export const configureProviders = async (walletContext: WalletContext, config: Config): Promise<FaucetAMMProviders> => {
    setNetworkId(config.networkId);

    const walletAndMidnightProvider = await createWalletAndMidnightProvider(walletContext);
    return {
        privateStateProvider: levelPrivateStateProvider<'faucet_amm_private_state'>({
            privateStateStoreName: contractConfig.privateStateStoreName,
            signingKeyStoreName: 'signing-keys',
            midnightDbName: 'midnight-level-db',
            privateStoragePasswordProvider: () => '1234567890123456',
        }),
        publicDataProvider: indexerPublicDataProvider(config.indexer, config.indexerWS),
        zkConfigProvider: new NodeZkConfigProvider<FaucetAMMCircuits>(contractConfig.zkConfigPath),
        proofProvider: httpClientProofProvider<FaucetAMMCircuits>(
            config.proofServer,
            new NodeZkConfigProvider<FaucetAMMCircuits>(contractConfig.zkConfigPath)
        ),
        walletProvider: walletAndMidnightProvider,
        midnightProvider: walletAndMidnightProvider,
    };
};

export const closeWallet = async (walletContext: WalletContext): Promise<void> => {
    try {
        await walletContext.wallet.stop();
    } catch (e) {
        logger.error(`Error closing wallet: ${e}`);
    }
};
