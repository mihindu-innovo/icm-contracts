# Gasless ERC20 Bridge Test

This directory contains test files that demonstrate gasless ERC20 bridge functionality between the C-Chain and Innovo subnet using the AvaCloud relayer infrastructure.

## Overview

The gasless bridge allows users to:
1. **Chain to Innovo**: User pays gas for approval and transfer, tokens are locked on C-Chain and minted on Innovo
2. **Innovo to Chain**: User creates gasless transactions via relayer, tokens are burned on Innovo and unlocked on C-Chain

## Architecture

```
C-Chain (Home)                    Innovo Subnet (Remote)
┌─────────────────┐              ┌─────────────────┐
│ ERC20TokenHome  │              │ ERC20TokenRemote│
│                 │              │                 │
│ - Locks tokens  │◄────────────►│ - Mints tokens  │
│ - Sends message │              │ - Burns tokens  │
│ - Unlocks tokens│              │ - Sends message │
└─────────────────┘              └─────────────────┘
         │                                │
         │ User pays gas                  │ Gasless via relayer
         ▼                                ▼
┌─────────────────┐              ┌─────────────────┐
│ ERC20 Token     │              │ AvaCloud Relayer│
│ (USDC)          │              │                 │
│                 │              │ - Pays for gas  │
│ - User approves │              │ - Submits txs   │
│ - User transfers│              │ - Handles EIP712│
└─────────────────┘              └─────────────────┘
```

## Files

### 1. `erc20_gasless_bridge_test.go`
Go test file that demonstrates the gasless bridge functionality using the existing test framework.

**Features:**
- Loads configuration from `gasless_config.json`
- Imports wallet from private key
- Tests Chain to Innovo (user pays gas)
- Tests Innovo to Chain (gasless via relayer)
- Uses proper EIP-712 signatures
- Integrates with AvaCloud relayer

### 2. `gasless_bridge_client.js`
JavaScript client that provides a complete implementation of gasless bridge functionality.

**Features:**
- Complete EIP-712 signature creation
- Proper relayer integration
- Error handling and transaction monitoring
- Configurable parameters
- Example usage and test functions

## Configuration

The tests use `gasless_config.json` which contains:

```json
{
  "avaCloudRelayerAccount": "0x56112666e55fc1e735439c5c6cd34f6a4cc65e5e",
  "avaCloudRegistryContract": "0x1706b09874052916EC4330d30EeE74b902F354AC",
  "avaCloudTeleporterContract": "0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf",
  "avaCloudForwarder": "0xadb1cc52d50089a57c797685ea085e5cd2642c82",
  "erc20HomeAddress": "0x93040F3290AE042e654Fac8d8412Fe4856056Cf4",
  "erc20RemoteAddress": "0x65FE9B6E41BACc5F287DE88C1490c3933B77d511",
  "erc20TokenAddress": "0x5425890298aed601595a70ab815c96711a31bc65",
  "avaCloudRpcUrl": "https://gas-relayer.avax.network/innovomark/testnet/rpc",
  "avaCloudAuth": {
    "username": "innovomark_testnet",
    "password": "PVY8wZa10O9nrP3mfB"
  },
  "avaCloudDomain": "innovomark",
  "avaCloudVersion": "1",
  "avaCloudRequestType": "Message",
  "avaCloudRequestSuffix": "EMYIVHVJOTQUBEJLHAJCZLQ"
}
```

## Usage

### Running the Go Test

```bash
# Navigate to the test directory
cd tests/flows/ictt

# Run the gasless bridge test
go test -v -run TestGaslessBridge
```

### Running the JavaScript Client

```bash
# Install dependencies
npm install ethers axios

# Set your private key
export PRIVATE_KEY="your_private_key_here"

# Run the test
node gasless_bridge_client.js
```

## Test Flow

### Test 1: Chain to Innovo (User pays gas)

1. **Approve ERC20 tokens**: User approves the ERC20Home contract to spend tokens
2. **Send tokens**: User calls `send()` on ERC20Home with destination to Innovo
3. **Lock tokens**: ERC20Home locks the tokens and sends a message to Innovo
4. **Mint tokens**: ERC20Remote receives the message and mints tokens to the recipient

### Test 2: Innovo to Chain (Gasless via relayer)

1. **Create gasless approval**: User creates EIP-712 signature for approving token burn
2. **Submit via relayer**: Relayer submits the approval transaction and pays for gas
3. **Create gasless send**: User creates EIP-712 signature for sending tokens back
4. **Submit via relayer**: Relayer submits the send transaction and pays for gas
5. **Burn tokens**: ERC20Remote burns the tokens and sends a message to C-Chain
6. **Unlock tokens**: ERC20Home receives the message and unlocks the original tokens

## EIP-712 Signature Structure

The gasless transactions use EIP-712 typed data signing:

```javascript
const domain = {
    name: "innovomark",
    version: "1",
    chainId: chainId,
    verifyingContract: forwarderAddress
};

const types = {
    ForwardRequest: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'gas', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'data', type: 'bytes' },
        { name: 'validUntilTime', type: 'uint256' },
        { name: 'EMYIVHVJOTQUBEJLHAJCZLQ', type: 'bytes32' }
    ]
};
```

## Relayer Integration

The AvaCloud relayer handles:

1. **Authentication**: Uses username/password for API access
2. **Gas payment**: Relayer account pays for all gas fees
3. **Transaction submission**: Submits signed transactions to the network
4. **Error handling**: Provides detailed error messages for failed transactions

## Contract Integration

### ERC20TokenHome (C-Chain)
- Locks tokens when sending to remote chains
- Unlocks tokens when receiving from remote chains
- Supports EIP-712 meta-transactions via `executeMetaTransaction()`

### ERC20TokenRemote (Innovo)
- Mints tokens when receiving from home chain
- Burns tokens when sending back to home chain
- Supports EIP-712 meta-transactions via `executeMetaTransaction()`

## Security Considerations

1. **Private Key Management**: Never hardcode private keys in production
2. **Signature Verification**: All signatures are verified on-chain
3. **Nonce Management**: Each user has a unique nonce to prevent replay attacks
4. **Expiration**: Transactions have expiration times to prevent stale submissions
5. **Relayer Trust**: The AvaCloud relayer is trusted to submit transactions honestly

## Error Handling

The test files include comprehensive error handling for:

- Invalid private keys
- Network connectivity issues
- Contract deployment failures
- Transaction failures
- Relayer submission errors
- Signature verification failures

## Development Notes

### Adding New Test Cases

1. Create a new function in the Go test file
2. Follow the existing pattern for contract initialization
3. Add proper error handling and assertions
4. Update the test suite to include the new test

### Modifying Configuration

1. Update `gasless_config.json` with new contract addresses
2. Ensure all blockchain IDs are correct
3. Verify relayer credentials are valid
4. Test with small amounts first

### Debugging

1. Check network connectivity to both chains
2. Verify contract addresses are correct
3. Ensure private key has sufficient balance
4. Check relayer logs for submission errors
5. Verify EIP-712 signature format

## Example Output

```
=== Test 1: Chain to Innovo (User pays gas) ===
Step 1: Approving ERC20 tokens...
✓ Approved 100000 USDC for ERC20Home
Step 2: Sending tokens from Chain to Innovo...
✓ Sent 100000 USDC from Chain to Innovo
  Transaction hash: 0x1234...
✓ Recipient balance on Innovo: 100000 tokens

=== Test 2: Innovo to Chain (Gasless via relayer) ===
Step 1: Creating gasless approval for burning tokens...
✓ Gasless approval submitted for 100000 USDC
  Transaction hash: 0x5678...
Step 2: Creating gasless send transaction...
✓ Gasless send submitted for 100000 USDC from Innovo to Chain
  Transaction hash: 0x9abc...

=== Gasless Bridge Test Completed Successfully ===
```

## Troubleshooting

### Common Issues

1. **"Invalid private key"**: Ensure private key is 64 hex characters
2. **"Contract not found"**: Verify contract addresses in config
3. **"Insufficient balance"**: Ensure wallet has enough tokens and gas
4. **"Relayer error"**: Check relayer credentials and network connectivity
5. **"Signature verification failed"**: Verify EIP-712 domain and types

### Debug Commands

```bash
# Check contract deployment
forge verify-contract --chain-id 43113 0x93040F3290AE042e654Fac8d8412Fe4856056Cf4

# Check token balance
cast call 0x5425890298aed601595a70ab815c96711a31bc65 "balanceOf(address)" 0xYourAddress

# Check relayer status
curl -X POST https://gas-relayer.avax.network/innovomark/testnet/rpc \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

## Contributing

When adding new features or tests:

1. Follow the existing code patterns
2. Add comprehensive error handling
3. Include proper documentation
4. Test with small amounts first
5. Update this README with any new information 