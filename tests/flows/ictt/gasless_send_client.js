const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Helper function to convert string to hex (equivalent to viem's toHex)
function toHex(value) {
    return ethers.hexlify(ethers.toUtf8Bytes(value));
}

/**
 * Gasless Send Client
 * Tests the gasless send functionality of ERC20Remote following MintController pattern
 */
class GaslessSendClient {
    constructor(config) {
        this.config = config;
        
        // Initialize providers (ethers v6)
        this.homeProvider = new ethers.JsonRpcProvider(config.network.home.rpcUrl);
        this.remoteProvider = new ethers.JsonRpcProvider(config.network.remote.rpcUrl);
        
        // AvaCloud relayer configuration
        this.relayerConfig = {
            url: 'https://gas-relayer.avax.network/innovomark/testnet/rpc',
            auth: {
                username: 'innovomark_testnet',
                password: 'PVY8wZa10O9nrP3mfB'
            },
            suffix: 'EMYIVHVJOTQUBEJLHAJCZLQ'
        };
    }

    /**
     * Import wallet from private key
     * @param {string} privateKey - Private key with or without 0x prefix
     * @param {string} network - 'home' or 'remote'
     * @returns {ethers.Wallet} - Wallet instance
     */
    importWallet(privateKey, network = 'home') {
        if (privateKey.startsWith('0x')) {
            privateKey = privateKey.slice(2);
        }
        
        const provider = network === 'remote' ? this.remoteProvider : this.homeProvider;
        return new ethers.Wallet(privateKey, provider);
    }

    /**
     * Initialize contracts with wallet
     * @param {ethers.Wallet} wallet - User wallet
     * @param {string} network - 'home' or 'remote'
     * @returns {Object} - Contract instances
     */
    initializeContracts(wallet, network = 'home') {
        const provider = network === 'remote' ? this.remoteProvider : this.homeProvider;
        
        const erc20Home = new ethers.Contract(
            this.config.contracts.erc20Home.contractAddress,
            this.getERC20HomeABI(),
            wallet
        );

        const erc20Remote = new ethers.Contract(
            this.config.contracts.erc20Remote.contractAddress,
            this.getERC20RemoteABI(),
            wallet
        );

        return { erc20Home, erc20Remote };
    }

    /**
     * Test 1: Regular send from Home to Remote (user pays gas)
     * @param {ethers.Wallet} wallet - User wallet
     * @param {Object} contracts - Contract instances
     * @param {string} recipient - Recipient address
     * @param {string} amount - Amount to transfer
     */
    async testHomeToRemote(wallet, contracts, recipient, amount) {
        console.log('=== Test 1: Home to Remote (Regular transaction - user pays gas) ===');
        
        const { erc20Home } = contracts;

        // Step 1: Approve ERC20 tokens (user pays gas)
        console.log('Step 1: Approving ERC20 tokens...');
        // We need to approve the actual ERC20 token, not the ERC20Home contract
        const erc20Token = new ethers.Contract(
            '0x5425890298aed601595a70ab815c96711a31bc65', // USDC token address
            ['function approve(address spender, uint256 amount) returns (bool)'],
            wallet
        );
        const approveTx = await erc20Token.approve(this.config.contracts.erc20Home.contractAddress, amount);
        await approveTx.wait();
        console.log(`✓ Approved ${ethers.formatUnits(amount, 6)} USDC for ERC20Home`);
        console.log(`  Transaction hash: ${approveTx.hash}`);

        // Step 2: Send tokens from home to remote (user pays gas)
        console.log('Step 2: Sending tokens from Home to Remote...');
        
        const sendInput = {
            destinationBlockchainID: this.config.network.remote.blockchainId,
            destinationTokenTransferrerAddress: this.config.contracts.erc20Remote.contractAddress,
            recipient: recipient,
            primaryFeeTokenAddress: this.config.contracts.erc20Home.contractAddress,
            primaryFee: ethers.ZeroAddress,
            secondaryFee: ethers.ZeroAddress,
            requiredGasLimit: 200000,
            multiHopFallback: ethers.ZeroAddress
        };

        const sendTx = await erc20Home.send(sendInput, amount);
        const sendReceipt = await sendTx.wait();
        console.log(`✓ Sent ${ethers.formatUnits(amount, 6)} USDC from Home to Remote`);
        console.log(`  Transaction hash: ${sendReceipt.transactionHash}`);

        return sendReceipt;
    }

    /**
     * Test 2: Gasless send from Remote to Home (following EIP-712 pattern with AvaCloud forwarder)
     * @param {ethers.Wallet} wallet - User wallet
     * @param {Object} contracts - Contract instances
     * @param {string} recipient - Recipient address
     * @param {string} amount - Amount to transfer
     */
    async testGaslessSend(wallet, contracts, recipient, amount) {
        console.log('\n=== Test 2: Remote to Home (Gasless transaction - EIP-712) ===');
        
        const { erc20Remote } = contracts;

        // Step 1: Gasless approval of ERC20Remote tokens
        console.log('Step 1: Gasless approval of ERC20Remote tokens...');
        
        // Encode the approve function call data
        const approveFunctionData = erc20Remote.interface.encodeFunctionData('approve', [this.config.contracts.erc20Remote.contractAddress, amount]);
        
        // Get nonce from forwarder for approval
        const approveForwarder = new ethers.Contract(
            this.config.gasless.forwarder,
            ['function getNonce(address from) view returns (uint256)'],
            wallet
        );
        const approveNonce = await approveForwarder.getNonce(wallet.address);
        
        // Create EIP-712 structured data for approval
        const approveEip712Message = this.createEIP712Struct({
            nonce: approveNonce.toString(),
            from: wallet.address,
            to: this.config.contracts.erc20Remote.contractAddress,
            data: approveFunctionData,
            forwarderAddress: this.config.gasless.forwarder,
            requestSuffix: 'EMYIVHVJOTQUBEJLHAJCZLQ',
            chainId: 54414, // Innovomark subnet chain ID
            gas: '0xf4240' // 1000000 gas
        });
        
        console.log(`✓ Created EIP-712 structured data for approval`);
        console.log(`  Nonce: ${approveNonce}`);
        console.log(`  From: ${wallet.address}`);
        console.log(`  To: ${this.config.contracts.erc20Remote.contractAddress}`);
        console.log(`  Data: ${approveFunctionData}`);
        
        // Sign the approval EIP-712 message
        const approveDataToSign = this.createDataToSign(approveEip712Message);
        const approveSignature = await wallet.signTypedData(
            approveDataToSign.domain,
            { Message: approveDataToSign.types.Message },
            approveDataToSign.message
        );
        
        console.log(`✓ Signed approval EIP-712 message`);
        console.log(`  Signature: ${approveSignature}`);
        
        // Submit approval to relayer (AvaCloud)
        const approveRelayerRequest = this.prepareForSend({
            eip712Message: approveEip712Message,
            signData: approveSignature
        });
        
        const approveRelayerResponse = await this.sendRelayerTx(approveRelayerRequest, wallet.address);
        console.log(`✓ Approval relayer response received`);
        console.log(`  Transaction hash: ${approveRelayerResponse.result}`);

        // Wait a moment for approval transaction to be processed
        console.log('Waiting for approval transaction to be processed...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Step 2: Create the send input
        const sendInput = {
            destinationBlockchainID: this.config.network.home.blockchainId,
            destinationTokenTransferrerAddress: this.config.contracts.erc20Home.contractAddress,
            recipient: recipient,
            primaryFeeTokenAddress: this.config.contracts.erc20Remote.contractAddress,
            primaryFee: ethers.ZeroAddress,
            secondaryFee: ethers.ZeroAddress,
            requiredGasLimit: 200000,
            multiHopFallback: ethers.ZeroAddress
        };

        // Step 3: Create EIP-712 structured data for forwarder
        console.log('Step 3: Creating EIP-712 structured data for gasless send...');
        
        // Encode the function call data
        const functionData = erc20Remote.interface.encodeFunctionData('send', [sendInput, amount]);
        
        // Get nonce from forwarder
        const forwarder = new ethers.Contract(
            this.config.gasless.forwarder,
            ['function getNonce(address from) view returns (uint256)'],
            wallet
        );
        const nonce = await forwarder.getNonce(wallet.address);
        
        // Create EIP-712 structured data
        const eip712Message = this.createEIP712Struct({
            nonce: nonce.toString(),
            from: wallet.address,
            to: this.config.contracts.erc20Remote.contractAddress,
            data: functionData,
            forwarderAddress: this.config.gasless.forwarder,
            requestSuffix: 'EMYIVHVJOTQUBEJLHAJCZLQ',
            chainId: 54414, // Innovomark subnet chain ID
            gas: '0xf4240' // 1000000 gas
        });
        
        console.log(`✓ Created EIP-712 structured data`);
        console.log(`  Nonce: ${nonce}`);
        console.log(`  From: ${wallet.address}`);
        console.log(`  To: ${this.config.contracts.erc20Remote.contractAddress}`);
        console.log(`  Data: ${functionData}`);

        // Step 4: Sign the EIP-712 message
        console.log('Step 4: Signing EIP-712 message...');
        
        const dataToSign = this.createDataToSign(eip712Message);
        const signature = await wallet.signTypedData(
            dataToSign.domain,
            { Message: dataToSign.types.Message },
            dataToSign.message
        );
        
        console.log(`✓ Signed EIP-712 message`);
        console.log(`  Signature: ${signature}`);

        // Step 5: Submit to relayer (AvaCloud)
        console.log('Step 5: Submitting to AvaCloud relayer...');
        
        const relayerRequest = this.prepareForSend({
            eip712Message,
            signData: signature
        });
        
        // Submit to AvaCloud relayer
        const relayerResponse = await this.sendRelayerTx(relayerRequest, wallet.address);
        
        console.log(`✓ Relayer response received`);
        console.log(`  Transaction hash: ${relayerResponse.result}`);
        
        return {
            transactionHash: relayerResponse.result,
            status: 1,
            gasUsed: '1000000'
        };
    }

    /**
     * Create EIP-712 structured data for forwarder
     */
    createEIP712Struct({
        nonce,
        from,
        to,
        data,
        forwarderAddress,
        requestSuffix,
        chainId = 54414,
        gas = '0xf4240',
        domainName = 'innovomark',
        domainVersion = '1'
    }) {
        return {
            primaryType: 'Message',
            domain: {
                name: domainName,
                version: domainVersion,
                chainId,
                verifyingContract: forwarderAddress
            },
            types: {
                Message: [
                    { name: 'from', type: 'address' },
                    { name: 'to', type: 'address' },
                    { name: 'value', type: 'uint256' },
                    { name: 'gas', type: 'uint256' },
                    { name: 'nonce', type: 'uint256' },
                    { name: 'data', type: 'bytes' },
                    { name: 'validUntilTime', type: 'uint256' },
                    { name: requestSuffix, type: 'bytes32' }
                ],
                EIP712Domain: [
                    { name: 'name', type: 'string' },
                    { name: 'version', type: 'string' },
                    { name: 'chainId', type: 'uint256' },
                    { name: 'verifyingContract', type: 'address' }
                ]
            },
            message: {
                data,
                from,
                gas,
                nonce,
                to,
                validUntilTime: '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
                value: '0x0',
                [requestSuffix]: toHex(`bytes32 ${requestSuffix})`)
            }
        };
    }

    /**
     * Prepare relayer request
     */
    prepareForSend({ eip712Message, signData }) {
        return {
            domain: eip712Message.domain,
            types: eip712Message.types.Message,
            primaryType: eip712Message.primaryType,
            message: eip712Message.message,
            sign: signData
        };
    }

    /**
     * Create data to sign
     */
    createDataToSign(messageEIP712) {
        return {
            domain: messageEIP712.domain,
            types: messageEIP712.types,
            primaryType: messageEIP712.primaryType,
            message: messageEIP712.message
        };
    }

    /**
     * Send transaction to AvaCloud relayer
     */
    async sendRelayerTx(data, expectedAddress) {
        try {
            console.log(`Sending to relayer - From: ${data.message.from}, Nonce: ${data.message.nonce}`);
            
            const { message, domain, types, primaryType, sign } = data;
            
            // Verify the signature
            const actualAddress = ethers.verifyTypedData(
                domain,
                { [primaryType]: types },
                {
                    ...message,
                    [this.relayerConfig.suffix]: toHex(`bytes32 ${this.relayerConfig.suffix})`),
                },
                sign
            );
            
            console.log(`Expected Address: ${expectedAddress}, Actual Address: ${actualAddress}`);
            
            if (ethers.getAddress(actualAddress) !== ethers.getAddress(expectedAddress)) {
                throw new Error('Incorrect user public address recovered');
            }
            
            // Prepare payload for relayer
            const payload = `0x${Buffer.from(
                JSON.stringify({
                    forwardRequest: {
                        primaryType,
                        domain,
                        types: { [primaryType]: types },
                        message: {
                            ...message,
                            [this.relayerConfig.suffix]: toHex(`bytes32 ${this.relayerConfig.suffix})`),
                        },
                    },
                    metadata: {
                        signature: sign.substring(2),
                    },
                })
            ).toString('hex')}`;
            
            const body = {
                id: 1,
                jsonrpc: '2.0',
                method: 'eth_sendRawTransaction',
                params: [payload],
            };
            
            console.log(`Sending to relayer URL: ${this.relayerConfig.url}`);
            
            const response = await axios.post(this.relayerConfig.url, body, {
                auth: this.relayerConfig.auth,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            console.log(`Relayer response: ${JSON.stringify(response.data)}`);
            
            if (response.status !== 200) {
                throw new Error(`Relayer error: ${response.statusText}`);
            }
            
            return response.data;
            
        } catch (error) {
            console.error('Relayer error:', error.message);
            throw error;
        }
    }

    /**
     * Test 3: Regular send from Remote to Home (for comparison)
     * @param {ethers.Wallet} wallet - User wallet
     * @param {Object} contracts - Contract instances
     * @param {string} recipient - Recipient address
     * @param {string} amount - Amount to transfer
     */
    async testRegularSend(wallet, contracts, recipient, amount) {
        console.log('\n=== Test 3: Remote to Home (Regular transaction - for comparison) ===');
        
        const { erc20Remote } = contracts;

        // Step 1: Approve ERC20Remote tokens (user pays gas)
        console.log('Step 1: Approving ERC20Remote tokens...');
        const approveTx = await erc20Remote.approve(this.config.contracts.erc20Remote.contractAddress, amount);
        await approveTx.wait();
        console.log(`✓ Approved ${ethers.formatUnits(amount, 6)} USDC for ERC20Remote`);
        console.log(`  Transaction hash: ${approveTx.hash}`);

        // Step 2: Send tokens from remote to home (user pays gas)
        console.log('Step 2: Sending tokens from Remote to Home...');
        
        const sendInput = {
            destinationBlockchainID: this.config.network.home.blockchainId,
            destinationTokenTransferrerAddress: this.config.contracts.erc20Home.contractAddress,
            recipient: recipient,
            primaryFeeTokenAddress: this.config.contracts.erc20Remote.contractAddress,
            primaryFee: ethers.ZeroAddress,
            secondaryFee: ethers.ZeroAddress,
            requiredGasLimit: 200000,
            multiHopFallback: ethers.ZeroAddress
        };

        const sendTx = await erc20Remote.send(sendInput, amount);
        const sendReceipt = await sendTx.wait();
        console.log(`✓ Sent ${ethers.formatUnits(amount, 6)} USDC from Remote to Home`);
        console.log(`  Transaction hash: ${sendReceipt.transactionHash}`);

        return sendReceipt;
    }

    // ABI definitions
    getERC20HomeABI() {
        return [
            'function send(tuple(bytes32 destinationBlockchainID, address destinationTokenTransferrerAddress, address recipient, address primaryFeeTokenAddress, uint256 primaryFee, uint256 secondaryFee, uint256 requiredGasLimit, address multiHopFallback) input, uint256 amount)',
            'function approve(address spender, uint256 amount) returns (bool)'
        ];
    }

    getERC20RemoteABI() {
        return [
            'function send(tuple(bytes32 destinationBlockchainID, address destinationTokenTransferrerAddress, address recipient, address primaryFeeTokenAddress, uint256 primaryFee, uint256 secondaryFee, uint256 requiredGasLimit, address multiHopFallback) input, uint256 amount)',
            'function gaslessSend(tuple(bytes32 destinationBlockchainID, address destinationTokenTransferrerAddress, address recipient, address primaryFeeTokenAddress, uint256 primaryFee, uint256 secondaryFee, uint256 requiredGasLimit, address multiHopFallback) input, uint256 amount, uint256 nonce, uint64 expireSignatureAt, bytes calldata signature)',
            'function approve(address spender, uint256 amount) returns (bool)',
            'function balanceOf(address account) view returns (uint256)',
            'function getSignatory() view returns (address)',
            'function isNonceUsed(uint256 nonce) view returns (bool)'
        ];
    }
}

/**
 * Load configuration from deployment results
 * @param {string} deploymentResultsPath - Path to deployment results file
 * @returns {Object} - Configuration object
 */
function loadConfig(deploymentResultsPath = null) {
    const scriptDir = __dirname; // tests/flows/ictt
    const projectRoot = path.join(scriptDir, '..', '..', '..'); // Go up 3 levels to project root
    const defaultPath = path.join(projectRoot, 'deployment_gasless_results.json');
    
    const configPath = deploymentResultsPath || defaultPath;
    
    console.log(`Loading config from: ${configPath}`);
    
    if (!fs.existsSync(configPath)) {
        throw new Error(`Deployment results not found at: ${configPath}`);
    }
    
    const deploymentResults = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    console.log('Configuration loaded successfully:');
    console.log(`  ERC20Home: ${deploymentResults.deployment.contracts.erc20Home.contractAddress}`);
    console.log(`  ERC20Remote: ${deploymentResults.deployment.contracts.erc20Remote.contractAddress}`);
    console.log(`  Forwarder: ${deploymentResults.deployment.gasless.forwarder}`);
    console.log(`  Signatory: ${deploymentResults.deployment.gasless.signatory}`);
    
    return deploymentResults.deployment;
}

/**
 * Run gasless send tests
 * @param {string} recipientPrivateKey - Private key for the recipient
 */
async function runGaslessSendTests(recipientPrivateKey = null) {
    try {
        // Load configuration
        const config = loadConfig();
        
        // Use provided recipient private key or environment variable
        const testPrivateKey = recipientPrivateKey || process.env.PRIVATE_KEY || '0x8a22131111b07684e5df85ef89ffd5350ce106115207c818a3bba12470744eb4';
        
        // Initialize client
        const client = new GaslessSendClient(config);
        
        // Test parameters
        const recipientPrivateKeyForGasless = recipientPrivateKey || process.env.RECIPIENT_PRIVATE_KEY;
        if (!recipientPrivateKeyForGasless) {
            throw new Error('Recipient private key is required for gasless transactions. Please provide it as a parameter or set RECIPIENT_PRIVATE_KEY environment variable.');
        }
        
        // Create a temporary wallet to get the recipient address from the private key
        const tempWallet = new ethers.Wallet(recipientPrivateKeyForGasless);
        const recipient = tempWallet.address;
        const amount = ethers.parseUnits('0.1', 6); // 0.1 USDC (6 decimals)
        
        console.log('\n=== Starting Gasless Send Tests ===');
        console.log(`Test recipient: ${recipient}`);
        console.log(`Test amount: ${ethers.formatUnits(amount, 6)} USDC`);
        
        // Test 1: Home to Remote (Regular transaction)
        console.log('\n--- Test 1: Home to Remote (Regular transaction) ---');
        
        const homeWallet = client.importWallet(testPrivateKey, 'home');
        console.log(`Home wallet address: ${homeWallet.address}`);
        
        const homeContracts = client.initializeContracts(homeWallet, 'home');
        console.log('Home contracts initialized');
        
        const homeToRemoteReceipt = await client.testHomeToRemote(
            homeWallet, 
            homeContracts, 
            recipient, 
            amount
        );
        
        // Wait for cross-chain message processing
        console.log('\nWaiting for cross-chain message processing (15 seconds)...');
        await new Promise(resolve => setTimeout(resolve, 15000));
        
        // Test 2: Remote to Home (Gasless transaction)
        console.log('\n--- Test 2: Remote to Home (Gasless transaction) ---');
        
        // Use the same wallet that has funds for both operations
        const remoteWallet = client.importWallet(testPrivateKey, 'remote');
        console.log(`Remote wallet address: ${remoteWallet.address}`);
        
        const remoteContracts = client.initializeContracts(remoteWallet, 'remote');
        console.log('Remote contracts initialized');
        
        // Check balance of the recipient on ERC20Remote
        console.log('Checking balance of recipient on ERC20Remote...');
        let recipientBalance = 0n; // Use BigInt instead of ethers.ZeroAddress
        let retryCount = 0;
        const maxRetries = 10;
        
        while (recipientBalance < amount && retryCount < maxRetries) {
            recipientBalance = await remoteContracts.erc20Remote.balanceOf(recipient);
            console.log(`Attempt ${retryCount + 1}/${maxRetries}: Recipient balance = ${ethers.formatUnits(recipientBalance, 6)} USDC`);
            
            if (recipientBalance < amount) {
                console.log('Tokens not yet arrived for recipient, waiting 10 seconds...');
                await new Promise(resolve => setTimeout(resolve, 10000));
                retryCount++;
            }
        }
        
        if (recipientBalance < amount) {
            throw new Error(`Tokens did not arrive for recipient after ${maxRetries * 10} seconds. Final balance: ${ethers.formatUnits(recipientBalance, 6)} USDC`);
        }
        
        console.log(`✓ Tokens arrived for recipient! Balance: ${ethers.formatUnits(recipientBalance, 6)} USDC`);
        
        // Test gasless send (EIP-712 pattern with AvaCloud forwarder)
        // Use the recipient wallet for gasless send since it has the tokens
        const recipientWallet = client.importWallet(recipientPrivateKeyForGasless, 'remote');
        console.log(`Recipient wallet address: ${recipientWallet.address}`);
        
        const recipientContracts = client.initializeContracts(recipientWallet, 'remote');
        
        const gaslessSendReceipt = await client.testGaslessSend(
            recipientWallet, 
            recipientContracts, 
            recipient, // Send to self for testing
            amount
        );
        
        // Test 3: Regular send for comparison
        console.log('\n--- Test 3: Remote to Home (Regular transaction - for comparison) ---');
        const regularSendReceipt = await client.testRegularSend(
            recipientWallet, 
            recipientContracts, 
            recipient, // Send to self for testing
            amount
        );
        
        console.log('\n=== Gasless Send Tests Completed Successfully ===');
        console.log('Home to Remote transaction:', homeToRemoteReceipt.transactionHash);
        console.log('Remote to Home (Gasless):', gaslessSendReceipt.transactionHash);
        console.log('Remote to Home (Regular):', regularSendReceipt.transactionHash);
        
        return {
            homeToRemote: homeToRemoteReceipt,
            gaslessSend: gaslessSendReceipt,
            regularSend: regularSendReceipt
        };
        
    } catch (error) {
        console.error('Gasless send tests failed:', error);
        throw error;
    }
}

// Export for use in other modules
module.exports = {
    GaslessSendClient,
    loadConfig,
    runGaslessSendTests
};

// Run tests if this file is executed directly
if (require.main === module) {
    const recipientPrivateKey = process.argv[2] || null;
    
    console.log(`Running gasless send tests with recipient private key`);
    
    runGaslessSendTests(recipientPrivateKey)
        .then(() => {
            console.log('Tests completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Tests failed:', error);
            process.exit(1);
        });
} 