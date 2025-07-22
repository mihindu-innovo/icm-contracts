const { ethers } = require('ethers');
const axios = require('axios');

/**
 * Gasless ERC20 Bridge Client
 * Demonstrates gasless transactions for ERC20 bridge functionality
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
     * Test 1: Chain to Innovo (User pays gas)
     * @param {ethers.Wallet} wallet - User wallet
     * @param {Object} contracts - Contract instances
     * @param {string} recipient - Recipient address
     * @param {string} amount - Amount to transfer (in wei)
     */
    async testChainToInnovo(wallet, contracts, recipient, amount) {
        console.log('=== Test 1: Chain to Innovo (User pays gas) ===');
        
        const { erc20Home, erc20Remote, erc20Token } = contracts;

        // Step 1: Approve ERC20 tokens (user pays gas)
        console.log('Step 1: Approving ERC20 tokens...');
        const approveTx = await erc20Token.approve(this.config.erc20HomeAddress, amount);
        await approveTx.wait();
        console.log(`✓ Approved ${ethers.utils.formatUnits(amount, 6)} USDC for ERC20Home`);

        // Step 2: Send tokens from home to remote (user pays gas)
        console.log('Step 2: Sending tokens from Chain to Innovo...');
        
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
        console.log(`✓ Sent ${ethers.utils.formatUnits(amount, 6)} USDC from Chain to Innovo`);
        console.log(`  Transaction hash: ${sendReceipt.transactionHash}`);

        return sendReceipt;
    }

    /**
     * Test 2: Innovo to Chain (Gasless via relayer)
     * @param {ethers.Wallet} wallet - User wallet
     * @param {Object} contracts - Contract instances
     * @param {string} recipient - Recipient address
     * @param {string} amount - Amount to transfer (in wei)
     */
    async testInnovoToChain(wallet, contracts, recipient, amount) {
        console.log('\n=== Test 2: Innovo to Chain (Gasless via relayer) ===');
        
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
        console.log(`✓ Gasless send submitted for ${ethers.utils.formatUnits(amount, 6)} USDC from Innovo to Chain`);
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
 * Example usage and test function
 */
async function runGaslessBridgeTest() {
    // Load configuration
    const config = require('./gasless_config.json');
    
    // Add blockchain IDs and RPC URLs
    config.cChainBlockchainID = '0x7fc93d85c6d62c5b2ac0b519c87010ea5294012d1e407030d6acd0021cac10d5';
    config.innovomarkBlockchainID = '0xeaa43ceb6e928c745155585de433f487399081a800080775b0fce622b113fc95';
    config.homeRpcUrl = 'https://api.avax-test.network/ext/bc/C/rpc';
    config.remoteRpcUrl = 'https://subnets.avax.network/innovomark/testnet/rpc';

    // Initialize client
    const client = new GaslessBridgeClient(config);

    // Import wallet from private key for home network
    const privateKey = process.env.PRIVATE_KEY || '0x8a22131111b07684e5df85ef89ffd5350ce106115207c818a3bba12470744eb4';
    const homeWallet = client.importWallet(privateKey, 'home');
    console.log(`Home wallet address: ${homeWallet.address}`);

    // Initialize contracts for home network
    const homeContracts = client.initializeContracts(homeWallet, 'home');
    console.log('Home contracts initialized');

    // Test parameters
    const recipient = homeWallet.address; // Send to self for testing
    const amount = ethers.utils.parseUnits('0.1', 6); // 0.1 USDC (6 decimals)

    try {
        // Test 1: Chain to Innovo (User pays gas)
        console.log('\n--- Testing Chain to Innovo ---');
        const chainToInnovoReceipt = await client.testChainToInnovo(
            homeWallet, 
            homeContracts, 
            recipient, 
            amount
        );

        // Wait a bit for cross-chain message to be processed
        console.log('Waiting for cross-chain message processing...');
        await new Promise(resolve => setTimeout(resolve, 10000));

        // Test 2: Innovo to Chain (Gasless via relayer)
        console.log('\n--- Testing Innovo to Chain (Gasless) ---');
        
        // Import wallet for remote network
        const remoteWallet = client.importWallet(privateKey, 'remote');
        console.log(`Remote wallet address: ${remoteWallet.address}`);
        
        // Initialize contracts for remote network
        const remoteContracts = client.initializeContracts(remoteWallet, 'remote');
        console.log('Remote contracts initialized');

        const innovoToChainReceipt = await client.testInnovoToChain(
            remoteWallet, 
            remoteContracts, 
            recipient, 
            amount
        );

        console.log('\n=== Gasless Bridge Test Completed Successfully ===');
        console.log('Chain to Innovo transaction:', chainToInnovoReceipt.transactionHash);
        console.log('Innovo to Chain transaction:', innovoToChainReceipt.transactionHash);

    } catch (error) {
        console.error('Test failed:', error);
        process.exit(1);
    }
}

// Export for use in other modules
module.exports = {
    GaslessBridgeClient,
    runGaslessBridgeTest
};

// Run test if this file is executed directly
if (require.main === module) {
    runGaslessBridgeTest().catch(console.error);
} 