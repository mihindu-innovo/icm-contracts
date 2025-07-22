const { GaslessBridgeClient } = require('./gasless_bridge_client');
const { ethers } = require('ethers');

async function testNetworkConnections() {
    console.log('=== Testing Network Connections ===\n');

    try {
        // Load configuration
        const config = require('./gasless_config.json');
        
        // Add blockchain IDs and RPC URLs
        config.cChainBlockchainID = '0x7fc93d85c6d62c5b2ac0b519c87010ea5294012d1e407030d6acd0021cac10d5';
        config.innovomarkBlockchainID = '0xeaa43ceb6e928c745155585de433f487399081a800080775b0fce622b113fc95';
        config.homeRpcUrl = 'https://api.avax-test.network/ext/bc/C/rpc';
        config.remoteRpcUrl = 'https://subnets.avax.network/innovomark/testnet/rpc';

        // Initialize client
        const client = new GaslessBridgeClient(config);
        console.log('✓ Client initialized');

        // Test home network connection
        console.log('\n--- Testing Home Network (C-Chain) ---');
        try {
            const homeNetwork = await client.homeProvider.getNetwork();
            console.log(`✓ Home network connected: Chain ID ${homeNetwork.chainId}`);
            
            const homeBlockNumber = await client.homeProvider.getBlockNumber();
            console.log(`✓ Home block number: ${homeBlockNumber}`);
        } catch (error) {
            console.error('✗ Home network connection failed:', error.message);
        }

        // Test remote network connection
        console.log('\n--- Testing Remote Network (Innovo) ---');
        try {
            const remoteNetwork = await client.remoteProvider.getNetwork();
            console.log(`✓ Remote network connected: Chain ID ${remoteNetwork.chainId}`);
            
            const remoteBlockNumber = await client.remoteProvider.getBlockNumber();
            console.log(`✓ Remote block number: ${remoteBlockNumber}`);
        } catch (error) {
            console.error('✗ Remote network connection failed:', error.message);
        }

        // Test relayer connection
        console.log('\n--- Testing Relayer Connection ---');
        try {
            const relayerNetwork = await client.relayerProvider.getNetwork();
            console.log(`✓ Relayer network connected: Chain ID ${relayerNetwork.chainId}`);
        } catch (error) {
            console.error('✗ Relayer network connection failed:', error.message);
        }

        // Test wallet import
        console.log('\n--- Testing Wallet Import ---');
        const privateKey = process.env.PRIVATE_KEY || '0x8a22131111b07684e5df85ef89ffd5350ce106115207c818a3bba12470744eb4';
        
        try {
            const homeWallet = client.importWallet(privateKey, 'home');
            console.log(`✓ Home wallet imported: ${homeWallet.address}`);
            
            const remoteWallet = client.importWallet(privateKey, 'remote');
            console.log(`✓ Remote wallet imported: ${remoteWallet.address}`);
        } catch (error) {
            console.error('✗ Wallet import failed:', error.message);
        }

        // Test contract initialization
        console.log('\n--- Testing Contract Initialization ---');
        try {
            const homeWallet = client.importWallet(privateKey, 'home');
            const homeContracts = client.initializeContracts(homeWallet, 'home');
            console.log('✓ Home contracts initialized');
            
            const remoteWallet = client.importWallet(privateKey, 'remote');
            const remoteContracts = client.initializeContracts(remoteWallet, 'remote');
            console.log('✓ Remote contracts initialized');
        } catch (error) {
            console.error('✗ Contract initialization failed:', error.message);
        }

        console.log('\n=== Network Connection Test Completed ===');

    } catch (error) {
        console.error('Test failed:', error.message);
        process.exit(1);
    }
}

// Run test if this file is executed directly
if (require.main === module) {
    testNetworkConnections().catch(console.error);
}

module.exports = { testNetworkConnections }; 