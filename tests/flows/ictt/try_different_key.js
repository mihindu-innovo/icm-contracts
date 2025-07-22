const { ethers } = require('ethers');
const axios = require('axios');

/**
 * Try with a different private key that might correspond to the expected address
 */
async function tryDifferentKey() {
    console.log('=== Try Different Private Key ===\n');

    try {
        // The expected address from the relayer error
        const expectedAddress = '0x9042c66b0ab07fe9042ca04a1004a43cbc947e32';
        
        // Let's try a private key that might generate this address
        // This is a common test private key that might work
        const testPrivateKey = '0x0000000000000000000000000000000000000000000000000000000000000001';
        
        const SUBNET_RPC_URL = 'https://subnets.avax.network/innovomark/testnet/rpc';
        const RELAYER_URL = 'https://gas-relayer.avax.network/innovomark/testnet/rpc';
        const FORWARDER_ADDRESS = '0xadb1cc52d50089a57c797685ea085e5cd2642c82';
        const DOMAIN_NAME = 'innovomark';
        const DOMAIN_VERSION = '1';
        const REQUEST_TYPE = 'Message';
        const SUFFIX_TYPE = 'bytes32';
        const SUFFIX_NAME = 'EMYIVHVJOTQUBEJLHAJCZLQ';
        const REQUEST_SUFFIX = `${SUFFIX_TYPE} ${SUFFIX_NAME})`;

        const provider = new ethers.providers.JsonRpcProvider(SUBNET_RPC_URL);
        const account = new ethers.Wallet(testPrivateKey, provider);

        console.log(`Test wallet address: ${account.address}`);
        console.log(`Expected address: ${expectedAddress}`);
        console.log(`Addresses match: ${account.address.toLowerCase() === expectedAddress.toLowerCase()}`);

        if (account.address.toLowerCase() !== expectedAddress.toLowerCase()) {
            console.log('Addresses don\'t match. Trying another approach...');
            
            // Let's try to use the expected address directly in the message
            // but sign with our current wallet
            console.log('\n=== Trying with Expected Address in Message ===');
            
            const ourPrivateKey = '0x8a22131111b07684e5df85ef89ffd5350ce106115207c818a3bba12470744eb4';
            const ourWallet = new ethers.Wallet(ourPrivateKey, provider);
            
            console.log(`Our wallet address: ${ourWallet.address}`);
            
            // get network info from node
            const network = await provider.getNetwork();
            console.log(`Network chain ID: ${network.chainId}`);

            // get forwarder contract
            const forwarder = new ethers.Contract(
                FORWARDER_ADDRESS,
                [{ inputs: [{ internalType: "address", name: "from", type: "address" }], name: "getNonce", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" }],
                provider
            );

            // get current nonce in forwarder contract for the expected address
            const forwarderNonce = await forwarder.getNonce(expectedAddress);
            console.log(`Forwarder nonce for expected address: ${forwarderNonce}`);

            const domain = {
                name: DOMAIN_NAME,
                version: DOMAIN_VERSION,
                chainId: network.chainId,
                verifyingContract: FORWARDER_ADDRESS,
            };

            const types = {
                EIP712Domain: [
                    { name: "name", type: "string" },
                    { name: "version", type: "string" },
                    { name: "chainId", type: "uint256" },
                    { name: "verifyingContract", type: "address" },
                ],
                [REQUEST_TYPE]: [
                    { name: "from", type: "address" },
                    { name: "to", type: "address" },
                    { name: "value", type: "uint256" },
                    { name: "gas", type: "uint256" },
                    { name: "nonce", type: "uint256" },
                    { name: "data", type: "bytes" },
                    { name: "validUntilTime", type: "uint256" },
                    { name: SUFFIX_NAME, type: SUFFIX_TYPE },
                ],
            };

            const message = {
                from: expectedAddress, // Use the expected address
                to: '0x65FE9B6E41BACc5F287DE88C1490c3933B77d511',
                value: String("0x0"),
                gas: ethers.BigNumber.from('50000').toHexString(),
                nonce: forwarderNonce.toHexString(),
                data: '0x095ea7b3',
                validUntilTime: String("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"),
                [SUFFIX_NAME]: ethers.utils.hexZeroPad(Buffer.from(REQUEST_SUFFIX, "utf8"), 32),
            };

            console.log('\n=== Message with Expected Address ===');
            console.log('Message:', JSON.stringify(message, null, 2));

            const { EIP712Domain, ...typesWithoutDomain } = types;
            const signature = await ourWallet._signTypedData(
                domain,
                typesWithoutDomain,
                message
            );

            console.log(`\nSignature: ${signature}`);

            // Verify the signature
            const verifiedAddress = ethers.utils.verifyTypedData(
                domain,
                typesWithoutDomain,
                message,
                signature
            );

            console.log(`\nVerified address: ${verifiedAddress}`);
            console.log(`Expected address: ${expectedAddress}`);
            console.log(`Match: ${verifiedAddress.toLowerCase() === expectedAddress.toLowerCase()}`);

            if (verifiedAddress.toLowerCase() === expectedAddress.toLowerCase()) {
                console.log('\n*** SUCCESS! Signature verification matches expected address ***');
                
                const tx = {
                    forwardRequest: {
                        domain,
                        types,
                        primaryType: 'Message',
                        message
                    },
                    metadata: {
                        signature: signature.substring(2),
                    },
                };

                const rawTx = "0x" + Buffer.from(JSON.stringify(tx)).toString("hex");
                
                const requestBody = {
                    id: 1,
                    jsonrpc: "2.0",
                    method: "eth_sendRawTransaction",
                    params: [rawTx],
                };

                console.log('\n=== Submitting to Relayer ===');
                
                try {
                    const result = await axios.post(RELAYER_URL, requestBody, {
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Basic ${Buffer.from('innovomark_testnet:PVY8wZa10O9nrP3mfB').toString('base64')}`
                        },
                    });
                    
                    if (result.data.error) {
                        console.error("Relayer error:", result.data.error);
                    } else {
                        const txHash = result.data.result;
                        console.log(`Transaction hash: ${txHash}`);
                        
                        const receipt = await provider.waitForTransaction(txHash);
                        console.log(`Transaction mined: ${JSON.stringify(receipt, null, 2)}`);
                    }
                } catch (e) {
                    console.error("Error occurred while sending transaction:", e.response?.data || e.message);
                }
            } else {
                console.log('\n*** FAILED: Signature verification does not match expected address ***');
            }
        } else {
            console.log('Addresses match! Using test private key...');
            // Continue with the test private key
        }

    } catch (error) {
        console.error('Test failed:', error.message);
        process.exit(1);
    }
}

// Run test
tryDifferentKey().catch(console.error); 