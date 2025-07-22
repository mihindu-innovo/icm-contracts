const { GaslessBridgeClient } = require('./gasless_bridge_client');
const { ethers } = require('ethers');

/**
 * Example usage of the GaslessBridgeClient
 * This script demonstrates how to use the gasless bridge functionality
 */

async function exampleUsage() {
    console.log('=== Gasless Bridge Example Usage ===\n');

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

        // Import wallet from private key (use environment variable in production)
        const privateKey = process.env.PRIVATE_KEY || '0x8a22131111b07684e5df85ef89ffd5350ce106115207c818a3bba12470744eb4';
        const homeWallet = client.importWallet(privateKey, 'home');
        console.log(`✓ Home wallet imported: ${homeWallet.address}`);

        // Initialize contracts for home network
        const homeContracts = client.initializeContracts(homeWallet, 'home');
        console.log('✓ Home contracts initialized');

        // Example: Check token balance
        const { erc20Token } = homeContracts;
        const balance = await erc20Token.balanceOf(homeWallet.address);
        console.log(`✓ Token balance: ${ethers.utils.formatUnits(balance, 6)} USDC`);

        // Example: Transfer 0.1 USDC from Chain to Innovo (user pays gas)
        const transferAmount = ethers.utils.parseUnits('0.1', 6);
        const recipient = homeWallet.address; // Send to self for example

        console.log('\n--- Example 1: Chain to Innovo (User pays gas) ---');
        
        // Step 1: Approve tokens
        console.log('1. Approving tokens...');
        const approveTx = await erc20Token.approve(config.erc20HomeAddress, transferAmount);
        await approveTx.wait();
        console.log('   ✓ Approval successful');

        // Step 2: Send tokens
        console.log('2. Sending tokens to Innovo...');
        const sendInput = {
            destinationBlockchainID: config.innovomarkBlockchainID,
            destinationTokenTransferrerAddress: config.erc20RemoteAddress,
            recipient: recipient,
            primaryFeeTokenAddress: config.erc20TokenAddress,
            primaryFee: ethers.constants.Zero,
            secondaryFee: ethers.constants.Zero,
            requiredGasLimit: 200000,
            multiHopFallback: ethers.constants.AddressZero
        };

        const { erc20Home } = homeContracts;
        const sendTx = await erc20Home.send(sendInput, transferAmount);
        const sendReceipt = await sendTx.wait();
        console.log(`   ✓ Send successful: ${sendReceipt.transactionHash}`);

        // Example: Create gasless approval (without submitting)
        console.log('\n--- Example 2: Create Gasless Approval ---');
        
        console.log('1. Creating gasless approval signature...');
        const approvalData = await client.createGaslessApproval(
            homeWallet,
            config.erc20RemoteAddress,
            transferAmount,
            'remote'
        );
        console.log('   ✓ Gasless approval signature created');
        console.log(`   Signature: ${approvalData.metadata.signature.substring(0, 20)}...`);

        // Example: Create gasless send (without submitting)
        console.log('\n--- Example 3: Create Gasless Send ---');
        
        console.log('1. Creating gasless send signature...');
        const sendInputRemote = {
            destinationBlockchainID: config.cChainBlockchainID,
            destinationTokenTransferrerAddress: config.erc20HomeAddress,
            recipient: recipient,
            primaryFeeTokenAddress: config.erc20RemoteAddress,
            primaryFee: ethers.constants.Zero,
            secondaryFee: ethers.constants.Zero,
            requiredGasLimit: 200000,
            multiHopFallback: ethers.constants.AddressZero
        };

        const sendData = await client.createGaslessSend(
            homeWallet,
            config.erc20RemoteAddress,
            sendInputRemote,
            transferAmount,
            'remote'
        );
        console.log('   ✓ Gasless send signature created');
        console.log(`   Signature: ${sendData.metadata.signature.substring(0, 20)}...`);

        // Example: Submit gasless transaction (commented out for safety)
        console.log('\n--- Example 4: Submit Gasless Transaction (Commented) ---');
        console.log('// Uncomment the following lines to actually submit gasless transactions:');
        console.log('// const receipt = await client.submitGaslessTransaction(approvalData);');
        console.log('// console.log(`Transaction submitted: ${receipt.transactionHash}`);');

        console.log('\n=== Example Usage Completed Successfully ===');
        console.log('\nTo run the full test with actual gasless transactions:');
        console.log('1. Set your private key: export PRIVATE_KEY="your_private_key"');
        console.log('2. Run: node gasless_bridge_client.js');

    } catch (error) {
        console.error('Example failed:', error.message);
        process.exit(1);
    }
}

// Run example if this file is executed directly
if (require.main === module) {
    exampleUsage().catch(console.error);
}

module.exports = { exampleUsage }; 