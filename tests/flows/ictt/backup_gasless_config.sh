#!/bin/bash

# Backup script for gasless_config.json
# This script creates a backup of the existing gasless config before deployment

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR=$(dirname "$0")
CONFIG_FILE="$SCRIPT_DIR/gasless_config.json"
BACKUP_FILE="$SCRIPT_DIR/gasless_config.backup.json"

log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

# Check if config file exists
if [[ -f "$CONFIG_FILE" ]]; then
    log "Found existing gasless_config.json, creating backup..."
    cp "$CONFIG_FILE" "$BACKUP_FILE"
    log "Backup created: $BACKUP_FILE"
else
    warn "No existing gasless_config.json found, will create new one during deployment"
fi

# Create a template config if none exists
if [[ ! -f "$CONFIG_FILE" ]]; then
    log "Creating template gasless_config.json..."
    cat > "$CONFIG_FILE" << 'EOF'
{
  "avaCloudRelayerAccount": "0x56112666e55fc1e735439c5c6cd34f6a4cc65e5e",
  "avaCloudRegistryContract": "0x1706b09874052916EC4330d30EeE74b902F354AC",
  "avaCloudTeleporterContract": "0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf",
  "avaCloudForwarder": "0xadb1cc52d50089a57c797685ea085e5cd2642c82",
  "erc20HomeAddress": "PLACEHOLDER_HOME_ADDRESS",
  "erc20RemoteAddress": "PLACEHOLDER_REMOTE_ADDRESS",
  "erc20TokenAddress": "0x5425890298aed601595a70ab815c96711a31bc65",
  "avaCloudRpcUrl": "https://gas-relayer.avax.network/innovomark/testnet/rpc",
  "avaCloudAuth": {
    "username": "innovomark_testnet",
    "password": "PVY8wZa10O9nrP3mfB"
  },
  "avaCloudDomain": "innovomark",
  "avaCloudVersion": "1",
  "avaCloudRequestType": "Message",
  "avaCloudRequestSuffix": "EMYIVHVJOTQUBEJLHAJCZLQ",
  "homeRpcUrl": "https://api.avax-test.network/ext/bc/C/rpc",
  "remoteRpcUrl": "https://subnets.avax.network/innovomark/testnet/rpc",
  "cChainBlockchainID": "0x7fc93d85c6d62c5b2ac0b519c87010ea5294012d1e407030d6acd0021cac10d5",
  "innovomarkBlockchainID": "0xeaa43ceb6e928c745155585de433f487399081a800080775b0fce622b113fc95",
  "networkConfig": {
    "home": {
      "name": "Avalanche C-Chain Testnet",
      "chainId": 43113,
      "rpcUrl": "https://api.avax-test.network/ext/bc/C/rpc",
      "blockExplorer": "https://testnet.snowtrace.io"
    },
    "remote": {
      "name": "Innovo Subnet Testnet",
      "chainId": 54414,
      "rpcUrl": "https://subnets.avax.network/innovomark/testnet/rpc",
      "blockExplorer": "https://testnet.innovomarkets.com"
    }
  },
  "contracts": {
    "home": {
      "erc20Home": "PLACEHOLDER_HOME_ADDRESS",
      "erc20Token": "0x5425890298aed601595a70ab815c96711a31bc65",
      "teleporterMessenger": "0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf"
    },
    "remote": {
      "erc20Remote": "PLACEHOLDER_REMOTE_ADDRESS",
      "erc20Token": "0x5425890298aed601595a70ab815c96711a31bc65",
      "forwarder": "0xadb1cc52d50089a57c797685ea085e5cd2642c82"
    }
  },
  "gaslessConfig": {
    "relayerUrl": "https://gas-relayer.avax.network/innovomark/testnet/rpc",
    "auth": {
      "username": "innovomark_testnet",
      "password": "PVY8wZa10O9nrP3mfB"
    },
    "domain": "innovomark",
    "version": "1",
    "requestType": "Message",
    "requestSuffix": "EMYIVHVJOTQUBEJLHAJCZLQ"
  },
  "deploymentInfo": {
    "deployer": "0xD5b7DE57f5a0c6674E81Db906ccC1dDEC56d38e8",
    "deploymentDate": "PLACEHOLDER_DATE",
    "version": "1.0.0",
    "environment": "testnet"
  }
}
EOF
    log "Template gasless_config.json created"
fi

log "Backup process completed"
log "Original config: $CONFIG_FILE"
log "Backup file: $BACKUP_FILE" 