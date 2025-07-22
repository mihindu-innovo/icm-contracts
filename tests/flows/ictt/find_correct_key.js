const { ethers } = require('ethers');

/**
 * Find the correct private key for the expected address
 */
async function findCorrectKey() {
    console.log('=== Find Correct Private Key ===\n');

    try {
        const expectedAddress = '0x9042c66b0ab07fe9042ca04a1004a43cbc947e32';
        
        console.log('Expected address:', expectedAddress);
        console.log('Looking for private key that generates this address...\n');
        
        // Try some common private key patterns
        const testPatterns = [
            // Common test private keys
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
            // Some other common test keys
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
        ];
        
        let found = false;
        for (let i = 0; i < testPatterns.length; i++) {
            try {
                const wallet = new ethers.Wallet(testPatterns[i]);
                if (wallet.address.toLowerCase() === expectedAddress.toLowerCase()) {
                    console.log(`*** FOUND MATCH! ***`);
                    console.log(`Private key: ${testPatterns[i]}`);
                    console.log(`Wallet address: ${wallet.address}`);
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
            console.log('No match found with common test keys.');
            console.log('The expected address might require a specific private key.');
            console.log('You may need to check the documentation or configuration.');
        }
        
        // Let's also check if the expected address is a valid checksum address
        console.log('\n=== Address Analysis ===');
        console.log('Expected address checksum:', ethers.utils.getAddress(expectedAddress));
        console.log('Expected address is valid:', ethers.utils.isAddress(expectedAddress));
        
        // Check if it's a known address pattern
        console.log('Address starts with 0x90:', expectedAddress.startsWith('0x90'));
        console.log('Address length:', expectedAddress.length);

    } catch (error) {
        console.error('Search failed:', error.message);
        process.exit(1);
    }
}

// Run search
findCorrectKey().catch(console.error); 