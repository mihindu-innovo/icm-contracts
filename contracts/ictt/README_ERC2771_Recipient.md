# ICTT ERC2771Recipient Implementation

This implementation adds ERC2771Recipient support to ICTT contracts, following the same pattern as your existing contracts that use ERC2771Recipient with trusted forwarder setup.

## Overview

The ERC2771Recipient pattern allows contracts to accept meta-transactions from trusted forwarders (like your Ava Cloud relayer). This implementation maintains consistency with your existing contract architecture.

## Contract Files

- **ERC20TokenHomeERC2771Recipient.sol**: Home contract with ERC2771 support
- **ERC20TokenRemoteERC2771Recipient.sol**: Remote contract with ERC2771 support

## Key Features

### 1. ERC2771Recipient Integration
- Extends OpenZeppelin's `ERC2771Recipient` 
- Maintains the same pattern as your existing contracts
- Uses `_setTrustedForwarder()` in initialize function

### 2. Trusted Forwarder Setup
```solidity
function initialize(
    // ... other parameters
    address trustedForwarder
) public initializer {
    // Initialize parent contract
    ERC20TokenHomeUpgradeable.initialize(/* ... */);
    
    // Set trusted forwarder for meta-transactions
    _setTrustedForwarder(trustedForwarder);
}
```

### 3. Context Override Pattern
```solidity
function _msgSender() internal view override(Context, ERC2771Recipient) returns (address) {
    return ERC2771Recipient._msgSender();
}

function _msgData() internal view override(Context, ERC2771Recipient) returns (bytes calldata) {
    return ERC2771Recipient._msgData();
}

function _contextSuffixLength() internal view override(Context, ERC2771Recipient) returns (uint256) {
    return ERC2771Recipient._contextSuffixLength();
}
```

## Usage with Ava Cloud Relayer

### 1. Deploy Contracts
```solidity
// Deploy Home contract
ERC20TokenHomeERC2771Recipient homeContract = new ERC20TokenHomeERC2771Recipient(
    teleporterRegistryAddress,
    teleporterManager,
    minTeleporterVersion,
    tokenAddress,
    tokenDecimals,
    trustedForwarderAddress  // Your Ava Cloud relayer address
);

// Deploy Remote contract
ERC20TokenRemoteERC2771Recipient remoteContract = new ERC20TokenRemoteERC2771Recipient(
    teleporterRegistryAddress,
    teleporterManager,
    minTeleporterVersion,
    tokenHomeBlockchainID,
    tokenHomeAddress,
    tokenDecimals,
    tokenName,
    tokenSymbol,
    trustedForwarderAddress  // Your Ava Cloud relayer address
);
```

### 2. Meta-Transaction Flow

1. **User signs EIP-712 message** containing:
   - Target contract address
   - Function call data
   - User's nonce
   - Gas limit
   - Deadline

2. **Ava Cloud relayer receives signature** and:
   - Validates the signature
   - Executes the transaction on behalf of user
   - Pays gas fees

3. **Contract receives call** from trusted forwarder:
   - `_msgSender()` returns original user address
   - All access controls work as normal
   - Transaction executes as if user called directly

## Functions Supporting Meta-Transactions

All existing ICTT functions automatically support meta-transactions:

### Home Contract Functions
- `send(bytes32 destinationBlockchainID, address recipient, uint256 amount)`
- `sendAndCall(SendAndCallInput calldata input)`
- `addCollateral(bytes32 remoteBlockchainID, address remoteTokenAddress, uint256 amount)`
- `removeCollateral(bytes32 remoteBlockchainID, address remoteTokenAddress, uint256 amount)`

### Remote Contract Functions
- `send(bytes32 destinationBlockchainID, address recipient, uint256 amount)`
- `sendAndCall(SendAndCallInput calldata input)`

## Administration

### Update Trusted Forwarder
```solidity
// Only owner can update trusted forwarder
homeContract.setTrustedForwarder(newForwarderAddress);
remoteContract.setTrustedForwarder(newForwarderAddress);
```

### Check Current Forwarder
```solidity
address currentForwarder = homeContract.getTrustedForwarder();
```

## Security Considerations

1. **Trusted Forwarder**: Only set your verified Ava Cloud relayer as trusted forwarder
2. **Access Control**: All existing access controls remain intact
3. **Signature Validation**: Relayer must properly validate signatures before forwarding
4. **Replay Protection**: Relayer should implement nonce management
5. **Gas Limits**: Relayer should enforce reasonable gas limits

## Integration with Existing Patterns

This implementation follows the exact same pattern as your existing contracts:
- Uses `ERC2771Recipient` extension
- Sets trusted forwarder in `initialize()` function
- Overrides context functions consistently
- Maintains owner-only forwarder updates

## Benefits

1. **Consistency**: Matches your existing contract architecture
2. **Gasless Transactions**: Users don't pay gas fees
3. **Seamless Integration**: Works with existing Ava Cloud relayer
4. **Standard Compliance**: Uses OpenZeppelin's battle-tested implementation
5. **Admin Control**: Owner can update trusted forwarder as needed

## Frontend Integration

Your frontend can continue using the same meta-transaction patterns you have with other contracts:
- Same EIP-712 signing process
- Same relayer API calls
- Same transaction flow

This ensures a consistent user experience across all your gasless contracts.