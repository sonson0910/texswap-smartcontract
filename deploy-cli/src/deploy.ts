import { createLogger } from './logger.js';
import { PreviewConfig } from './config.js';
import * as api from './api.js';
import 'dotenv/config';

const run = async () => {
    const config = new PreviewConfig();
    const logger = await createLogger(config.logDir);
    api.setLogger(logger);

    logger.info('========================================');
    logger.info('FaucetAMM Contract Deployment on PREVIEW NETWORK');
    logger.info('========================================');

    const mnemonic = process.env.WALLET_MNEMONIC;
    if (!mnemonic) {
        logger.error('WALLET_MNEMONIC environment variable is missing!');
        logger.info('Please create a .env file with your wallet mnemonic.');
        process.exit(1);
    }

    try {
        // 1. Initialize Wallet
        logger.info('Step 1: Initializing wallet from mnemonic...');
        const walletContext = await api.buildWalletAndWaitForFunds(config, mnemonic);

        // 2. Configure Providers
        logger.info('Step 2: Configuring providers...');
        const providers = await api.configureProviders(walletContext, config);

        // 3. Deploy Contract with feeBps = 10 (0.1%)
        logger.info('Step 3: Deploying FaucetAMM contract...');
        const deployedContract = await api.deploy(providers, 10n);
        const contractAddress = deployedContract.deployTxData.public.contractAddress;

        logger.info('========================================');
        logger.info('DEPLOYMENT SUCCESSFUL!');
        logger.info(`Contract Address: ${contractAddress}`);
        logger.info('========================================');

        // 4. Verify State
        logger.info('Step 4: Verifying contract state...');
        await api.displayLedgerState(providers, deployedContract);

        logger.info('');
        logger.info('Next steps:');
        logger.info('1. Use mintTestTokensX/Y to mint test tokens');
        logger.info('2. Use initLiquidity to initialize the pool');
        logger.info('3. Use swapXToY/swapYToX to test swaps');

        // 5. Close wallet gracefully
        await api.closeWallet(walletContext);

    } catch (error) {
        logger.error('Deployment failed:');
        if (error instanceof Error) {
            logger.error(error.message);
            logger.error(error.stack || '');
        } else {
            console.error(error);
        }
        process.exit(1);
    }
};

run();
