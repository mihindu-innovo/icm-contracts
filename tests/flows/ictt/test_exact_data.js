const { ethers } = require('ethers');

/**
 * Test with exact data from the error message
 */
async function testExactData() {
    console.log('=== Test Exact Data from Error ===\n');

    try {
        // From the error message, the expected address is: 0x9042c66b0ab07fe9042ca04a1004a43cbc947e32
        // But our wallet address is: 0xD5b7DE57f5a0c6674E81Db906ccC1dDEC56d38e8
        
        console.log('Expected address from relayer: 0x9042c66b0ab07fe9042ca04a1004a43cbc947e32');
        console.log('Our wallet address: 0xD5b7DE57f5a0c6674E81Db906ccC1dDEC56d38e8');
        
        // Let's try to find the private key for the expected address
        const expectedAddress = '0x9042c66b0ab07fe9042ca04a1004a43cbc947e32';
        
        // Test with different private keys
        const testPrivateKeys = [
            '0x8a22131111b07684e5df85ef89ffd5350ce106115207c818a3bba12470744eb4', // Our current key
            '0x9042c66b0ab07fe9042ca04a1004a43cbc947e32', // Try the address as private key
            '0x1234567890123456789012345678901234567890123456789012345678901234', // Test key
        ];
        
        for (let i = 0; i < testPrivateKeys.length; i++) {
            const privateKey = testPrivateKeys[i];
            const wallet = new ethers.Wallet(privateKey);
            console.log(`\nTest ${i + 1}:`);
            console.log(`Private key: ${privateKey.substring(0, 10)}...`);
            console.log(`Wallet address: ${wallet.address}`);
            console.log(`Matches expected: ${wallet.address.toLowerCase() === expectedAddress.toLowerCase()}`);
        }
        
        // Let's also check if there's an environment variable issue
        console.log('\n=== Environment Check ===');
        console.log('PRIVATE_KEY from env:', process.env.PRIVATE_KEY ? 'Set' : 'Not set');
        
        // Test with the exact message structure from the error
        const domain = {
            name: "innovomark",
            version: "1",
            chainId: 54414,
            verifyingContract: "0xadb1cc52d50089a57c797685ea085e5cd2642c82"
        };
        
        const types = {
            EIP712Domain: [
                { name: "name", type: "string" },
                { name: "version", type: "string" },
                { name: "chainId", type: "uint256" },
                { name: "verifyingContract", type: "address" },
            ],
            Message: [
                { name: "from", type: "address" },
                { name: "to", type: "address" },
                { name: "value", type: "uint256" },
                { name: "gas", type: "uint256" },
                { name: "nonce", type: "uint256" },
                { name: "data", type: "bytes" },
                { name: "validUntilTime", type: "uint256" },
                { name: "EMYIVHVJOTQUBEJLHAJCZLQ", type: "bytes32" },
            ],
        };
        
        const message = {
            from: "0x9042c66b0ab07fe9042ca04a1004a43cbc947e32", // The expected address
            to: "0x65fe9b6e41bacc5f287de88c1490c3933b77d511",
            value: "0x0",
            gas: "0x5502",
            nonce: "0x0",
            data: "0x095ea7b300000000000000000000000065fe9b6e41bacc5f287de88c1490c3933b77d511000000000000000000000000000000000000000000000000000000000000186a0",
            validUntilTime: "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
            EMYIVHVJOTQUBEJLHAJCZLQ: "0x000000000000000000454d59495648564a4f54515542454a4c48414a435a4c51"
        };
        
        console.log('\n=== Testing with Expected Address ===');
        console.log('Message from:', message.from);
        console.log('Message to:', message.to);
        console.log('Message data:', message.data);
        
        // Try to verify if this message was signed by our wallet
        const { EIP712Domain, ...typesWithoutDomain } = types;
        
        // We can't sign with the expected address since we don't have its private key
        // But we can verify if our signature would work with this message structure
        
        const ourWallet = new ethers.Wallet('0x8a22131111b07684e5df85ef89ffd5350ce106115207c818a3bba12470744eb4');
        
        // Create the same message but with our address
        const ourMessage = {
            ...message,
            from: ourWallet.address.toLowerCase()
        };
        
        const signature = await ourWallet._signTypedData(domain, typesWithoutDomain, ourMessage);
        console.log('\nOur signature:', signature);
        
        const verifiedAddress = ethers.utils.verifyTypedData(domain, typesWithoutDomain, ourMessage, signature);
        console.log('Verified address:', verifiedAddress);
        console.log('Our wallet address:', ourWallet.address);
        console.log('Match:', verifiedAddress.toLowerCase() === ourWallet.address.toLowerCase());

    } catch (error) {
        console.error('Test failed:', error.message);
        process.exit(1);
    }
}

// Run test
testExactData().catch(console.error); 