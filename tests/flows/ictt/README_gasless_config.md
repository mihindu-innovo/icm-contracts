# Gasless Config Preservation

This document explains how the gasless configuration is preserved during deployment.

## Overview

The deployment process automatically preserves the complete gasless configuration structure while updating only the deployed contract addresses. This ensures that all necessary configuration fields are retained.

## Files

- `gasless_config.json` - Main configuration file with all gasless bridge settings
- `backup_gasless_config.sh` - Script to backup existing config before deployment
- `restore_gasless_config.sh` - Script to restore config from backup if needed
- `test_config_preservation.js` - Test script to verify config integrity

## Configuration Structure

The complete gasless config includes:

### Core AvaCloud Settings
```json
{
  "avaCloudRelayerAccount": "0x56112666e55fc1e735439c5c6cd34f6a4cc65e5e",
  "avaCloudRegistryContract": "0x1706b09874052916EC4330d30EeE74b902F354AC",
  "avaCloudTeleporterContract": "0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf",
  "avaCloudForwarder": "0xadb1cc52d50089a57c797685ea085e5cd2642c82"
}
```

### Contract Addresses
```json
{
  "erc20HomeAddress": "0x93040F3290AE042e654Fac8d8412Fe4856056Cf4",
  "erc20RemoteAddress": "0x65FE9B6E41BACc5F287DE88C1490c3933B77d511",
  "erc20TokenAddress": "0x5425890298aed601595a70ab815c96711a31bc65"
}
```

### Network Configuration
```json
{
  "homeRpcUrl": "https://api.avax-test.network/ext/bc/C/rpc",
  "remoteRpcUrl": "https://subnets.avax.network/innovomark/testnet/rpc",
  "cChainBlockchainID": "0x7fc93d85c6d62c5b2ac0b519c87010ea5294012d1e407030d6acd0021cac10d5",
  "innovomarkBlockchainID": "0xeaa43ceb6e928c745155585de433f487399081a800080775b0fce622b113fc95"
}
```

### Authentication
```json
{
  "avaCloudAuth": {
    "username": "innovomark_testnet",
    "password": "PVY8wZa10O9nrP3mfB"
  }
}
```

### EIP-712 Configuration
```json
{
  "avaCloudDomain": "innovomark",
  "avaCloudVersion": "1",
  "avaCloudRequestType": "Message",
  "avaCloudRequestSuffix": "EMYIVHVJOTQUBEJLHAJCZLQ"
}
```

## Deployment Process

1. **Backup**: Before deployment, the existing config is backed up to `gasless_config.backup.json`
2. **Deploy**: Contracts are deployed and addresses are captured
3. **Update**: Only contract addresses are updated in the config, preserving all other settings
4. **Verify**: The config integrity is verified to ensure all required fields are present

## Usage

### Manual Backup
```bash
cd tests/flows/ictt
./backup_gasless_config.sh
```

### Manual Restore
```bash
cd tests/flows/ictt
./restore_gasless_config.sh
```

### Test Config Integrity
```bash
cd tests/flows/ictt
node test_config_preservation.js
```

## Automatic Preservation

The deploy script automatically:
1. Calls the backup script before deployment
2. Updates only contract addresses after deployment
3. Preserves all existing configuration fields
4. Adds deployment metadata (timestamp, deployer, etc.)

## Required Fields

The following fields must be present in the config:
- All AvaCloud infrastructure addresses
- Contract addresses (home, remote, token)
- Network RPC URLs and blockchain IDs
- Authentication credentials
- EIP-712 domain configuration
- Network configuration for both chains
- Gasless configuration settings
- Deployment information

## Troubleshooting

### Missing Fields
If required fields are missing, the test script will report them. You can restore from backup or manually add the missing fields.

### Invalid Addresses
If contract addresses are still placeholders after deployment, check the deployment logs for errors.

### Backup Issues
If the backup script fails, ensure you have write permissions in the directory.

## Example Complete Config

See `gasless_config.json` for a complete example with all required fields. 