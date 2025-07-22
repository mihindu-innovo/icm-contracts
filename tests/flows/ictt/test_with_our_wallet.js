const { ethers } = require('ethers');
const axios = require('axios');

/**
 * Test with our current wallet using the exact same approach as the working example
 */
async function testWithOurWallet() {
    console.log('=== Test with Our Wallet ===\n');

    try {
        // Configuration matching the working example
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
            from: account.address, // Use original case
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
        
        // wrap relay tx with json rpc request format.
        const requestBody = {
            id: 1,
            jsonrpc: "2.0",
            method: "eth_sendRawTransaction",
            params: [rawTx],
        };

        console.log('\n=== Submitting to Relayer ===');
        console.log('Request body:', JSON.stringify(requestBody, null, 2));

        // send relay tx to relay server
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

    } catch (error) {
        console.error('Test failed:', error.message);
        process.exit(1);
    }
}

// Run test
testWithOurWallet().catch(console.error); 