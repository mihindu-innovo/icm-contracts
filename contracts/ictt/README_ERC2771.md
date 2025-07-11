# ERC-2771 Meta-Transaction Support for ICTT

This document explains how to use the ERC-2771 compliant versions of ICTT (Inter-Chain Token Transfer) contracts to enable gasless meta-transactions for cross-chain USDC transfers.

## Overview

The ERC-2771 compliant contracts allow users to interact with ICTT without paying gas fees directly. Instead, a trusted relayer (like OpenZeppelin Defender) can pay the gas fees while the user only needs to sign a meta-transaction.

## New Contracts

### Home Contracts (for C-Chain)
- `ERC20TokenHomeERC2771.sol` - Non-upgradeable ERC-2771 compliant home contract
- `ERC20TokenHomeUpgradeableERC2771.sol` - Upgradeable ERC-2771 compliant home contract  
- `TokenHomeERC2771.sol` - Base abstract contract with ERC-2771 support

### Remote Contracts (for Subnet)
- `ERC20TokenRemoteERC2771.sol` - Non-upgradeable ERC-2771 compliant remote contract
- `ERC20TokenRemoteUpgradeableERC2771.sol` - Upgradeable ERC-2771 compliant remote contract
- `TokenRemoteERC2771.sol` - Base abstract contract with ERC-2771 support

### Forwarder Contract
- `MinimalForwarder.sol` - Trusted forwarder contract for executing meta-transactions

## Key Features

1. **Gasless Transactions**: Users can transfer USDC between C-Chain and Subnet without holding native tokens for gas
2. **Trusted Forwarders**: Support for multiple trusted forwarder contracts
3. **EIP-712 Signatures**: Secure typed data signing for meta-transactions
4. **Backwards Compatibility**: Original functionality remains unchanged

## Usage Example

### 1. Deploy Contracts

First, deploy the contracts with a trusted forwarder:

```solidity
// Deploy the forwarder
MinimalForwarder forwarder = new MinimalForwarder();

// Deploy Home contract on C-Chain
ERC20TokenHomeERC2771 home = new ERC20TokenHomeERC2771(
    teleporterRegistryAddress,
    teleporterManager,
    minTeleporterVersion,
    usdcTokenAddress, // Circle USDC address
    6, // USDC decimals
    address(forwarder) // Trusted forwarder
);

// Deploy Remote contract on Subnet
ERC20TokenRemoteERC2771 remote = new ERC20TokenRemoteERC2771(
    settings, // TokenRemoteSettings
    "Subnet USDC",
    "USDC.e",
    6, // Decimals
    address(forwarder) // Trusted forwarder
);
```

### 2. Enable Meta-Transactions

```javascript
// Example using ethers.js and EIP-712
const domain = {
    name: 'MinimalForwarder',
    version: '0.0.1',
    chainId: await provider.getNetwork().chainId,
    verifyingContract: forwarder.address
};

const types = {
    ForwardRequestData: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'gas', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint48' },
        { name: 'data', type: 'bytes' }
    ]
};

// Prepare transaction data
const data = home.interface.encodeFunctionData('send', [
    {
        destinationBlockchainID: subnetBlockchainId,
        destinationTokenTransferrerAddress: remote.address,
        recipient: userAddress,
        primaryFeeTokenAddress: usdcAddress,
        primaryFee: feeAmount,
        secondaryFee: 0,
        requiredGasLimit: 400000,
        multiHopFallback: ethers.constants.AddressZero
    },
    ethers.utils.parseUnits('10', 6) // 10 USDC
]);

const request = {
    from: userAddress,
    to: home.address,
    value: 0,
    gas: 500000,
    nonce: await forwarder.getNonce(userAddress),
    deadline: 0, // No deadline
    data: data
};

// User signs the meta-transaction
const signature = await signer._signTypedData(domain, types, request);

// Relayer executes the meta-transaction
await forwarder.execute(request, signature);
```

### 3. Transfer Flow

1. **User Approval**: User approves USDC to the home contract (this can also be done via meta-transaction if USDC supports ERC-2612)
2. **Meta-Transaction**: User signs a meta-transaction for the transfer
3. **Relayer Execution**: Relayer submits the meta-transaction to the forwarder
4. **Cross-Chain Transfer**: Home contract locks USDC and sends message to remote
5. **Subnet Minting**: Remote contract mints equivalent USDC on subnet

## Security Considerations

1. **Trusted Forwarders**: Only use verified and audited forwarder contracts
2. **Signature Validation**: Always verify EIP-712 signatures before execution
3. **Nonce Management**: Ensure proper nonce handling to prevent replay attacks
4. **Gas Limits**: Set appropriate gas limits to prevent DoS attacks

## Integration with Relayer Services

### OpenZeppelin Defender

```javascript
// Using Defender Relayer
const { Defender } = require('@openzeppelin/defender-sdk');

const client = new Defender({
    relayerApiKey: process.env.RELAYER_API_KEY,
    relayerApiSecret: process.env.RELAYER_API_SECRET
});

const tx = await client.relaySigner.sendTransaction({
    to: forwarder.address,
    data: forwarder.interface.encodeFunctionData('execute', [request, signature]),
    gasLimit: 600000
});
```

## Benefits

1. **Improved UX**: Users don't need native tokens for gas
2. **Easier Onboarding**: Simplified user experience for cross-chain transfers
3. **Cost Efficiency**: Relayers can optimize gas costs across multiple transactions
4. **Scalability**: Reduces barriers to adoption on new subnets

## Migration from Original Contracts

The new contracts maintain the same interface as the original contracts, so existing integrations can be updated by:

1. Deploying new ERC-2771 compliant contracts
2. Updating contract addresses in your application
3. Adding meta-transaction support to your frontend
4. Setting up relayer infrastructure

## Testing

Test the contracts using the provided `MinimalForwarder` contract:

```solidity
// Test meta-transaction execution
ForwardRequestData memory request = ForwardRequestData({
    from: user,
    to: address(homeContract),
    value: 0,
    gas: 400000,
    nonce: forwarder.getNonce(user),
    deadline: 0,
    data: abi.encodeCall(homeContract.send, (sendInput, amount))
});

bytes memory signature = signMetaTransaction(request, userPrivateKey);
(bool success,) = forwarder.execute(request, signature);
require(success, "Meta-transaction failed");
```

For more examples and detailed integration guides, see the test files and documentation in the repository.