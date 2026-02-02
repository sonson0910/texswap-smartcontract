import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const contractConfig = {
    privateStateStoreName: 'dex-private-state',
    zkConfigPath: path.resolve(__dirname, '..', '..', 'dist', 'faucet-amm-unshielded'),
};

export interface Config {
    readonly logDir: string;
    readonly indexer: string;
    readonly indexerWS: string;
    readonly node: string;
    readonly proofServer: string;
    readonly networkId: string;
}

export class PreviewConfig implements Config {
    logDir = path.resolve(__dirname, '..', 'logs', `${new Date().toISOString()}.log`);
    indexer = 'https://indexer.preview.midnight.network/api/v3/graphql';
    indexerWS = 'wss://indexer.preview.midnight.network/api/v3/graphql/ws';
    node = 'wss://rpc.preview.midnight.network';
    proofServer = 'http://127.0.0.1:6300';
    networkId = 'preview';
}

export class UndeployedConfig implements Config {
    logDir = path.resolve(__dirname, '..', 'logs', `${new Date().toISOString()}.log`);
    indexer = 'http://127.0.0.1:8088/api/v3/graphql';
    indexerWS = 'ws://127.0.0.1:8088/api/v3/graphql/ws';
    node = 'ws://127.0.0.1:9944';
    proofServer = 'http://127.0.0.1:6300';
    networkId = 'undeployed';
}

// Default config instance for Preview network
export const config: Config = new PreviewConfig();

