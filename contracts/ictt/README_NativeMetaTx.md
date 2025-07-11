# Native Meta-Transaction Support for ICTT with Ava Cloud

This document explains how to use the native meta-transaction versions of ICTT contracts that work directly with Ava Cloud's relayer infrastructure, eliminating the need for separate forwarder contracts.

## Overview

The native meta-transaction approach directly integrates EIP-712 signature verification into the ICTT contracts themselves. This is more efficient and better suited for Ava Cloud's native relayer that operates within the subnet infrastructure.

## Key Advantages over ERC-2771 Forwarder Pattern

1. **No Forwarder Contract**: Eliminates the need for separate forwarder contract deployment and management
2. **Lower Gas Costs**: Direct execution without additional contract calls
3. **Simpler Architecture**: Fewer moving parts and potential failure points
4. **Ava Cloud Integration**: Designed specifically for Ava Cloud's native relayer capabilities
5. **Better Performance**: No extra hops through forwarder contracts

## Contracts

### Home Contract (for C-Chain)
- `ERC20TokenHomeNativeMetaTx.sol` - Home contract with native meta-transaction support

### Remote Contract (for Subnet) 
- `ERC20TokenRemoteNativeMetaTx.sol` - Remote contract with native meta-transaction support

## How It Works

1. **User Signs Meta-Transaction**: User signs an EIP-712 structured message containing transaction details
2. **Relayer Submits**: Ava Cloud relayer calls the `metaSend` or `metaSendAndCall` functions with the signature
3. **Contract Validates**: Contract verifies the signature and executes the transaction as the original signer
4. **Cross-Chain Transfer**: Normal ICTT flow proceeds with the verified user as the sender

## Usage Example

### 1. Deploy Contracts

```solidity
// Deploy Home contract on C-Chain
ERC20TokenHomeNativeMetaTx home = new ERC20TokenHomeNativeMetaTx(
    teleporterRegistryAddress,
    teleporterManager,
    minTeleporterVersion,
    usdcTokenAddress, // Circle USDC address
    6 // USDC decimals
);

// Deploy Remote contract on Subnet
ERC20TokenRemoteNativeMetaTx remote = new ERC20TokenRemoteNativeMetaTx(
    settings, // TokenRemoteSettings
    "Subnet USDC",
    "USDC.e",
    6 // Decimals
);
```

### 2. Frontend Integration

```javascript
// EIP-712 Domain
const domain = {
    name: 'ERC20TokenHomeNativeMetaTx',
    version: '1.0.0',
    chainId: await provider.getNetwork().chainId,
    verifyingContract: home.address
};

// EIP-712 Types
const types = {
    Send: [
        { name: 'from', type: 'address' },
        { name: 'input', type: 'SendTokensInput' },
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
    ]
};

// Prepare transaction data
const sendInput = {
    destinationBlockchainID: subnetBlockchainId,
    destinationTokenTransferrerAddress: remote.address,
    recipient: userAddress,
    primaryFeeTokenAddress: usdcAddress,
    primaryFee: feeAmount,
    secondaryFee: 0,
    requiredGasLimit: 400000,
    multiHopFallback: ethers.constants.AddressZero
};

const metaTxData = {
    from: userAddress,
    input: sendInput,
    amount: ethers.utils.parseUnits('10', 6), // 10 USDC
    nonce: await home.getNonce(userAddress),
    deadline: 0 // No deadline
};

// User signs the meta-transaction
const signature = await signer._signTypedData(domain, types, metaTxData);

// Submit to Ava Cloud relayer
const response = await fetch('/api/submit-meta-tx', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        contract: home.address,
        function: 'metaSend',
        params: {
            from: userAddress,
            input: sendInput,
            amount: metaTxData.amount,
            deadline: metaTxData.deadline,
            signature: signature
        }
    })
});
```

### 3. Ava Cloud Relayer Integration

```javascript
// Relayer service endpoint
app.post('/api/submit-meta-tx', async (req, res) => {
    const { contract, function: functionName, params } = req.body;
    
    // Get contract instance
    const contractInstance = new ethers.Contract(contract, abi, relayerSigner);
    
    // Execute meta-transaction
    try {
        const tx = await contractInstance[functionName](
            params.from,
            params.input,
            params.amount,
            params.deadline,
            params.signature
        );
        
        res.json({ success: true, txHash: tx.hash });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});
```

## Available Meta-Transaction Functions

### Home Contract Functions

1. **`metaSend`** - Send tokens to remote chain
   ```solidity
   function metaSend(
       address from,
       SendTokensInput calldata input,
       uint256 amount,
       uint256 deadline,
       bytes calldata signature
   ) external
   ```

2. **`metaSendAndCall`** - Send tokens with contract call
   ```solidity
   function metaSendAndCall(
       address from,
       SendAndCallInput calldata input,
       uint256 amount,
       uint256 deadline,
       bytes calldata signature
   ) external
   ```

3. **`metaAddCollateral`** - Add collateral for remote
   ```solidity
   function metaAddCollateral(
       address from,
       bytes32 remoteBlockchainID,
       address remoteTokenTransferrerAddress,
       uint256 amount,
       uint256 deadline,
       bytes calldata signature
   ) external
   ```

### Remote Contract Functions

1. **`metaSend`** - Send tokens back to home or other remote
2. **`metaSendAndCall`** - Send tokens with contract call

## Transfer Flow Example

### C-Chain to Subnet (Gasless)

1. **User Approval**: User approves USDC to home contract
2. **Sign Meta-Tx**: User signs meta-transaction for transfer
3. **Relayer Execution**: Ava Cloud relayer calls `home.metaSend()`
4. **Signature Verification**: Contract verifies signature and executes as user
5. **USDC Lock**: Home contract locks user's USDC
6. **Cross-Chain Message**: Teleporter message sent to subnet
7. **Token Mint**: Remote contract mints USDC on subnet

### Subnet to C-Chain (Gasless)

1. **Sign Meta-Tx**: User signs meta-transaction on subnet
2. **Relayer Execution**: Ava Cloud relayer calls `remote.metaSend()`
3. **Token Burn**: Remote contract burns user's subnet USDC
4. **Cross-Chain Message**: Teleporter message sent to C-Chain
5. **USDC Release**: Home contract releases USDC to user

## Security Features

1. **EIP-712 Signatures**: Structured data signing prevents signature reuse
2. **Nonce Management**: Built-in replay protection
3. **Deadline Support**: Optional transaction expiration
4. **Signature Recovery**: Cryptographic verification of transaction authorization
5. **Gas Limit Protection**: Prevents DoS attacks

## Error Handling

```solidity
// Common error cases
require(deadline == 0 || deadline >= block.timestamp, "expired");
require(signer == from, "invalid signature");
require(success, "meta-transaction failed");
```

## Benefits for Your Use Case

1. **Ava Cloud Native**: Designed specifically for your existing relayer infrastructure
2. **Subnet Only Relayer**: Works perfectly with subnet-only relayer setup
3. **No Additional Deployment**: No forwarder contracts to deploy and manage
4. **Lower Costs**: Fewer contract interactions = lower gas costs
5. **Better UX**: Direct integration with your existing infrastructure

## Migration Strategy

1. Deploy the new native meta-transaction contracts
2. Update your frontend to use the new signing format
3. Modify your Ava Cloud relayer to call the `meta*` functions
4. Test thoroughly on testnet
5. Migrate users gradually

This approach is much cleaner for your specific setup with Ava Cloud's native relayer and eliminates the complexity of the traditional ERC-2771 forwarder pattern.