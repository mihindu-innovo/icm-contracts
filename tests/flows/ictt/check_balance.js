const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

function loadConfig() {
    const scriptDir = __dirname;
    const projectRoot = path.join(scriptDir, '..', '..', '..');
    const configPath = path.join(projectRoot, 'deployment_gasless_results.json');
    
    console.log(`Loading config from: ${configPath}`);
    
    if (!fs.existsSync(configPath)) {
        throw new Error(`Deployment results not found at: ${configPath}`);
    }
    
    const deploymentResults = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return deploymentResults.deployment;
}

async function checkBalance() {
    try {
        const config = loadConfig();
        
        // Initialize provider
        const provider = new ethers.JsonRpcProvider(config.network.remote.rpcUrl);
        
        // Create contract instance
        const erc20Remote = new ethers.Contract(
            config.contracts.erc20Remote.contractAddress,
            [
                'function balanceOf(address account) view returns (uint256)',
                'function getSignatory() view returns (address)'
            ],
            provider
        );
        
        console.log(`Contract address: ${config.contracts.erc20Remote.contractAddress}`);
        
        // Check balance for different addresses
        const addresses = [
            '0x2b8195B483Ce775641a13Fd884506D45994FF1FF', // Test wallet
            '0xD5b7DE57f5a0c6674E81Db906ccC1dDEC56d38e8', // Signatory from deployment
            '0x576e01fb0b172f08823657175cb21f88b112a90c46c15c69177204854fe49476' // Private key wallet
        ];
        
        for (const address of addresses) {
            try {
                const balance = await erc20Remote.balanceOf(address);
                console.log(`Balance for ${address}: ${ethers.formatUnits(balance, 6)} USDC`);
            } catch (error) {
                console.log(`Error checking balance for ${address}: ${error.message}`);
            }
        }
        
        // Check signatory
        try {
            const signatory = await erc20Remote.getSignatory();
            console.log(`Signatory: ${signatory}`);
        } catch (error) {
            console.log(`Error checking signatory: ${error.message}`);
        }
        
    } catch (error) {
        console.error('Check failed:', error);
    }
}

checkBalance(); 