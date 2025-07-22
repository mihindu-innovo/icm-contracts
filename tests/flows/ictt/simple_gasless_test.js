const { ethers } = require('ethers');
const axios = require('axios');

/**
 * Simple gasless test that matches the exact format from the sample
 */
async function simpleGaslessTest() {
    console.log('=== Simple Gasless Test ===\n');

    try {
        // Configuration
        const config = {
            avaCloudRpcUrl: 'https://gas-relayer.avax.network/innovomark/testnet/rpc',
            avaCloudAuth: {
                username: 'innovomark_testnet',
                password: 'PVY8wZa10O9nrP3mfB'
            },
            avaCloudDomain: 'innovomark',
            avaCloudVersion: '1',
            avaCloudRequestType: 'Message',
            avaCloudRequestSuffix: 'EMYIVHVJOTQUBEJLHAJCZLQ',
            avaCloudForwarder: '0xadb1cc52d50089a57c797685ea085e5cd2642c82'
        };

        // Initialize provider
        const provider = new ethers.providers.JsonRpcProvider('https://subnets.avax.network/innovomark/testnet/rpc');
        
        // Import wallet
        const privateKey = process.env.PRIVATE_KEY || '0x8a22131111b07684e5df85ef89ffd5350ce106115207c818a3bba12470744eb4';
        const wallet = new ethers.Wallet(privateKey, provider);
        console.log(`Wallet address: ${wallet.address}`);

        // Get network info
        const network = await provider.getNetwork();
        console.log(`Network chain ID: ${network.chainId}`);

        // Create EIP-712 message exactly like the sample
        const domain = {
            name: config.avaCloudDomain,
            version: config.avaCloudVersion,
            chainId: network.chainId,
            verifyingContract: config.avaCloudForwarder
        };

        const types = {
            ForwardRequest: [
                { name: 'from', type: 'address' },
                { name: 'to', type: 'address' },
                { name: 'value', type: 'uint256' },
                { name: 'gas', type: 'uint256' },
                { name: 'nonce', type: 'uint256' },
                { name: 'data', type: 'bytes' },
                { name: 'validUntilTime', type: 'uint256' },
                { name: config.avaCloudRequestSuffix, type: 'bytes32' }
            ]
        };

        // Create a simple test message with proper data encoding
        const message = {
            from: wallet.address,
            to: '0x65FE9B6E41BACc5F287DE88C1490c3933B77d511', // ERC20Remote address
            value: ethers.constants.Zero.toHexString(),
            gas: ethers.BigNumber.from('21000').toHexString(),
            nonce: 0,
            data: ethers.utils.hexlify('0x'), // Properly encoded empty data
            validUntilTime: ethers.constants.MaxUint256.toHexString(),
            [config.avaCloudRequestSuffix]: ethers.utils.hexZeroPad(Buffer.from(config.avaCloudRequestSuffix, 'utf8'), 32)
        };

        console.log('Creating EIP-712 signature...');
        const signature = await wallet._signTypedData(domain, types, message);
        console.log(`Signature created: ${signature.substring(0, 20)}...`);

        // Create relay request exactly like the sample
        const relayRequest = {
            forwardRequest: {
                domain,
                types,
                message
            },
            metadata: {
                signature: signature.substring(2)
            }
        };

        console.log('Submitting to relayer...');
        console.log('Relay request structure:', JSON.stringify(relayRequest, null, 2));
        
        // Convert to hex string and send in JSON-RPC format
        const rawTx = '0x' + Buffer.from(JSON.stringify(relayRequest)).toString('hex');
        
        const requestBody = {
            id: 1,
            jsonrpc: '2.0',
            method: 'eth_sendRawTransaction',
            params: [rawTx]
        };
        
        const response = await axios.post(config.avaCloudRpcUrl, requestBody, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${Buffer.from(`${config.avaCloudAuth.username}:${config.avaCloudAuth.password}`).toString('base64')}`
            }
        });

        console.log('Response:', response.data);

        if (response.data.error) {
            console.error('Relayer error:', response.data.error);
        } else {
            console.log('Success! Transaction hash:', response.data.result);
        }

    } catch (error) {
        console.error('Test failed:', error.response?.data || error.message);
    }
}

// Run test
simpleGaslessTest().catch(console.error); 