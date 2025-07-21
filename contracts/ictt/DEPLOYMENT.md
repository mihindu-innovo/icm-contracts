# ICTT Deployment Guide

This document explains how to use the `deploy.sh` script to deploy ICTT (Inter-Chain Token Transfer) contracts.

## Overview

The `deploy.sh` script is a standalone bash script that automates the deployment of ERC20Home and ERC20Remote contracts for the ICTT system. It handles the complete deployment process including contract deployment, registration, and initial setup.

## Prerequisites

1. **Foundry**: Must be installed and configured
   ```bash
   curl -L https://foundry.paradigm.xyz | bash
   foundryup
   ```

2. **Bash**: Available on Linux, macOS, and Windows (Git Bash/WSL)

3. **Project Dependencies**: Install and build dependencies
   ```bash
   # Navigate to the project root
   cd /path/to/icm-contracts
   
   # Install dependencies
   forge install
   
   # Build the project
   forge build
   ```

4. **Project Setup**: Navigate to the ICTT directory
   ```bash
   cd contracts/ictt
   ```

## Configuration

Edit the configuration variables at the top of `deploy.sh`:

### Required Configuration

```bash
# Your private key (64 hex characters, without 0x prefix)
PRIVATE_KEY="your_actual_private_key_here"

# Your ERC20 token address on the home chain
ERC20_TOKEN_ADDRESS="0xYourTokenAddressHere"
```

### Optional Configuration

```bash
# RPC URLs for the chains
RPC_URL_HOME="https://api.avax-test.network/ext/bc/C/rpc"
RPC_URL_REMOTE="https://subnets.avax.network/innovomark/testnet/rpc"

# Contract addresses (usually don't need to change)
REG_HOME="0xF86Cb19Ad8405AEFa7d09C778215D2Cb6eBfB228"
REG_REMOTE="0x1706b09874052916EC4330d30EeE74b902F354AC"
MNG="0xD5b7DE57f5a0c6674E81Db906ccC1dDEC56d38e8"

# Blockchain IDs
BLOCKCHAIN_ID_HOME="0x7fc93d85c6d62c5b2ac0b519c87010ea5294012d1e407030d6acd0021cac10d5"
BLOCKCHAIN_ID_REMOTE="0xeaa43ceb6e928c745155585de433f487399081a800080775b0fce622b113fc95"
```

## Usage

1. **Navigate to the project root:**
   ```bash
   cd /path/to/icm-contracts
   ```

2. **Install and build dependencies:**
   ```bash
   forge install
   forge build
   ```

3. **Navigate to the ICTT directory:**
   ```bash
   cd contracts/ictt
   ```

4. **Edit the configuration:**
   ```bash
   # Open deploy.sh and update the required values
   nano deploy.sh  # or your preferred editor
   ```

5. **Make the script executable (Linux/Mac/WSL):**
   ```bash
   chmod +x deploy.sh
   ```

6. **Run the deployment:**
   ```bash
   ./deploy.sh
   ```

## What the Script Does

The script performs the following steps in order:

1. **Prerequisites Check**: Validates Foundry installation and project structure
2. **Configuration Validation**: Checks all addresses and parameters
3. **ERC20Home Deployment**: Deploys the home contract on the home chain
4. **ERC20Remote Deployment**: Deploys the remote contract on the remote chain
5. **Contract Registration**: Links the remote contract with the home contract
6. **Token Approval**: Approves ERC20 tokens for the home contract
7. **Test Transfer**: Performs a test token transfer to verify functionality

## Output Files

The script generates two output files:

- **`deploy_log.txt`**: Detailed log of all operations with timestamps
- **`deployment_results.json`**: Contract addresses and transaction hashes

## Features

- **Color-coded output**: Easy to read with green/red/yellow colors
- **Comprehensive logging**: All operations logged with timestamps
- **Error handling**: Detailed error messages and validation
- **Interactive**: Pauses for user confirmation between steps
- **Validation**: Checks addresses, private keys, and blockchain IDs

## Troubleshooting

### Common Issues

1. **"Foundry is not installed"**
   ```bash
   curl -L https://foundry.paradigm.xyz | bash
   foundryup
   ```

2. **"forge install failed"**
   ```bash
   # Make sure you're in the project root
   cd /path/to/icm-contracts
   
   # Clean and reinstall
   forge remappings > remappings.txt
   forge install
   
   # If still failing, try updating Foundry
   foundryup
   ```

3. **"Build failed"**
   ```bash
   # Ensure dependencies are installed
   forge install
   
   # Try building manually
   forge build
   
   # Check for missing dependencies
   forge remappings
   ```

4. **"Private key validation failed"**
   - Make sure your private key is 64 hex characters
   - Don't include the `0x` prefix
   - Replace the placeholder value in the script

5. **"Could not extract contract address"**
   - Check your RPC URLs are accessible
   - Verify you have sufficient funds for gas
   - Ensure the network is operational

6. **"Configuration validation failed"**
   - Check all addresses are valid Ethereum addresses
   - Ensure blockchain IDs are 64 hex characters
   - Verify RPC URLs are correct

### Windows-specific Issues

- Use WSL (Windows Subsystem for Linux) for better compatibility
- Or use Git Bash instead of PowerShell
- Ensure proper line endings (LF instead of CRLF)

### Debug Mode

To see more detailed output, you can modify the script to show all commands by adding `set -x` at the top of the script.

## Security Notes

- **Never commit your private key**: Always use placeholder values in version control
- **Test on testnets first**: Always test deployments on test networks before mainnet
- **Verify contracts**: Always verify deployed contracts on block explorers
- **Backup results**: Keep the `deployment_results.json` file for future reference

## Example Output

```
[2025-01-15 10:30:00] Checking prerequisites...
[2025-01-15 10:30:00] Prerequisites check passed
[2025-01-15 10:30:01] Validating configuration...
[2025-01-15 10:30:01] Configuration validation passed
[2025-01-15 10:30:01] Step 1: Deploying ERC20Home contract...
[2025-01-15 10:30:05] ERC20Home deployed successfully at: 0x1234...
[2025-01-15 10:30:05] Step 2: Deploying ERC20Remote contract...
[2025-01-15 10:30:10] ERC20Remote deployed successfully at: 0x5678...
[2025-01-15 10:30:10] Step 3: Registering contracts...
[2025-01-15 10:30:15] Contracts registered successfully
[2025-01-15 10:30:15] Step 4: Approving tokens...
[2025-01-15 10:30:20] Tokens approved successfully
[2025-01-15 10:30:20] Step 5: Sending test transfer...
[2025-01-15 10:30:25] Test transfer completed successfully
[2025-01-15 10:30:25] Deployment completed successfully!
```

## Support

If you encounter issues not covered in this guide:

1. Check the `deploy_log.txt` file for detailed error messages
2. Verify all configuration values are correct
3. Ensure you have sufficient funds for gas fees
4. Check that the networks are operational 