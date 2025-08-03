const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Load configuration
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

async function testApprove() {
    try {
        const config = loadConfig();
        
        // Initialize provider
        const provider = new ethers.JsonRpcProvider(config.network.remote.rpcUrl);
        
        // Create wallet
        const privateKey = '0x576e01fb0b172f08823657175cb21f88b112a90c46c15c69177204854fe49476';
        const wallet = new ethers.Wallet(privateKey, provider);
        
        console.log(`Testing with wallet: ${wallet.address}`);
        
        // Create contract instance
        const erc20Remote = new ethers.Contract(
            config.contracts.erc20Remote.contractAddress,
            [
                'function approve(address spender, uint256 amount) returns (bool)',
                'function allowance(address owner, address spender) view returns (uint256)',
                'function balanceOf(address account) view returns (uint256)'
            ],
            wallet
        );
        
        console.log(`Contract address: ${config.contracts.erc20Remote.contractAddress}`);
        
        // Check initial allowance
        const initialAllowance = await erc20Remote.allowance(wallet.address, config.contracts.erc20Remote.contractAddress);
        console.log(`Initial allowance: ${ethers.formatUnits(initialAllowance, 6)} USDC`);
        
        // Check balance
        const balance = await erc20Remote.balanceOf(wallet.address);
        console.log(`Balance: ${ethers.formatUnits(balance, 6)} USDC`);
        
        // Try to approve
        const amount = ethers.parseUnits('0.1', 6);
        console.log(`Attempting to approve ${ethers.formatUnits(amount, 6)} USDC...`);
        
        try {
            const approveTx = await erc20Remote.approve(config.contracts.erc20Remote.contractAddress, amount);
            console.log(`Approval transaction sent: ${approveTx.hash}`);
            
            // Wait for transaction
            const receipt = await approveTx.wait();
            console.log(`Transaction status: ${receipt.status === 1 ? 'Success' : 'Failed'}`);
            
            // Check allowance after approval
            const newAllowance = await erc20Remote.allowance(wallet.address, config.contracts.erc20Remote.contractAddress);
            console.log(`New allowance: ${ethers.formatUnits(newAllowance, 6)} USDC`);
            
        } catch (error) {
            console.error('Approval failed:', error.message);
            if (error.data) {
                console.error('Error data:', error.data);
            }
        }
        
    } catch (error) {
        console.error('Test failed:', error);
    }
}

testApprove(); 