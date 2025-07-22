const { ethers } = require('ethers');
const axios = require('axios');

/**
 * Try the exact working approach with our current wallet
 */
async function tryWorkingApproach() {
    console.log('=== Try Working Approach with Our Wallet ===\n');

    try {
        // Use the exact same configuration as the working example
        const SUBNET_RPC_URL = 'https://subnets.avax.network/innovomark/testnet/rpc';
        const RELAYER_URL = 'https://gas-relayer.avax.network/innovomark/testnet/rpc';
        const FORWARDER_ADDRESS = '0xadb1cc52d50089a57c797685ea085e5cd2642c82';
        const DOMAIN_NAME = 'innovomark';
        const DOMAIN_VERSION = '1';
        const REQUEST_TYPE = 'Message';
        const SUFFIX_TYPE = 'bytes32';
        const SUFFIX_NAME = 'EMYIVHVJOTQUBEJLHAJCZLQ';
        const REQUEST_SUFFIX = `${SUFFIX_TYPE} ${SUFFIX_NAME})`;

        const PRIVATE_KEY = process.env.PRIVATE_KEY || '0x8a22131111b07684e5df85ef89ffd5350ce106115207c818a3bba12470744eb4';

        const provider = new ethers.providers.JsonRpcProvider(SUBNET_RPC_URL);
        const account = new ethers.Wallet(PRIVATE_KEY, provider);

        console.log(`Account address: ${account.address}`);

        // get network info from node
        const network = await provider.getNetwork();
        console.log(`Network chain ID: ${network.chainId}`);

        // get forwarder contract
        const forwarder = new ethers.Contract(
            FORWARDER_ADDRESS,
            [{ inputs: [{ internalType: "address", name: "from", type: "address" }], name: "getNonce", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" }],
            provider
        );

        // get current nonce in forwarder contract
        const forwarderNonce = await forwarder.getNonce(account.address);
        console.log(`Forwarder nonce: ${forwarderNonce}`);

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
            from: account.address,
            to: '0x65FE9B6E41BACc5F287DE88C1490c3933B77d511',
            value: String("0x0"),
            gas: ethers.BigNumber.from('50000').toHexString(),
            nonce: forwarderNonce.toHexString(),
            data: '0x095ea7b3',
            validUntilTime: String("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"),
            [SUFFIX_NAME]: ethers.utils.hexZeroPad(Buffer.from(REQUEST_SUFFIX, "utf8"), 32),
        };

        console.log('\n=== Message to Sign ===');
        console.log('Domain:', JSON.stringify(domain, null, 2));
        console.log('Message:', JSON.stringify(message, null, 2));

        const { EIP712Domain, ...typesWithoutDomain } = types;
        const signature = await account._signTypedData(
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
        console.log(`Expected address: ${account.address}`);
        console.log(`Match: ${verifiedAddress.toLowerCase() === account.address.toLowerCase()}`);

        if (verifiedAddress.toLowerCase() === account.address.toLowerCase()) {
            console.log('\n*** SUCCESS! Signature verification matches our wallet ***');
            
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

            console.log('\n=== Transaction Structure ===');
            console.log(JSON.stringify(tx, null, 2));

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
                    
                    // If we get a signature mismatch error, let's try to understand what's happening
                    if (result.data.error.message && result.data.error.message.includes('recovered signer address')) {
                        console.log('\n=== Signature Mismatch Analysis ===');
                        console.log('The relayer is expecting a different wallet address.');
                        console.log('This might be due to:');
                        console.log('1. The relayer is configured for a specific wallet');
                        console.log('2. There\'s a configuration issue');
                        console.log('3. We need to use a different private key');
                        
                        // Let's try to extract the expected address from the error
                        const errorMsg = result.data.error.message;
                        const match = errorMsg.match(/recovered signer address from signature '([^']+)'/);
                        if (match) {
                            console.log(`Expected signer address: ${match[1]}`);
                            console.log(`Our wallet address: ${account.address}`);
                        }
                    }
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
            console.log('\n*** FAILED: Signature verification does not match our wallet ***');
        }

    } catch (error) {
        console.error('Test failed:', error.message);
        process.exit(1);
    }
}

// Run test
tryWorkingApproach().catch(console.error); 