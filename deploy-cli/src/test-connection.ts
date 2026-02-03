/**
 * Network Connectivity Test for Midnight DEX Contract
 * Tests connectivity to indexer, proof server, and RPC node
 */
import { PreviewConfig } from './config.js';
import fetch from 'node-fetch';

const config = new PreviewConfig();

interface TestResult {
    name: string;
    url: string;
    status: 'SUCCESS' | 'FAILED';
    message: string;
    responseTime?: number;
}

const results: TestResult[] = [];

async function testHttpEndpoint(name: string, url: string, options: { method?: string; body?: string; headers?: Record<string, string> } = {}): Promise<TestResult> {
    const startTime = Date.now();
    try {
        const response = await fetch(url, {
            method: options.method || 'GET',
            headers: options.headers || {},
            body: options.body,
            signal: AbortSignal.timeout(10000), // 10 second timeout
        });
        const responseTime = Date.now() - startTime;

        if (response.ok || response.status === 400) {
            // 400 is OK for GraphQL endpoint without valid query
            return {
                name,
                url,
                status: 'SUCCESS',
                message: `Connected successfully (HTTP ${response.status})`,
                responseTime,
            };
        } else {
            return {
                name,
                url,
                status: 'FAILED',
                message: `HTTP ${response.status}: ${response.statusText}`,
                responseTime,
            };
        }
    } catch (error: any) {
        const responseTime = Date.now() - startTime;
        return {
            name,
            url,
            status: 'FAILED',
            message: `Connection failed: ${error.message}`,
            responseTime,
        };
    }
}

async function testWebSocket(name: string, url: string): Promise<TestResult> {
    const startTime = Date.now();
    try {
        // For WebSocket, we'll use fetch with HTTP variant for basic connectivity
        const httpUrl = url.replace('wss://', 'https://').replace('ws://', 'http://');
        const response = await fetch(httpUrl, {
            signal: AbortSignal.timeout(10000),
        });
        const responseTime = Date.now() - startTime;

        return {
            name,
            url,
            status: 'SUCCESS',
            message: `WebSocket endpoint is reachable (HTTP ${response.status})`,
            responseTime,
        };
    } catch (error: any) {
        const responseTime = Date.now() - startTime;
        return {
            name,
            url,
            status: 'FAILED',
            message: `Connection failed: ${error.message}`,
            responseTime,
        };
    }
}

async function runTests() {
    console.log('========================================');
    console.log('Midnight Network Connectivity Test');
    console.log('========================================\n');

    console.log('Configuration:');
    console.log(`  Network ID: ${config.networkId}`);
    console.log(`  Indexer: ${config.indexer}`);
    console.log(`  Indexer WS: ${config.indexerWS}`);
    console.log(`  Node: ${config.node}`);
    console.log(`  Proof Server: ${config.proofServer}\n`);

    console.log('Running connectivity tests...\n');

    // Test Indexer HTTP endpoint
    results.push(
        await testHttpEndpoint(
            'Indexer (HTTP)',
            config.indexer,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: '{ __typename }' }),
            }
        )
    );

    // Test Indexer WebSocket endpoint (via HTTP probe)
    results.push(await testWebSocket('Indexer (WebSocket)', config.indexerWS));

    // Test RPC Node (via HTTP probe)
    results.push(await testWebSocket('RPC Node', config.node));

    // Test Proof Server
    results.push(await testHttpEndpoint('Proof Server (Health)', `${config.proofServer}/health`));
    results.push(await testHttpEndpoint('Proof Server (Check)', `${config.proofServer}/check`));

    // Print results
    console.log('========================================');
    console.log('Test Results:');
    console.log('========================================\n');

    let allPassed = true;
    results.forEach((result) => {
        const statusIcon = result.status === 'SUCCESS' ? '✅' : '❌';
        const timeStr = result.responseTime !== undefined ? ` (${result.responseTime}ms)` : '';
        console.log(`${statusIcon} ${result.name}${timeStr}`);
        console.log(`   URL: ${result.url}`);
        console.log(`   ${result.message}\n`);
        if (result.status === 'FAILED') {
            allPassed = false;
        }
    });

    console.log('========================================');
    if (allPassed) {
        console.log('✅ All connectivity tests passed!');
        console.log('\nIf wallet sync is still failing, the issue may be:');
        console.log('  - Network firewall blocking WebSocket connections');
        console.log('  - Wallet mnemonic/keys issue');
        console.log('  - Wallet database corruption (try deleting .level-db folders)');
    } else {
        console.log('❌ Some connectivity tests failed!');
        console.log('\nPlease check:');
        console.log('  1. Internet connection');
        console.log('  2. Firewall settings');
        console.log('  3. If using local network: ensure services are running');
        console.log('  4. VPN or proxy configuration');
    }
    console.log('========================================');

    process.exit(allPassed ? 0 : 1);
}

runTests().catch((error) => {
    console.error('Test runner failed:', error);
    process.exit(1);
});
