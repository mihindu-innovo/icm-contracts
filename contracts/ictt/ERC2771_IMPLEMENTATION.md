# ERC2771Recipient Implementation for Gasless Transactions

## Overview

This document outlines the implementation of ERC2771Recipient pattern in the ICTT contracts to enable gasless transactions using AvaCloud relayer.

## Changes Made

### 1. ERC20TokenHomeUpgradeable.sol

**Changes:**
- Added `ERC2771Recipient` inheritance
- Added `forwarder` parameter to `initialize()` function
- Added `_setTrustedForwarder(forwarder)` in initialization
- Imported `@opengsn/contracts/src/ERC2771Recipient.sol`

**Key Points:**
- The contract now properly implements the ERC2771Recipient pattern
- `_msgSender()` is automatically available from ERC2771Recipient
- All functions that need the real sender should use `_msgSender()` instead of `msg.sender`

### 2. ERC20TokenRemoteUpgradeable.sol

**Changes:**
- Added `ERC2771Recipient` inheritance
- Added `forwarder` parameter to `initialize()` function
- Added `_setTrustedForwarder(forwarder)` in initialization
- Removed custom gasless functions (`gaslessSend`, `_validateGaslessSendParams`, etc.)
- Removed custom storage fields (`nonces`, `signatory`)
- Removed custom events and errors related to gasless operations
- Cleaned up storage structure

**Key Points:**
- The contract now uses standard ERC2771Recipient pattern
- No custom gasless functions needed - standard `send()` function works with forwarder
- `_msgSender()` automatically handles the real sender from meta-transactions

### 3. Deployment Script (deploy_gasless.sh)

**Changes:**
- Updated to use `ERC20TokenHomeUpgradeable` and `ERC20TokenRemoteUpgradeable`
- Added `AVACLOUD_FORWARDER` parameter to both contract deployments
- Removed custom signatory setting (not needed with ERC2771Recipient)
- Updated deployment messages to reflect ERC2771Recipient pattern

### 4. Gasless Send Client (gasless_send_client.js)

**Changes:**
- Updated to use standard `send()` function instead of custom `gaslessSend()`
- Removed custom signature validation (handled by forwarder)
- Updated ABI to remove `gaslessSend` function
- Simplified gasless transaction flow

## ERC2771Recipient Pattern Requirements

Following the [AvaCloud guide](https://github.com/ava-labs/avalanche-evm-gasless-transaction/blob/main/src/GaslessCounter.sol), the implementation now includes:

1. **Contract Inheritance**: Both contracts inherit from `ERC2771Recipient`
2. **Trusted Forwarder**: Set in constructor/initialization with `_setTrustedForwarder(forwarder)`
3. **Use `_msgSender()`**: All functions use `_msgSender()` instead of `msg.sender`
4. **No Custom Gasless Functions**: Standard functions work with the forwarder

## How It Works

1. **User signs EIP-712 message** with transaction data
2. **Forwarder validates signature** and extracts real sender
3. **Forwarder calls contract** with real sender in `msg.data`
4. **Contract uses `_msgSender()`** to get the real sender
5. **Standard functions work** without modification

## Benefits

- **Standard Compliance**: Uses established ERC2771Recipient pattern
- **Simplified Code**: No custom gasless functions needed
- **Better Security**: Leverages proven forwarder validation
- **Interoperability**: Works with any ERC2771-compliant forwarder
- **Maintainability**: Less custom code to maintain

## Testing

The gasless send client has been updated to work with the new pattern:

```bash
# Deploy contracts with ERC2771Recipient support
cd contracts/ictt && ./deploy_gasless.sh

# Test gasless transactions
cd /c/code/InnovoMarkets/icm-contracts && node tests/flows/ictt/gasless_send_client.js
```

## Forwarder Configuration

The contracts are configured to use the AvaCloud forwarder:
- **Forwarder Address**: `0xadb1cc52d50089a57c797685ea085e5cd2642c82`
- **Network**: Innovomark Subnet (Chain ID: 54414)
- **Relayer**: AvaCloud gas relayer

## Migration Notes

If you have existing deployments, you'll need to:
1. Deploy new contracts with ERC2771Recipient support
2. Update client code to use standard `send()` function
3. Remove any custom gasless function calls
4. Update deployment scripts to include forwarder parameter 