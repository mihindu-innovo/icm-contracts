const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Helper function to convert string to hex (equivalent to viem's toHex)
function toHex(value) {
    return ethers.hexlify(ethers.toUtf8Bytes(value));
}

/**
 * Gasless Only Test Client
 * Tests only the gasless send functionality without requiring Home to Remote transfer
 */
class GaslessOnlyTestClient {
    constructor(config) {
        this.config = config;
        
        // Initialize providers (ethers v6)
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
     */
    importWallet(privateKey) {
        if (privateKey.startsWith('0x')) {
            privateKey = privateKey.slice(2);
        }
        return new ethers.Wallet(privateKey, this.remoteProvider);
    }

    /**
     * Initialize contracts with wallet
     */
    initializeContracts(wallet) {
        const erc20Remote = new ethers.Contract(
            this.config.contracts.erc20Remote.contractAddress,
            this.getERC20RemoteABI(),
            wallet
        );

        return { erc20Remote };
    }

    /**
     * Test gasless send from Remote to Home
     */
    async testGaslessSend(wallet, contracts, recipient, amount) {
        console.log('\n=== Testing Gasless Send from Remote to Home ===');
        
        const { erc20Remote } = contracts;

        // Step 1: Check balance and allowance
        console.log('Step 1: Checking balance and allowance...');
        const balance = await erc20Remote.balanceOf(wallet.address);
        console.log(`Balance: ${ethers.formatUnits(balance, 6)} USDC`);
        
        if (balance < amount) {
            throw new Error(`Insufficient balance. Required: ${ethers.formatUnits(amount, 6)}, Got: ${ethers.formatUnits(balance, 6)}`);
        }

        // Step 1.5: Check and set signatory if needed
        console.log('Step 1.5: Checking signatory configuration...');
        try {
            const currentSignatory = await erc20Remote.getSignatory();
            console.log(`Current signatory: ${currentSignatory}`);
            
            if (currentSignatory === ethers.ZeroAddress || currentSignatory !== wallet.address) {
                console.log(`Setting signatory to wallet address: ${wallet.address}`);
                const setSignatoryTx = await erc20Remote.setSignatory(wallet.address);
                await setSignatoryTx.wait();
                console.log(`✓ Signatory set to: ${wallet.address}`);
            } else {
                console.log(`✓ Signatory already correctly set to: ${wallet.address}`);
            }
        } catch (error) {
            console.log('Could not check/set signatory:', error.message);
        }

        // Step 2: Gasless approval
        console.log('Step 2: Gasless approval of ERC20Remote tokens...');
        
        const approveFunctionData = erc20Remote.interface.encodeFunctionData('approve', [this.config.contracts.erc20Remote.contractAddress, amount]);
        
        const approveForwarder = new ethers.Contract(
            this.config.gasless.forwarder,
            ['function getNonce(address from) view returns (uint256)'],
            wallet
        );
        const approveNonce = await approveForwarder.getNonce(wallet.address);
        
        const approveEip712Message = this.createEIP712Struct({
            nonce: approveNonce.toString(),
            from: wallet.address,
            to: this.config.contracts.erc20Remote.contractAddress,
            data: approveFunctionData,
            forwarderAddress: this.config.gasless.forwarder,
            requestSuffix: 'EMYIVHVJOTQUBEJLHAJCZLQ',
            chainId: 54414
        });
        
        const approveSignature = await wallet.signTypedData(
            approveEip712Message.domain,
            { Message: approveEip712Message.types.Message },
            approveEip712Message.message
        );
        
        const approveRelayerRequest = this.prepareForSend({
            eip712Message: approveEip712Message,
            signData: approveSignature
        });
        
        const approveRelayerResponse = await this.sendRelayerTx(approveRelayerRequest, wallet.address);
        console.log(`✓ Approval relayer response received`);
        console.log(`  Transaction hash: ${approveRelayerResponse.result}`);

        // Wait for approval transaction to be processed
        console.log('Waiting for approval transaction to be processed...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Check allowance after approval
        console.log('Checking allowance after approval...');
        let allowance = await erc20Remote.allowance(wallet.address, this.config.contracts.erc20Remote.contractAddress);
        console.log(`Allowance: ${ethers.formatUnits(allowance, 6)} USDC`);
        
        if (allowance < amount) {
            console.log('Gasless approval failed or not processed. Attempting regular (user-paid) approval...');
            try {
                const approveTx = await erc20Remote.approve(this.config.contracts.erc20Remote.contractAddress, amount);
                await approveTx.wait();
                console.log(`✓ Regular approval transaction sent. Hash: ${approveTx.hash}`);
                
                await new Promise(resolve => setTimeout(resolve, 3000));
                
            } catch (error) {
                console.error('Regular approval failed:', error.message);
                throw error;
            }
            allowance = await erc20Remote.allowance(wallet.address, this.config.contracts.erc20Remote.contractAddress);
            console.log(`Allowance after regular approval: ${ethers.formatUnits(allowance, 6)} USDC`);
        }
        
        if (allowance < amount) {
            throw new Error(`Insufficient allowance. Required: ${ethers.formatUnits(amount, 6)}, Got: ${ethers.formatUnits(allowance, 6)}`);
        }

        // Step 3: Gasless send
        console.log('Step 3: Gasless send from Remote to Home...');
        
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

        const forwarder = new ethers.Contract(
            this.config.gasless.forwarder,
            ['function getNonce(address from) view returns (uint256)'],
            wallet
        );
        const nonce = await forwarder.getNonce(wallet.address);
        
        // For ERC2771, we don't need to create a custom signature
        // The forwarder handles the signature validation
        const functionData = erc20Remote.interface.encodeFunctionData('gaslessSend', [
            sendInput, 
            amount, 
            nonce, 
            '0xffffffffffffffff', // expireSignatureAt (max uint64)
            '0x' // Empty signature since forwarder handles validation
        ]);
        
        console.log('Debug: Function data for gaslessSend:');
        console.log(`  Function data: ${functionData}`);
        console.log(`  Send input: ${JSON.stringify(sendInput, null, 2)}`);
        console.log(`  Amount: ${ethers.formatUnits(amount, 6)} USDC`);
        console.log(`  Nonce: ${nonce}`);
        console.log(`  Using ERC2771 forwarder pattern - no custom signature needed`);
        
        const eip712Message = this.createEIP712Struct({
            nonce: nonce.toString(),
            from: wallet.address,
            to: this.config.contracts.erc20Remote.contractAddress,
            data: functionData,
            forwarderAddress: this.config.gasless.forwarder,
            requestSuffix: 'EMYIVHVJOTQUBEJLHAJCZLQ',
            chainId: 54414
        });
        
        const relayerSignature = await wallet.signTypedData(
            eip712Message.domain,
            { Message: eip712Message.types.Message },
            eip712Message.message
        );
        
        const relayerRequest = this.prepareForSend({
            eip712Message,
            signData: relayerSignature
        });
        
        const relayerResponse = await this.sendRelayerTx(relayerRequest, wallet.address);
        
        console.log(`✓ Gasless send relayer response received`);
        console.log(`  Transaction hash: ${relayerResponse.result}`);
        
        // Wait for transaction to be processed and check status
        console.log('Waiting for gasless send transaction to be processed...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        // Try to get transaction receipt
        try {
            const receipt = await this.remoteProvider.getTransactionReceipt(relayerResponse.result);
            console.log('Transaction receipt:');
            console.log(`  Status: ${receipt.status === 1 ? 'Success' : 'Failed'}`);
            console.log(`  Gas used: ${receipt.gasUsed.toString()}`);
            console.log(`  Block number: ${receipt.blockNumber}`);
            
            if (receipt.status === 0) {
                console.log('❌ Transaction failed on blockchain');
                // Try to get the transaction to see if there are any logs
                const tx = await this.remoteProvider.getTransaction(relayerResponse.result);
                console.log(`Transaction details: ${JSON.stringify(tx, null, 2)}`);
            } else {
                console.log('✅ Transaction succeeded on blockchain');
            }
        } catch (error) {
            console.log('Could not get transaction receipt:', error.message);
        }
        
        return {
            transactionHash: relayerResponse.result,
            status: 1
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
        gas = '0x0',
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
     * Send transaction to AvaCloud relayer
     */
    async sendRelayerTx(data, expectedAddress) {
        try {
            console.log(`Sending to relayer - From: ${data.message.from}, Nonce: ${data.message.nonce}`);
            
            const { message, domain, types, primaryType, sign } = data;
            
            const actualAddress = ethers.verifyTypedData(
                domain,
                { [primaryType]: types },
                message,
                sign
            );
            
            console.log(`Expected Address: ${expectedAddress}, Actual Address: ${actualAddress}`);
            
            if (ethers.getAddress(actualAddress) !== ethers.getAddress(expectedAddress)) {
                throw new Error('Incorrect user public address recovered');
            }
            
            const payload = `0x${Buffer.from(
                JSON.stringify({
                    forwardRequest: {
                        primaryType,
                        domain,
                        types: { [primaryType]: types },
                        message: message,
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
                throw new Error(`Relayer error: ${response.statusText} - ${JSON.stringify(response.data)}`);
            }
            
            return response.data;
            
        } catch (error) {
            console.error('Relayer error:', error.message);
            if (error.response) {
                console.error('Response data:', JSON.stringify(error.response.data, null, 2));
            }
            throw error;
        }
    }

    // ABI definitions
    getERC20RemoteABI() {
        return [
            'function gaslessSend(tuple(bytes32 destinationBlockchainID, address destinationTokenTransferrerAddress, address recipient, address primaryFeeTokenAddress, uint256 primaryFee, uint256 secondaryFee, uint256 requiredGasLimit, address multiHopFallback) input, uint256 amount, uint256 nonce, uint64 expireSignatureAt, bytes calldata signature)',
            'function approve(address spender, uint256 amount) returns (bool)',
            'function allowance(address owner, address spender) view returns (uint256)',
            'function balanceOf(address account) view returns (uint256)',
            'function getSignatory() view returns (address)',
            'function setSignatory(address newSignatory) external'
        ];
    }
}

/**
 * Load configuration from deployment results
 */
function loadConfig() {
    const scriptDir = __dirname;
    const projectRoot = path.join(scriptDir, '..', '..', '..');
    const configPath = path.join(projectRoot, 'deployment_gasless_results.json');
    
    console.log(`Loading config from: ${configPath}`);
    
    if (!fs.existsSync(configPath)) {
        throw new Error(`Deployment results not found at: ${configPath}`);
    }
    
    const deploymentResults = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    console.log('Configuration loaded successfully:');
    console.log(`  ERC20Remote: ${deploymentResults.deployment.contracts.erc20Remote.contractAddress}`);
    console.log(`  Forwarder: ${deploymentResults.deployment.gasless.forwarder}`);
    
    return deploymentResults.deployment;
}

/**
 * Run gasless only test
 */
async function runGaslessOnlyTest(recipientPrivateKey) {
    try {
        const config = loadConfig();
        const client = new GaslessOnlyTestClient(config);
        
        const wallet = client.importWallet(recipientPrivateKey);
        console.log(`Testing with wallet: ${wallet.address}`);
        
        const contracts = client.initializeContracts(wallet);
        const amount = ethers.parseUnits('0.000001', 6); // Use smaller amount to match available balance
        
        console.log(`Test amount: ${ethers.formatUnits(amount, 6)} USDC`);
        
        const result = await client.testGaslessSend(wallet, contracts, wallet.address, amount);
        
        console.log('\n=== Gasless Only Test Completed Successfully ===');
        console.log('Gasless send transaction:', result.transactionHash);
        
        return result;
        
    } catch (error) {
        console.error('Gasless only test failed:', error);
        throw error;
    }
}

// Run test if this file is executed directly
if (require.main === module) {
    const recipientPrivateKey = process.argv[2] || null;
    
    if (!recipientPrivateKey) {
        console.error('Please provide a recipient private key as a parameter');
        process.exit(1);
    }
    
    console.log(`Running gasless only test with recipient private key`);
    
    runGaslessOnlyTest(recipientPrivateKey)
        .then(() => {
            console.log('Test completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Test failed:', error);
            process.exit(1);
        });
} 