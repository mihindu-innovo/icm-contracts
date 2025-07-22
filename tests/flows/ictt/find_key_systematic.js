const { ethers } = require('ethers');

/**
 * Systematic search for the private key that generates the expected address
 */
async function findKeySystematic() {
    console.log('=== Systematic Search for Private Key ===\n');

    try {
        const expectedAddress = '0x9042c66b0ab07fe9042ca04a1004a43cbc947e32';
        
        console.log('Expected address:', expectedAddress);
        console.log('Searching for private key...\n');
        
        // Try a systematic approach - let's try some specific patterns
        const testKeys = [
            // Common test keys
            '0x0000000000000000000000000000000000000000000000000000000000000001',
            '0x0000000000000000000000000000000000000000000000000000000000000002',
            '0x0000000000000000000000000000000000000000000000000000000000000003',
            '0x0000000000000000000000000000000000000000000000000000000000000004',
            '0x0000000000000000000000000000000000000000000000000000000000000005',
            '0x0000000000000000000000000000000000000000000000000000000000000006',
            '0x0000000000000000000000000000000000000000000000000000000000000007',
            '0x0000000000000000000000000000000000000000000000000000000000000008',
            '0x0000000000000000000000000000000000000000000000000000000000000009',
            '0x000000000000000000000000000000000000000000000000000000000000000a',
            '0x000000000000000000000000000000000000000000000000000000000000000b',
            '0x000000000000000000000000000000000000000000000000000000000000000c',
            '0x000000000000000000000000000000000000000000000000000000000000000d',
            '0x000000000000000000000000000000000000000000000000000000000000000e',
            '0x000000000000000000000000000000000000000000000000000000000000000f',
            '0x0000000000000000000000000000000000000000000000000000000000000010',
            // Try some specific keys that might be used in testing
            '0x1234567890123456789012345678901234567890123456789012345678901234',
            '0x1111111111111111111111111111111111111111111111111111111111111111',
            '0x2222222222222222222222222222222222222222222222222222222222222222',
            '0x3333333333333333333333333333333333333333333333333333333333333333',
            '0x4444444444444444444444444444444444444444444444444444444444444444',
            '0x5555555555555555555555555555555555555555555555555555555555555555',
            '0x6666666666666666666666666666666666666666666666666666666666666666',
            '0x7777777777777777777777777777777777777777777777777777777777777777',
            '0x8888888888888888888888888888888888888888888888888888888888888888',
            '0x9999999999999999999999999999999999999999999999999999999999999999',
            '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
            '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
            '0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
            '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
            '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
            // Try some keys that might be used in the AvaCloud documentation
            '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
            '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
            '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
            '0x7c852118e8d278640a5b4c4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d',
            '0x8c852118e8d278640a5b4c4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d',
            '0x9c852118e8d278640a5b4c4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d',
            '0xac852118e8d278640a5b4c4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d',
            '0xbc852118e8d278640a5b4c4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d',
            '0xcc852118e8d278640a5b4c4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d',
            '0xdc852118e8d278640a5b4c4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d',
            '0xec852118e8d278640a5b4c4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d',
            '0xfc852118e8d278640a5b4c4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d',
        ];
        
        let found = false;
        for (let i = 0; i < testKeys.length; i++) {
            try {
                const wallet = new ethers.Wallet(testKeys[i]);
                if (wallet.address.toLowerCase() === expectedAddress.toLowerCase()) {
                    console.log(`*** FOUND MATCH! ***`);
                    console.log(`Private key: ${testKeys[i]}`);
                    console.log(`Wallet address: ${wallet.address}`);
                    console.log(`Index: ${i}`);
                    found = true;
                    break;
                }
                
                // Print progress every 10 keys
                if ((i + 1) % 10 === 0) {
                    console.log(`Checked ${i + 1} keys...`);
                }
            } catch (error) {
                // Skip invalid keys
            }
        }
        
        if (!found) {
            console.log('No match found with systematic search.');
            console.log('The expected address might require a specific private key.');
            console.log('You may need to check the AvaCloud documentation or configuration.');
            
            // Let's also check if the expected address is a valid checksum address
            console.log('\n=== Address Analysis ===');
            console.log('Expected address checksum:', ethers.utils.getAddress(expectedAddress));
            console.log('Expected address is valid:', ethers.utils.isAddress(expectedAddress));
            
            // Check if it's a known address pattern
            console.log('Address starts with 0x90:', expectedAddress.startsWith('0x90'));
            console.log('Address length:', expectedAddress.length);
            
            // Let's also check if there's a specific pattern in the address
            const addressBytes = ethers.utils.arrayify(expectedAddress);
            console.log('Address bytes:', addressBytes.map(b => b.toString(16).padStart(2, '0')).join(''));
        }

    } catch (error) {
        console.error('Search failed:', error.message);
        process.exit(1);
    }
}

// Run search
findKeySystematic().catch(console.error); 