/**
 * MetaTxHelper - JavaScript/TypeScript helper for ICTT Native Meta-Transactions
 * 
 * This helper simplifies the process of creating and submitting meta-transactions
 * for the native meta-transaction ICTT contracts.
 */

import { ethers } from 'ethers';

export class MetaTxHelper {
    constructor(provider) {
        this.provider = provider;
    }

    /**
     * Get the EIP-712 domain for a contract
     */
    async getDomain(contractAddress, contractName = 'ERC20TokenHomeNativeMetaTx') {
        const network = await this.provider.getNetwork();
        return {
            name: contractName,
            version: '1.0.0',
            chainId: network.chainId,
            verifyingContract: contractAddress
        };
    }

    /**
     * EIP-712 types for different meta-transaction functions
     */
    getTypes() {
        return {
            Send: [
                { name: 'from', type: 'address' },
                { name: 'input', type: 'SendTokensInput' },
                { name: 'amount', type: 'uint256' },
                { name: 'nonce', type: 'uint256' },
                { name: 'deadline', type: 'uint256' }
            ],
            SendAndCall: [
                { name: 'from', type: 'address' },
                { name: 'input', type: 'SendAndCallInput' },
                { name: 'amount', type: 'uint256' },
                { name: 'nonce', type: 'uint256' },
                { name: 'deadline', type: 'uint256' }
            ],
            AddCollateral: [
                { name: 'from', type: 'address' },
                { name: 'remoteBlockchainID', type: 'bytes32' },
                { name: 'remoteTokenTransferrerAddress', type: 'address' },
                { name: 'amount', type: 'uint256' },
                { name: 'nonce', type: 'uint256' },
                { name: 'deadline', type: 'uint256' }
            ],
            SendTokensInput: [
                { name: 'destinationBlockchainID', type: 'bytes32' },
                { name: 'destinationTokenTransferrerAddress', type: 'address' },
                { name: 'recipient', type: 'address' },
                { name: 'primaryFeeTokenAddress', type: 'address' },
                { name: 'primaryFee', type: 'uint256' },
                { name: 'secondaryFee', type: 'uint256' },
                { name: 'requiredGasLimit', type: 'uint256' },
                { name: 'multiHopFallback', type: 'address' }
            ],
            SendAndCallInput: [
                { name: 'destinationBlockchainID', type: 'bytes32' },
                { name: 'destinationTokenTransferrerAddress', type: 'address' },
                { name: 'recipientContract', type: 'address' },
                { name: 'requiredGasLimit', type: 'uint256' },
                { name: 'recipientGasLimit', type: 'uint256' },
                { name: 'multiHopFallback', type: 'address' },
                { name: 'fallbackRecipient', type: 'address' },
                { name: 'primaryFeeTokenAddress', type: 'address' },
                { name: 'primaryFee', type: 'uint256' },
                { name: 'secondaryFee', type: 'uint256' },
                { name: 'recipientPayload', type: 'bytes' }
            ]
        };
    }

    /**
     * Create a meta-transaction signature for sending tokens
     */
    async createSendSignature(signer, contractAddress, input, amount, options = {}) {
        const { deadline = 0, contractName } = options;
        
        const domain = await this.getDomain(contractAddress, contractName);
        const types = this.getTypes();
        
        // Get contract instance to fetch nonce
        const contract = new ethers.Contract(contractAddress, [
            'function getNonce(address user) external view returns (uint256)'
        ], this.provider);
        
        const userAddress = await signer.getAddress();
        const nonce = await contract.getNonce(userAddress);
        
        const metaTxData = {
            from: userAddress,
            input,
            amount,
            nonce,
            deadline
        };
        
        const signature = await signer._signTypedData(domain, types, metaTxData);
        
        return {
            metaTxData,
            signature,
            domain,
            types
        };
    }

    /**
     * Create a meta-transaction signature for sending tokens with call
     */
    async createSendAndCallSignature(signer, contractAddress, input, amount, options = {}) {
        const { deadline = 0, contractName } = options;
        
        const domain = await this.getDomain(contractAddress, contractName);
        const types = this.getTypes();
        
        // Get contract instance to fetch nonce
        const contract = new ethers.Contract(contractAddress, [
            'function getNonce(address user) external view returns (uint256)'
        ], this.provider);
        
        const userAddress = await signer.getAddress();
        const nonce = await contract.getNonce(userAddress);
        
        const metaTxData = {
            from: userAddress,
            input,
            amount,
            nonce,
            deadline
        };
        
        const signature = await signer._signTypedData(domain, types, metaTxData);
        
        return {
            metaTxData,
            signature,
            domain,
            types
        };
    }

    /**
     * Create a meta-transaction signature for adding collateral
     */
    async createAddCollateralSignature(signer, contractAddress, remoteBlockchainID, remoteTokenTransferrerAddress, amount, options = {}) {
        const { deadline = 0, contractName } = options;
        
        const domain = await this.getDomain(contractAddress, contractName);
        const types = this.getTypes();
        
        // Get contract instance to fetch nonce
        const contract = new ethers.Contract(contractAddress, [
            'function getNonce(address user) external view returns (uint256)'
        ], this.provider);
        
        const userAddress = await signer.getAddress();
        const nonce = await contract.getNonce(userAddress);
        
        const metaTxData = {
            from: userAddress,
            remoteBlockchainID,
            remoteTokenTransferrerAddress,
            amount,
            nonce,
            deadline
        };
        
        const signature = await signer._signTypedData(domain, types, metaTxData);
        
        return {
            metaTxData,
            signature,
            domain,
            types
        };
    }

    /**
     * Submit meta-transaction to relayer endpoint
     */
    async submitMetaTransaction(relayerUrl, contractAddress, functionName, params) {
        const response = await fetch(relayerUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contract: contractAddress,
                function: functionName,
                params
            })
        });
        
        if (!response.ok) {
            throw new Error(`Relayer error: ${response.statusText}`);
        }
        
        return await response.json();
    }

    /**
     * Complete flow: Create signature and submit to relayer for send
     */
    async metaSend(signer, contractAddress, input, amount, relayerUrl, options = {}) {
        const { metaTxData, signature } = await this.createSendSignature(
            signer, contractAddress, input, amount, options
        );
        
        return await this.submitMetaTransaction(relayerUrl, contractAddress, 'metaSend', {
            from: metaTxData.from,
            input: metaTxData.input,
            amount: metaTxData.amount,
            deadline: metaTxData.deadline,
            signature
        });
    }

    /**
     * Complete flow: Create signature and submit to relayer for sendAndCall
     */
    async metaSendAndCall(signer, contractAddress, input, amount, relayerUrl, options = {}) {
        const { metaTxData, signature } = await this.createSendAndCallSignature(
            signer, contractAddress, input, amount, options
        );
        
        return await this.submitMetaTransaction(relayerUrl, contractAddress, 'metaSendAndCall', {
            from: metaTxData.from,
            input: metaTxData.input,
            amount: metaTxData.amount,
            deadline: metaTxData.deadline,
            signature
        });
    }

    /**
     * Complete flow: Create signature and submit to relayer for addCollateral
     */
    async metaAddCollateral(signer, contractAddress, remoteBlockchainID, remoteTokenTransferrerAddress, amount, relayerUrl, options = {}) {
        const { metaTxData, signature } = await this.createAddCollateralSignature(
            signer, contractAddress, remoteBlockchainID, remoteTokenTransferrerAddress, amount, options
        );
        
        return await this.submitMetaTransaction(relayerUrl, contractAddress, 'metaAddCollateral', {
            from: metaTxData.from,
            remoteBlockchainID: metaTxData.remoteBlockchainID,
            remoteTokenTransferrerAddress: metaTxData.remoteTokenTransferrerAddress,
            amount: metaTxData.amount,
            deadline: metaTxData.deadline,
            signature
        });
    }
}

/**
 * Helper function to create SendTokensInput struct
 */
export function createSendTokensInput({
    destinationBlockchainID,
    destinationTokenTransferrerAddress,
    recipient,
    primaryFeeTokenAddress,
    primaryFee,
    secondaryFee = 0,
    requiredGasLimit,
    multiHopFallback = ethers.constants.AddressZero
}) {
    return {
        destinationBlockchainID,
        destinationTokenTransferrerAddress,
        recipient,
        primaryFeeTokenAddress,
        primaryFee,
        secondaryFee,
        requiredGasLimit,
        multiHopFallback
    };
}

/**
 * Helper function to create SendAndCallInput struct
 */
export function createSendAndCallInput({
    destinationBlockchainID,
    destinationTokenTransferrerAddress,
    recipientContract,
    requiredGasLimit,
    recipientGasLimit,
    multiHopFallback = ethers.constants.AddressZero,
    fallbackRecipient,
    primaryFeeTokenAddress,
    primaryFee,
    secondaryFee = 0,
    recipientPayload = '0x'
}) {
    return {
        destinationBlockchainID,
        destinationTokenTransferrerAddress,
        recipientContract,
        requiredGasLimit,
        recipientGasLimit,
        multiHopFallback,
        fallbackRecipient,
        primaryFeeTokenAddress,
        primaryFee,
        secondaryFee,
        recipientPayload
    };
}

// Usage example:
/*
import { MetaTxHelper, createSendTokensInput } from './MetaTxHelper.js';

const helper = new MetaTxHelper(provider);

// Create input for USDC transfer from C-Chain to Subnet
const sendInput = createSendTokensInput({
    destinationBlockchainID: subnetBlockchainId,
    destinationTokenTransferrerAddress: remoteContractAddress,
    recipient: userAddress,
    primaryFeeTokenAddress: usdcAddress,
    primaryFee: ethers.utils.parseUnits('0.1', 6), // 0.1 USDC fee
    requiredGasLimit: 400000
});

// Submit gasless transaction
const result = await helper.metaSend(
    signer,
    homeContractAddress,
    sendInput,
    ethers.utils.parseUnits('10', 6), // 10 USDC
    'https://your-relayer-endpoint.com/api/submit-meta-tx'
);

console.log('Transaction hash:', result.txHash);
*/