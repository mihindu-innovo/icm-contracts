const { ethers } = require('ethers');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

/**
 * Gasless ERC20 Bridge Client
 * Demonstrates gasless transactions for ERC20 bridge functionality
 * Tests both directions: Home to Remote (regular) and Remote to Home (gasless)
 */
class GaslessBridgeClient {
    constructor(config) {
        this.config = config;
        
        // Use separate RPC URLs for blockchain connections
        this.homeProvider = new ethers.providers.JsonRpcProvider(config.homeRpcUrl || 'https://api.avax-test.network/ext/bc/C/rpc');
        this.remoteProvider = new ethers.providers.JsonRpcProvider(config.remoteRpcUrl || 'https://subnets.avax.network/innovomark/testnet/rpc');
        
        // Use AvaCloud RPC for relayer operations
        this.relayerProvider = new ethers.providers.JsonRpcProvider(config.avaCloudRpcUrl);
        
        this.forwarder = new ethers.Contract(
            config.avaCloudForwarder,
            this.getForwarderABI(),
            this.relayerProvider
        );
    }

    /**
     * Import wallet from private key
     * @param {string} privateKey - Private key with or without 0x prefix
     * @param {string} network - 'home' or 'remote' to specify which network to connect to
     * @returns {ethers.Wallet} - Wallet instance
     */
    importWallet(privateKey, network = 'home') {
        // Remove 0x prefix if present
        if (privateKey.startsWith('0x')) {
            privateKey = privateKey.slice(2);
        }
        
        const provider = network === 'remote' ? this.remoteProvider : this.homeProvider;
        return new ethers.Wallet(privateKey, provider);
    }

    /**
     * Initialize contracts with wallet
     * @param {ethers.Wallet} wallet - User wallet
     * @param {string} network - 'home' or 'remote' to specify which network to connect to
     * @returns {Object} - Contract instances
     */
    initializeContracts(wallet, network = 'home') {
        const provider = network === 'remote' ? this.remoteProvider : this.homeProvider;
        
        const erc20Home = new ethers.Contract(
            this.config.erc20HomeAddress,
            this.getERC20HomeABI(),
            wallet
        );

        const erc20Remote = new ethers.Contract(
            this.config.erc20RemoteAddress,
            this.getERC20RemoteABI(),
            wallet
        );

        const erc20Token = new ethers.Contract(
            this.config.erc20TokenAddress,
            this.getERC20TokenABI(),
            wallet
        );

        return { erc20Home, erc20Remote, erc20Token };
    }

    /**
     * Test 1: Home to Remote (Regular transaction - user pays gas)
     * @param {ethers.Wallet} wallet - User wallet
     * @param {Object} contracts - Contract instances
     * @param {string} recipient - Recipient address
     * @param {string} amount - Amount to transfer (in wei)
     */
    async testHomeToRemote(wallet, contracts, recipient, amount) {
        console.log('=== Test 1: Home to Remote (Regular transaction - user pays gas) ===');
        
        const { erc20Home, erc20Remote, erc20Token } = contracts;

        // Step 1: Approve ERC20 tokens (user pays gas)
        console.log('Step 1: Approving ERC20 tokens...');
        const approveTx = await erc20Token.approve(this.config.erc20HomeAddress, amount);
        await approveTx.wait();
        console.log(`✓ Approved ${ethers.utils.formatUnits(amount, 6)} USDC for ERC20Home`);
        console.log(`  Transaction hash: ${approveTx.hash}`);

        // Step 2: Send tokens from home to remote (user pays gas)
        console.log('Step 2: Sending tokens from Home to Remote...');
        
        const sendInput = {
            destinationBlockchainID: this.config.innovomarkBlockchainID,
            destinationTokenTransferrerAddress: this.config.erc20RemoteAddress,
            recipient: recipient,
            primaryFeeTokenAddress: this.config.erc20TokenAddress,
            primaryFee: ethers.constants.Zero,
            secondaryFee: ethers.constants.Zero,
            requiredGasLimit: 200000,
            multiHopFallback: ethers.constants.AddressZero
        };

        const sendTx = await erc20Home.send(sendInput, amount);
        const sendReceipt = await sendTx.wait();
        console.log(`✓ Sent ${ethers.utils.formatUnits(amount, 6)} USDC from Home to Remote`);
        console.log(`  Transaction hash: ${sendReceipt.transactionHash}`);

        return sendReceipt;
    }

    /**
     * Test 2: Remote to Home (Gasless transaction via relayer)
     * @param {ethers.Wallet} wallet - User wallet
     * @param {Object} contracts - Contract instances
     * @param {string} recipient - Recipient address
     * @param {string} amount - Amount to transfer (in wei)
     */
    async testRemoteToHome(wallet, contracts, recipient, amount) {
        console.log('\n=== Test 2: Remote to Home (Gasless transaction via relayer) ===');
        
        const { erc20Home, erc20Remote, erc20Token } = contracts;

        // Step 1: Create gasless approval for burning tokens
        console.log('Step 1: Creating gasless approval for burning tokens...');
        const approvalData = await this.createGaslessApproval(
            wallet,
            this.config.erc20RemoteAddress,
            amount,
            'remote'
        );
        
        const approvalReceipt = await this.submitGaslessTransaction(approvalData);
        console.log(`✓ Gasless approval submitted for ${ethers.utils.formatUnits(amount, 6)} USDC`);
        console.log(`  Transaction hash: ${approvalReceipt.transactionHash}`);

        // Step 2: Create gasless send transaction
        console.log('Step 2: Creating gasless send transaction...');
        const sendInput = {
            destinationBlockchainID: this.config.cChainBlockchainID,
            destinationTokenTransferrerAddress: this.config.erc20HomeAddress,
            recipient: recipient,
            primaryFeeTokenAddress: this.config.erc20RemoteAddress,
            primaryFee: ethers.constants.Zero,
            secondaryFee: ethers.constants.Zero,
            requiredGasLimit: 200000,
            multiHopFallback: ethers.constants.AddressZero
        };

        const sendData = await this.createGaslessSend(
            wallet,
            this.config.erc20RemoteAddress,
            sendInput,
            amount,
            'remote'
        );

        const sendReceipt = await this.submitGaslessTransaction(sendData);
        console.log(`✓ Gasless send submitted for ${ethers.utils.formatUnits(amount, 6)} USDC from Remote to Home`);
        console.log(`  Transaction hash: ${sendReceipt.transactionHash}`);

        return sendReceipt;
    }

    /**
     * Create EIP-712 signature for approval
     * @param {ethers.Wallet} wallet - User wallet
     * @param {string} contractAddress - Contract address
     * @param {string} amount - Amount to approve
     * @param {string} network - 'home' or 'remote' to specify which network
     * @returns {Object} - EIP-712 message and signature
     */
    async createGaslessApproval(wallet, contractAddress, amount, network = 'remote') {
        // Get the actual nonce from the forwarder contract
        const forwarder = new ethers.Contract(
            this.config.avaCloudForwarder,
            [{ inputs: [{ internalType: "address", name: "from", type: "address" }], name: "getNonce", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" }],
            this.remoteProvider
        );
        const nonce = await forwarder.getNonce(wallet.address);

        // Get chain ID from remote network
        const remoteNetwork = await this.remoteProvider.getNetwork();
        const chainId = remoteNetwork.chainId;

        const domain = {
            name: this.config.avaCloudDomain,
            version: this.config.avaCloudVersion,
            chainId: chainId,
            verifyingContract: this.config.avaCloudForwarder
        };

        const types = [
            { name: 'from', type: 'address' },
            { name: 'to', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'gas', type: 'uint256' },
            { name: 'nonce', type: 'uint256' },
            { name: 'data', type: 'bytes' },
            { name: 'validUntilTime', type: 'uint256' },
            { name: this.config.avaCloudRequestSuffix, type: 'bytes32' }
        ];

        const message = {
            from: wallet.address,
            to: contractAddress,
            value: String("0x0"),
            gas: String("0x0"), // Let relayer decide on gas
            nonce: nonce.toHexString(),
            data: this.encodeApprovalData(contractAddress, amount),
            validUntilTime: String("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"),
            [this.config.avaCloudRequestSuffix]: ethers.utils.hexlify(
                ethers.utils.toUtf8Bytes(`bytes32 ${this.config.avaCloudRequestSuffix})`)
            )
        };

        const signature = await wallet._signTypedData(domain, { Message: types }, message);

        return {
            forwardRequest: {
                domain,
                types: { Message: types },
                primaryType: 'Message',
                message
            },
            metadata: {
                signature: signature.substring(2)
            }
        };
    }

    /**
     * Create EIP-712 signature for send
     * @param {ethers.Wallet} wallet - User wallet
     * @param {string} contractAddress - Contract address
     * @param {Object} sendInput - Send input parameters
     * @param {string} amount - Amount to send
     * @param {string} network - 'home' or 'remote' to specify which network
     * @returns {Object} - EIP-712 message and signature
     */
    async createGaslessSend(wallet, contractAddress, sendInput, amount, network = 'remote') {
        // Get the actual nonce from the forwarder contract
        const forwarder = new ethers.Contract(
            this.config.avaCloudForwarder,
            [{ inputs: [{ internalType: "address", name: "from", type: "address" }], name: "getNonce", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" }],
            this.remoteProvider
        );
        const nonce = await forwarder.getNonce(wallet.address);

        // Get chain ID from remote network
        const remoteNetwork = await this.remoteProvider.getNetwork();
        const chainId = remoteNetwork.chainId;

        const domain = {
            name: this.config.avaCloudDomain,
            version: this.config.avaCloudVersion,
            chainId: chainId,
            verifyingContract: this.config.avaCloudForwarder
        };

        const types = [
            { name: 'from', type: 'address' },
            { name: 'to', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'gas', type: 'uint256' },
            { name: 'nonce', type: 'uint256' },
            { name: 'data', type: 'bytes' },
            { name: 'validUntilTime', type: 'uint256' },
            { name: this.config.avaCloudRequestSuffix, type: 'bytes32' }
        ];

        const message = {
            from: wallet.address,
            to: contractAddress,
            value: String("0x0"),
            gas: String("0x0"), // Let relayer decide on gas
            nonce: nonce.toHexString(),
            data: this.encodeSendData(contractAddress, sendInput, amount),
            validUntilTime: String("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"),
            [this.config.avaCloudRequestSuffix]: ethers.utils.hexlify(
                ethers.utils.toUtf8Bytes(`bytes32 ${this.config.avaCloudRequestSuffix})`)
            )
        };

        const signature = await wallet._signTypedData(domain, { Message: types }, message);

        return {
            forwardRequest: {
                domain,
                types: { Message: types },
                primaryType: 'Message',
                message
            },
            metadata: {
                signature: signature.substring(2)
            }
        };
    }

    /**
     * Submit gasless transaction to relayer
     * @param {Object} transactionData - EIP-712 transaction data
     * @returns {Object} - Transaction receipt
     */
    async submitGaslessTransaction(transactionData) {
        try {
            // Format the transaction data according to the backend implementation
            const payload = `0x${Buffer.from(
                JSON.stringify({
                    forwardRequest: {
                        primaryType: transactionData.forwardRequest.primaryType,
                        domain: transactionData.forwardRequest.domain,
                        types: transactionData.forwardRequest.types,
                        message: {
                            ...transactionData.forwardRequest.message,
                            [this.config.avaCloudRequestSuffix]: ethers.utils.hexlify(
                                ethers.utils.toUtf8Bytes(`bytes32 ${this.config.avaCloudRequestSuffix})`)
                            )
                        }
                    },
                    metadata: {
                        signature: transactionData.metadata.signature
                    }
                })
            ).toString('hex')}`;

            const requestBody = {
                id: 1,
                jsonrpc: '2.0',
                method: 'eth_sendRawTransaction',
                params: [payload]
            };
            
            const response = await axios.post(this.config.avaCloudRpcUrl, requestBody, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${Buffer.from(`${this.config.avaCloudAuth.username}:${this.config.avaCloudAuth.password}`).toString('base64')}`
                }
            });

            if (response.data.error) {
                throw new Error(`Relayer error: ${JSON.stringify(response.data.error)}`);
            }

            const txHash = response.data.result || response.data.transactionHash;
            console.log(`Transaction submitted: ${txHash}`);

            // Wait for transaction to be mined
            const receipt = await this.remoteProvider.waitForTransaction(txHash);
            return receipt;
        } catch (error) {
            console.error('Error submitting gasless transaction:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Encode approval data
     * @param {string} spender - Spender address
     * @param {string} amount - Amount to approve
     * @returns {string} - Encoded data
     */
    encodeApprovalData(spender, amount) {
        const erc20Interface = new ethers.utils.Interface(this.getERC20TokenABI());
        return erc20Interface.encodeFunctionData('approve', [spender, amount]);
    }

    /**
     * Encode send data
     * @param {string} contractAddress - Contract address
     * @param {Object} sendInput - Send input parameters
     * @param {string} amount - Amount to send
     * @returns {string} - Encoded data
     */
    encodeSendData(contractAddress, sendInput, amount) {
        const erc20RemoteInterface = new ethers.utils.Interface(this.getERC20RemoteABI());
        return erc20RemoteInterface.encodeFunctionData('send', [sendInput, amount]);
    }

    // ABI definitions
    getForwarderABI() {
        return [
            'function getNonce(address from) view returns (uint256)',
            'function executeMetaTransaction(address from, address to, uint256 value, uint256 gas, uint256 nonce, bytes calldata data, uint256 validUntilTime, bytes calldata signature) returns (bytes memory)'
        ];
    }

    getERC20HomeABI() {
        return [
            'function send(tuple(bytes32 destinationBlockchainID, address destinationTokenTransferrerAddress, address recipient, address primaryFeeTokenAddress, uint256 primaryFee, uint256 secondaryFee, uint256 requiredGasLimit, address multiHopFallback) input, uint256 amount)',
            'function executeMetaTransaction(address from, address to, uint256 value, uint256 gas, uint256 nonce, bytes calldata data, uint256 validUntilTime, bytes calldata signature) returns (bytes memory)'
        ];
    }

    getERC20RemoteABI() {
        return [
            'function send(tuple(bytes32 destinationBlockchainID, address destinationTokenTransferrerAddress, address recipient, address primaryFeeTokenAddress, uint256 primaryFee, uint256 secondaryFee, uint256 requiredGasLimit, address multiHopFallback) input, uint256 amount)',
            'function approve(address spender, uint256 amount) returns (bool)',
            'function balanceOf(address account) view returns (uint256)',
            'function executeMetaTransaction(address from, address to, uint256 value, uint256 gas, uint256 nonce, bytes calldata data, uint256 validUntilTime, bytes calldata signature) returns (bytes memory)'
        ];
    }

    getERC20TokenABI() {
        return [
            'function approve(address spender, uint256 amount) returns (bool)',
            'function balanceOf(address account) view returns (uint256)',
            'function transfer(address to, uint256 amount) returns (bool)'
        ];
    }
}

/**
 * Load configuration from deployment folder
 * @param {string} deploymentFolder - Path to deployment folder (default: contracts/ictt)
 * @returns {Object} - Configuration object
 */
function loadConfig(deploymentFolder = null) {
    // Resolve the path relative to the current script location
    const scriptDir = __dirname; // tests/flows/ictt
    const projectRoot = path.join(scriptDir, '..', '..', '..'); // Go up 3 levels to project root
    const contractsIcttPath = path.join(projectRoot, 'contracts', 'ictt');
    
    // Use provided deployment folder or default to contracts/ictt
    const basePath = deploymentFolder ? path.resolve(deploymentFolder) : contractsIcttPath;
    
    const configPath = path.join(basePath, 'gasless_config.json');
    const deploymentResultsPath = path.join(basePath, 'deployment_results.json');
    
    console.log(`Loading config from: ${configPath}`);
    console.log(`Loading deployment results from: ${deploymentResultsPath}`);
    
    if (!fs.existsSync(configPath)) {
        throw new Error(`Gasless config not found at: ${configPath}`);
    }
    
    if (!fs.existsSync(deploymentResultsPath)) {
        throw new Error(`Deployment results not found at: ${deploymentResultsPath}`);
    }
    
    // Load gasless config
    const gaslessConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    // Load deployment results
    const deploymentResults = JSON.parse(fs.readFileSync(deploymentResultsPath, 'utf8'));
    
    // Merge deployment results into config
    const config = {
        ...gaslessConfig,
        erc20HomeAddress: deploymentResults.erc20Home.contractAddress,
        erc20RemoteAddress: deploymentResults.erc20Remote.contractAddress,
        forwarderAddress: deploymentResults.forwarderAddress
    };
    
    console.log('Configuration loaded successfully:');
    console.log(`  ERC20Home: ${config.erc20HomeAddress}`);
    console.log(`  ERC20Remote: ${config.erc20RemoteAddress}`);
    console.log(`  Forwarder: ${config.forwarderAddress}`);
    
    return config;
}

/**
 * Run bidirectional ICTT test
 * @param {string} deploymentFolder - Path to deployment folder
 * @param {string} privateKey - Private key for testing
 */
async function runBidirectionalICTTTest(deploymentFolder = null, privateKey = null) {
    try {
        // Load configuration from deployment folder
        const config = loadConfig(deploymentFolder);
        
        // Use provided private key or environment variable
        const testPrivateKey = privateKey || process.env.PRIVATE_KEY || '0x8a22131111b07684e5df85ef89ffd5350ce106115207c818a3bba12470744eb4';
        
        // Initialize client
        const client = new GaslessBridgeClient(config);
        
        // Test parameters
        const recipient = '0x03F2dA5859BA2991Bc243540004793F2b646B296'; // Test recipient
        const amount = ethers.utils.parseUnits('0.1', 6); // 0.1 USDC (6 decimals)
        
        console.log('\n=== Starting Bidirectional ICTT Test ===');
        console.log(`Test recipient: ${recipient}`);
        console.log(`Test amount: ${ethers.utils.formatUnits(amount, 6)} USDC`);
        
        // Test 1: Home to Remote (Regular transaction)
        console.log('\n--- Test 1: Home to Remote (Regular transaction) ---');
        
        // Import wallet for home network
        const homeWallet = client.importWallet(testPrivateKey, 'home');
        console.log(`Home wallet address: ${homeWallet.address}`);
        
        // Initialize contracts for home network
        const homeContracts = client.initializeContracts(homeWallet, 'home');
        console.log('Home contracts initialized');
        
        const homeToRemoteReceipt = await client.testHomeToRemote(
            homeWallet, 
            homeContracts, 
            recipient, 
            amount
        );
        
        // Wait for cross-chain message processing
        console.log('\nWaiting for cross-chain message processing (10 seconds)...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        // Test 2: Remote to Home (Gasless transaction)
        console.log('\n--- Test 2: Remote to Home (Gasless transaction) ---');
        
        // Import wallet for remote network
        const remoteWallet = client.importWallet(testPrivateKey, 'remote');
        console.log(`Remote wallet address: ${remoteWallet.address}`);
        
        // Initialize contracts for remote network
        const remoteContracts = client.initializeContracts(remoteWallet, 'remote');
        console.log('Remote contracts initialized');
        
        const remoteToHomeReceipt = await client.testRemoteToHome(
            remoteWallet, 
            remoteContracts, 
            recipient, 
            amount
        );
        
        console.log('\n=== Bidirectional ICTT Test Completed Successfully ===');
        console.log('Home to Remote transaction:', homeToRemoteReceipt.transactionHash);
        console.log('Remote to Home transaction:', remoteToHomeReceipt.transactionHash);
        
        return {
            homeToRemote: homeToRemoteReceipt,
            remoteToHome: remoteToHomeReceipt
        };
        
    } catch (error) {
        console.error('Bidirectional ICTT test failed:', error);
        throw error;
    }
}

// Export for use in other modules
module.exports = {
    GaslessBridgeClient,
    loadConfig,
    runBidirectionalICTTTest
};

// Run test if this file is executed directly
if (require.main === module) {
    const deploymentFolder = process.argv[2] || null;
    const privateKey = process.argv[3] || null;
    
    console.log(`Running bidirectional ICTT test with deployment folder: ${deploymentFolder || 'contracts/ictt (default)'}`);
    
    runBidirectionalICTTTest(deploymentFolder, privateKey)
        .then(() => {
            console.log('Test completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Test failed:', error);
            process.exit(1);
        });
} 