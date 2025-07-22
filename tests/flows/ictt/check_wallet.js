const { ethers } = require('ethers');

/**
 * Check wallet configuration
 */
async function checkWallet() {
    console.log('=== Check Wallet Configuration ===\n');

    try {
        // Check environment variable
        console.log('Environment PRIVATE_KEY:', process.env.PRIVATE_KEY ? 'Set' : 'Not set');
        
        // Default private key from our code
        const defaultPrivateKey = '0x8a22131111b07684e5df85ef89ffd5350ce106115207c818a3bba12470744eb4';
        
        // Expected address from relayer error
        const expectedAddress = '0x9042c66b0ab07fe9042ca04a1004a43cbc947e32';
        
        console.log('\n=== Wallet Analysis ===');
        console.log('Default private key:', defaultPrivateKey.substring(0, 10) + '...');
        
        const wallet = new ethers.Wallet(defaultPrivateKey);
        console.log('Wallet address from default key:', wallet.address);
        console.log('Expected address from relayer:', expectedAddress);
        console.log('Addresses match:', wallet.address.toLowerCase() === expectedAddress.toLowerCase());
        
        // Check if there's a different private key we should be using
        console.log('\n=== Testing Different Keys ===');
        
        // Try some common test private keys
        const testKeys = [
            '0x0000000000000000000000000000000000000000000000000000000000000001',
            '0x0000000000000000000000000000000000000000000000000000000000000002',
            '0x1234567890123456789012345678901234567890123456789012345678901234',
            '0x1111111111111111111111111111111111111111111111111111111111111111',
        ];
        
        for (let i = 0; i < testKeys.length; i++) {
            try {
                const testWallet = new ethers.Wallet(testKeys[i]);
                console.log(`Test key ${i + 1}: ${testWallet.address}`);
                if (testWallet.address.toLowerCase() === expectedAddress.toLowerCase()) {
                    console.log(`*** MATCH FOUND! Key ${i + 1} matches expected address ***`);
                }
            } catch (error) {
                console.log(`Test key ${i + 1}: Invalid key`);
            }
        }
        
        // Let's also check if the expected address is a valid address
        console.log('\n=== Address Validation ===');
        console.log('Expected address valid:', ethers.utils.isAddress(expectedAddress));
        console.log('Our wallet address valid:', ethers.utils.isAddress(wallet.address));
        
        // Check if there's a checksum issue
        console.log('Expected address checksum:', ethers.utils.getAddress(expectedAddress));
        console.log('Our wallet checksum:', ethers.utils.getAddress(wallet.address));
        
        // Let's also check what the actual private key should be for the expected address
        // (This is just for debugging - we can't derive the private key from the address)
        console.log('\n=== Debug Info ===');
        console.log('Expected address length:', expectedAddress.length);
        console.log('Our wallet address length:', wallet.address.length);
        console.log('Both addresses start with 0x:', expectedAddress.startsWith('0x') && wallet.address.startsWith('0x'));

    } catch (error) {
        console.error('Check failed:', error.message);
        process.exit(1);
    }
}

// Run check
checkWallet().catch(console.error); 