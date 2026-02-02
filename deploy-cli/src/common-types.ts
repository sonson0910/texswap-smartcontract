import type {
    Contract as BaseContract,
    DeployedContract,
    PrivateStateProvider,
    PublicDataProvider,
    MidnightProvider,
    WalletProvider,
    ZkConfigProvider,
    ProofProvider,
} from '@midnight-ntwrk/midnight-js-types';

// Import the FaucetAMM contract types
import type { Contract, Witnesses } from '../../dist/faucet-amm/contract/index.js';

// Circuit names for FaucetAMM contract
export type FaucetAMMCircuits =
    | 'mintTestTokensX'
    | 'mintTestTokensY'
    | 'initLiquidity'
    | 'addLiquidity'
    | 'removeLiquidity'
    | 'swapXToY'
    | 'swapYToX';

export type FaucetAMMPrivateStateId = 'faucet_amm_private_state';

export type FaucetAMMContract = Contract<unknown, Witnesses>;

export type DeployedFaucetAMMContract = DeployedContract<
    FaucetAMMPrivateStateId,
    FaucetAMMContract,
    undefined
>;

export type FaucetAMMProviders = {
    privateStateProvider: PrivateStateProvider<typeof FaucetAMMPrivateStateId>;
    publicDataProvider: PublicDataProvider;
    zkConfigProvider: ZkConfigProvider<FaucetAMMCircuits>;
    proofProvider: ProofProvider<FaucetAMMCircuits>;
    walletProvider: WalletProvider;
    midnightProvider: MidnightProvider;
};
