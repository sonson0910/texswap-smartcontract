/**
 * FaucetAMM CLI - Interact with deployed FaucetAMM contract
 * Usage: npx tsx src/interact.ts <command> [args...]
 */
import { createLogger } from './logger.js';
import { PreviewConfig } from './config.js';
import * as api from './api.js';
import 'dotenv/config';
import { randomBytes } from 'crypto';

// Deployed contract address - update this after deployment
const CONTRACT_ADDRESS = '6d61449206c9791ee78a72fb96125e706bd30042f8356697c95bfcbc4e93883f';

// Helper to convert hex string to Uint8Array for Bytes<32>
function hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
        bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
}

// Helper to generate 32-byte random nonce as Uint8Array (not Node Buffer)
function generateNonce(): Uint8Array {
    const buffer = randomBytes(32);
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.length);
}

function printUsage(logger: any) {
    logger.info(`
========================================
FaucetAMM CLI - Usage
========================================

Commands:
  status                    - Show contract state
  mint-x <amount>           - Mint Test Token X
  mint-y <amount>           - Mint Test Token Y  
  init <xAmount> <yAmount> <lpAmount>  - Initialize liquidity pool
  add <xAmount> <yAmount> <lpAmount>   - Add liquidity
  remove <lpAmount> <xOut> <yOut>      - Remove liquidity
  swap-x-to-y <xIn> <yOut>  - Swap X tokens for Y
  swap-y-to-x <yIn> <xOut>  - Swap Y tokens for X
  balance                   - Show wallet balances

Examples:
  npx tsx src/interact.ts status
  npx tsx src/interact.ts mint-x 1000000
  npx tsx src/interact.ts mint-y 1000000
  npx tsx src/interact.ts init 1000000 1000000 1000000
  npx tsx src/interact.ts swap-x-to-y 1000 990

========================================
`);
}

const run = async () => {
    const config = new PreviewConfig();
    const logger = await createLogger(config.logDir);
    api.setLogger(logger);

    const args = process.argv.slice(2);
    const command = args[0]?.toLowerCase();

    if (!command || command === 'help' || command === '--help' || command === '-h') {
        printUsage(logger);
        process.exit(0);
    }

    logger.info('========================================');
    logger.info('FaucetAMM CLI');
    logger.info('========================================');

    const mnemonic = process.env.WALLET_MNEMONIC;
    if (!mnemonic) {
        logger.error('WALLET_MNEMONIC environment variable is missing!');
        logger.info('Please create a .env file with your wallet mnemonic.');
        process.exit(1);
    }

    try {
        // 1. Initialize Wallet
        logger.info('Step 1: Initializing wallet...');
        const walletContext = await api.buildWalletAndWaitForFunds(config, mnemonic);

        // 2. Configure Providers
        logger.info('Step 2: Configuring providers...');
        const providers = await api.configureProviders(walletContext, config);

        // 3. Find deployed contract
        logger.info(`Step 3: Finding contract at ${CONTRACT_ADDRESS}...`);
        const contract = await api.findContract(providers, CONTRACT_ADDRESS);

        if (!contract) {
            throw new Error(`Contract not found at address: ${CONTRACT_ADDRESS}`);
        }

        logger.info('Contract found! Executing command...');

        // Handle commands
        switch (command) {
            case 'status': {
                await api.displayLedgerState(providers, contract);
                break;
            }

            case 'balance': {
                await api.displayWalletBalances(walletContext.wallet);
                break;
            }

            case 'mint-x': {
                const amount = BigInt(args[1] || '1000000');
                logger.info(`Minting ${amount} Unshielded Test Token X...`);

                // For unshielded tokens: Either<ContractAddress, UserAddress>
                // Use is_left=false to indicate UserAddress (right side)
                // Get wallet address - using from our wallet (seen in debug output)
                // TODO: Find proper API, for now using known address
                const addressHex = 'f6dbd732b049eb493aa3fe43f2c77103ef0f66c19af067a26280ec3fa866aeb3';
                logger.info(`Wallet addressHex: ${addressHex}`);

                const recipient = {
                    is_left: false,  // Use right side for UserAddress
                    left: { bytes: new Uint8Array(32) },  // Empty ContractAddress
                    right: { bytes: hexToBytes(addressHex) },  // UserAddress
                };

                logger.info('Debug - Arguments:');
                logger.info(`  amount: ${amount} (type: ${typeof amount})`);
                logger.info(`  recipient.is_left: ${recipient.is_left}`);
                logger.info(`  recipient.right.bytes: ${Buffer.from(recipient.right.bytes).toString('hex')}`);

                try {
                    logger.info('Contract object keys: ' + Object.keys(contract).join(', '));
                    logger.info('Contract.callTx available: ' + !!contract.callTx);
                    if (contract.callTx) {
                        logger.info('Contract.callTx keys: ' + Object.keys(contract.callTx).join(', '));
                    }

                    // Unshielded mint - no nonce needed!
                    logger.info('Now calling contract.callTx.mintTestTokensX (unshielded)...');
                    const txResult = await contract.callTx.mintTestTokensX(
                        amount,
                        recipient
                    );
                    logger.info(`Mint TX submitted: ${JSON.stringify(txResult.public, (_, v) => typeof v === 'bigint' ? v.toString() : v)}`);
                    logger.info('✅ Unshielded token minting SUCCESSFUL!');
                } catch (error: any) {
                    logger.error('Transaction failed with error:');
                    logger.error(`  Message: ${error.message}`);
                    if (error.cause) {
                        logger.error(`  Cause: ${JSON.stringify(error.cause)}`);
                    }
                    if (error.stack) {
                        logger.error(`  Stack: ${error.stack.split('\n').slice(0, 5).join('\n')}`);
                    }
                    throw error;
                }
                break;
            }

            case 'mint-y': {
                const amount = BigInt(args[1] || '1000000');
                logger.info(`Minting ${amount} Unshielded Test Token Y...`);

                // Use unshielded wallet address (right side of Either)
                const addressHex = 'f6dbd732b049eb493aa3fe43f2c77103ef0f66c19af067a26280ec3fa866aeb3';
                const recipient = {
                    is_left: false,
                    left: { bytes: new Uint8Array(32) },
                    right: { bytes: hexToBytes(addressHex) }
                };

                const txResult = await contract.callTx.mintTestTokensY(
                    amount,
                    recipient
                );
                logger.info(`Mint TX submitted: ${JSON.stringify(txResult.public, (_, v) => typeof v === 'bigint' ? v.toString() : v)}`);
                logger.info('✅ Unshielded token Y minting SUCCESSFUL!');
                break;
            }

            case 'init': {
                const xAmount = BigInt(args[1] || '1000000');
                const yAmount = BigInt(args[2] || '1000000');
                const lpAmount = BigInt(args[3] || '1000000');

                logger.info(`Initializing liquidity pool: X=${xAmount}, Y=${yAmount}, LP=${lpAmount}...`);
                // Unshielded: Either<ContractAddress, UserAddress> - is_left=false means UserAddress (right side)
                const walletAddrHex = 'f6dbd732b049eb493aa3fe43f2c77103ef0f66c19af067a26280ec3fa866aeb3';
                const recipient = { is_left: false, left: { bytes: new Uint8Array(32) }, right: { bytes: hexToBytes(walletAddrHex) } };

                const txResult = await contract.callTx.initLiquidity(
                    xAmount,
                    yAmount,
                    lpAmount,
                    recipient
                );
                logger.info(`Init liquidity TX submitted: ${JSON.stringify(txResult.public, (_, v) => typeof v === 'bigint' ? v.toString() : v)}`);
                break;
            }

            case 'add': {
                const xAmount = BigInt(args[1] || '100000');
                const yAmount = BigInt(args[2] || '100000');
                const lpAmount = BigInt(args[3] || '100000');

                logger.info(`Adding liquidity: X=${xAmount}, Y=${yAmount}, LP=${lpAmount}...`);
                const walletAddrHex = 'f6dbd732b049eb493aa3fe43f2c77103ef0f66c19af067a26280ec3fa866aeb3';
                const recipient = { is_left: false, left: { bytes: new Uint8Array(32) }, right: { bytes: hexToBytes(walletAddrHex) } };

                const txResult = await contract.callTx.addLiquidity(
                    xAmount,
                    yAmount,
                    lpAmount,
                    recipient
                );
                logger.info(`Add liquidity TX submitted: ${JSON.stringify(txResult.public, (_, v) => typeof v === 'bigint' ? v.toString() : v)}`);
                break;
            }

            case 'remove': {
                const lpAmount = BigInt(args[1] || '100000');
                const xOut = BigInt(args[2] || '100000');
                const yOut = BigInt(args[3] || '100000');

                logger.info(`Removing liquidity: LP=${lpAmount}, xOut=${xOut}, yOut=${yOut}...`);
                const walletAddrHex = 'f6dbd732b049eb493aa3fe43f2c77103ef0f66c19af067a26280ec3fa866aeb3';
                const recipient = { is_left: false, left: { bytes: new Uint8Array(32) }, right: { bytes: hexToBytes(walletAddrHex) } };

                const txResult = await contract.callTx.removeLiquidity(
                    lpAmount,
                    xOut,
                    yOut,
                    recipient
                );
                logger.info(`Remove liquidity TX submitted: ${JSON.stringify(txResult.public, (_, v) => typeof v === 'bigint' ? v.toString() : v)}`);
                break;
            }

            case 'swap-x-to-y': {
                const xIn = BigInt(args[1] || '1000');
                const yOut = BigInt(args[2] || '990');

                // Calculate fee (0.1% = 10 bps, round up)
                const feeBps = 10n;
                const xFee = (xIn * feeBps + 9999n) / 10000n;

                logger.info(`Swapping X→Y: xIn=${xIn}, xFee=${xFee}, yOut=${yOut}...`);
                const walletAddrHex = 'f6dbd732b049eb493aa3fe43f2c77103ef0f66c19af067a26280ec3fa866aeb3';
                const recipient = { is_left: false, left: { bytes: new Uint8Array(32) }, right: { bytes: hexToBytes(walletAddrHex) } };

                const txResult = await contract.callTx.swapXToY(
                    xIn,
                    xFee,
                    yOut,
                    recipient
                );
                logger.info(`Swap X→Y TX submitted: ${JSON.stringify(txResult.public, (_, v) => typeof v === 'bigint' ? v.toString() : v)}`);
                break;
            }

            case 'swap-y-to-x': {
                const yIn = BigInt(args[1] || '1000');
                const xOut = BigInt(args[2] || '990');

                // Calculate fee
                const feeBps = 10n;
                const xFee = (xOut * feeBps + 9999n) / 10000n;

                logger.info(`Swapping Y→X: yIn=${yIn}, xFee=${xFee}, xOut=${xOut}...`);
                const walletAddrHex = 'f6dbd732b049eb493aa3fe43f2c77103ef0f66c19af067a26280ec3fa866aeb3';
                const recipient = { is_left: false, left: { bytes: new Uint8Array(32) }, right: { bytes: hexToBytes(walletAddrHex) } };

                const txResult = await contract.callTx.swapYToX(
                    yIn,
                    xFee,
                    xOut,
                    recipient
                );
                logger.info(`Swap Y→X TX submitted: ${JSON.stringify(txResult.public, (_, v) => typeof v === 'bigint' ? v.toString() : v)}`);
                break;
            }

            default:
                logger.error(`Unknown command: ${command}`);
                printUsage(logger);
                process.exit(1);
        }

        logger.info('========================================');
        logger.info('Command completed successfully!');
        logger.info('========================================');

        // Close wallet gracefully
        await api.closeWallet(walletContext);

    } catch (error) {
        logger.error('Command failed:');
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
