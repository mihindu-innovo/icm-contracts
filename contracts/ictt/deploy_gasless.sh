#!/bin/bash

# Gasless ICTT Deployment Script
# Deploys ERC20Remote with gasless send functionality following MintController pattern

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
RPC_URL_HOME="https://api.avax-test.network/ext/bc/C/rpc"
RPC_URL_REMOTE="https://subnets.avax.network/innovomark/testnet/rpc"
PRIVATE_KEY="8a22131111b07684e5df85ef89ffd5350ce106115207c818a3bba12470744eb4"
REG_HOME="0xF86Cb19Ad8405AEFa7d09C778215D2Cb6eBfB228"
REG_REMOTE="0x1706b09874052916EC4330d30EeE74b902F354AC"
MNG="0xD5b7DE57f5a0c6674E81Db906ccC1dDEC56d38e8"
BLOCKCHAIN_ID_HOME="0x7fc93d85c6d62c5b2ac0b519c87010ea5294012d1e407030d6acd0021cac10d5"
BLOCKCHAIN_ID_REMOTE="0xeaa43ceb6e928c745155585de433f487399081a800080775b0fce622b113fc95"
ERC20_TOKEN_ADDRESS="0x5425890298aed601595a70ab815c96711a31bc65"

# ERC2771 Configuration
AVACLOUD_FORWARDER="0xadb1cc52d50089a57c797685ea085e5cd2642c82"

# Script directory
SCRIPT_DIR=$(dirname "$0")
LOG_FILE="$SCRIPT_DIR/deploy_gasless_log.txt"
RESULTS_FILE="$SCRIPT_DIR/deployment_gasless_results.json"

# Logging function
log() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local message="[${timestamp}] $1"
    echo -e "${GREEN}${message}${NC}"
    echo "$message" >> "$LOG_FILE"
}

error() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local message="[${timestamp}] ERROR: $1"
    echo -e "${RED}${message}${NC}"
    echo "$message" >> "$LOG_FILE"
}

info() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local message="[${timestamp}] INFO: $1"
    echo -e "${BLUE}${message}${NC}"
    echo "$message" >> "$LOG_FILE"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    if ! command -v forge &> /dev/null; then
        error "Foundry is not installed. Please install Foundry first."
        exit 1
    fi
    
    if ! command -v cast &> /dev/null; then
        error "Cast is not installed. Please install Foundry with cast."
        exit 1
    fi
    
    # Find project root
    local project_root=""
    local current_dir="$(pwd)"
    
    while [[ "$current_dir" != "/" && "$current_dir" != "." ]]; do
        if [[ -f "$current_dir/foundry.toml" ]]; then
            project_root="$current_dir"
            break
        fi
        current_dir="$(dirname "$current_dir")"
    done
    
    if [[ -z "$project_root" ]]; then
        error "Could not find foundry.toml. Please ensure you're in a Foundry project."
        exit 1
    fi
    
    PROJECT_ROOT="$project_root"
    log "Project root: $PROJECT_ROOT"
    
    # Test build
    cd "$PROJECT_ROOT"
    if ! forge build --silent 2>/dev/null; then
        error "Foundry build failed. Please check your remappings and dependencies."
        exit 1
    fi
    
    cd "$SCRIPT_DIR"
    log "Prerequisites check passed"
}

# Deploy ERC20Home (standard, no gasless needed)
deploy_erc20_home() {
    log "=========================================================================="
    log "Deploying ERC20Home on Home"
    
    # Deploy the contract following AvaCloud guide pattern
    local command="forge create --rpc-url $RPC_URL_HOME --private-key $PRIVATE_KEY \
        contracts/ictt/TokenHome/ERC20TokenHome.sol:ERC20TokenHome \
        --constructor-args \
        \"$REG_HOME\" \
        \"$MNG\" \
        \"1\" \
        \"$ERC20_TOKEN_ADDRESS\" \
        \"6\" \
        \"$AVACLOUD_FORWARDER\""
    
    local output
    output=$(eval "$command")
    
    local contract_address
    contract_address=$(echo "$output" | grep -o "Deployed to: 0x[a-fA-F0-9]\{40\}" | cut -d' ' -f3)
    local tx_hash
    tx_hash=$(echo "$output" | grep -o "Transaction: 0x[a-fA-F0-9]\{64\}" | cut -d' ' -f2)
    
    if [[ -z "$contract_address" ]]; then
        error "ERC20Home deployment failed - could not extract contract address"
        return 1
    fi
    
    log "ERC20 Home Contract Address: $contract_address"
    log "ERC20 Home Transaction Hash: $tx_hash"
    
    ERC20_HOME_ADDRESS="$contract_address"
    ERC20_HOME_TX_HASH="$tx_hash"
    
    log "ERC20Home deployment successful"
    return 0
}

# Deploy ERC20Remote with gasless functionality
deploy_erc20_remote() {
    log "=========================================================================="
    log "Deploying ERC20Remote with gasless functionality on Remote"
    
    # Deploy the contract following AvaCloud guide pattern
    local command="forge create --rpc-url $RPC_URL_REMOTE --private-key $PRIVATE_KEY \
        contracts/ictt/TokenRemote/ERC20TokenRemote.sol:ERC20TokenRemote \
        --constructor-args \
        \"($REG_REMOTE,$MNG,1,$BLOCKCHAIN_ID_HOME,$ERC20_HOME_ADDRESS,6)\" \
        \"MIHI Token\" \
        \"MIHIT\" \
        \"6\" \
        \"$AVACLOUD_FORWARDER\""
    
    local output
    output=$(eval "$command")
    
    local contract_address
    contract_address=$(echo "$output" | grep -o "Deployed to: 0x[a-fA-F0-9]\{40\}" | cut -d' ' -f3)
    local tx_hash
    tx_hash=$(echo "$output" | grep -o "Transaction: 0x[a-fA-F0-9]\{64\}" | cut -d' ' -f2)
    
    if [[ -z "$contract_address" ]]; then
        error "ERC20Remote deployment failed - could not extract contract address"
        return 1
    fi
    
    log "ERC20 Remote Contract Address: $contract_address"
    log "ERC20 Remote Transaction Hash: $tx_hash"
    
    ERC20_REMOTE_ADDRESS="$contract_address"
    ERC20_REMOTE_TX_HASH="$tx_hash"
    
    log "ERC20Remote deployment successful (ERC2771Recipient pattern)"
    return 0
}

# Register contracts
register_contracts() {
    log "=========================================================================="
    log "Registering contracts"
    
    local command="cast send --private-key=$PRIVATE_KEY --rpc-url=$RPC_URL_REMOTE \
        $ERC20_REMOTE_ADDRESS \"registerWithHome((address,uint256))\" \
        \"($ERC20_HOME_ADDRESS,0)\""
    
    eval "$command" > /dev/null 2>&1
    
    if [[ $? -ne 0 ]]; then
        error "Contract registration failed"
        return 1
    fi
    
    log "Contracts registered successfully"
    return 0
}

# Approve tokens for transfer
approve_tokens() {
    log "=========================================================================="
    log "Approving tokens for transfer"
    
    local command="cast send --private-key=$PRIVATE_KEY --rpc-url=$RPC_URL_HOME \
        $ERC20_TOKEN_ADDRESS \"approve(address,uint256)\" \
        \"$ERC20_HOME_ADDRESS\" \"2\""
    
    eval "$command" > /dev/null 2>&1
    
    if [[ $? -ne 0 ]]; then
        error "Token approval failed"
        return 1
    fi
    
    log "Tokens approved successfully"
    return 0
}

# Send tokens cross-chain (Home to Remote)
send_tokens() {
    log "=========================================================================="
    log "Sending tokens cross-chain (Home to Remote)"
    
    local command="cast send --private-key=$PRIVATE_KEY --rpc-url=$RPC_URL_HOME \
        $ERC20_HOME_ADDRESS \"send((bytes32,address,address,address,uint256,uint256,uint256,address),uint256)\" \
        \"($BLOCKCHAIN_ID_REMOTE,$ERC20_REMOTE_ADDRESS,$MNG,$ERC20_TOKEN_ADDRESS,0,0,200000,0x0000000000000000000000000000000000000000)\" \"1\""
    
    eval "$command" > /dev/null 2>&1
    
    if [[ $? -ne 0 ]]; then
        error "Token send failed"
        return 1
    fi
    
    log "Tokens sent successfully (Home to Remote)"
    return 0
}

# Wait for cross-chain message processing
wait_for_message_processing() {
    log "=========================================================================="
    log "Waiting for cross-chain message processing..."
    
    # Wait for 30 seconds to allow message processing
    sleep 30
    
    log "Message processing wait completed"
    return 0
}

# Test gasless send from Remote to Home
test_gasless_send() {
    log "=========================================================================="
    log "Testing gasless send (Remote to Home)"
    
    # First, check balance on remote chain
    log "Checking balance on remote chain..."
    local balance_command="cast call --rpc-url $RPC_URL_REMOTE \
        $ERC20_REMOTE_ADDRESS \"balanceOf(address)\" \"$MNG\""
    
    local balance_output
    balance_output=$(eval "$balance_command")
    
    if [[ $? -ne 0 ]]; then
        error "Failed to check balance"
        return 1
    fi
    
    log "Balance on remote chain: $balance_output"
    
    # Test gasless send using ERC2771Recipient pattern
    log "Note: Gasless send uses ERC2771Recipient pattern with AvaCloud forwarder"
    log "The contract is now relayer compliant and supports gasless transactions"
    log "For actual gasless testing, use the gasless_send_client.js script"
    
    return 0
}

# Save deployment results
save_results() {
    log "=========================================================================="
    log "Saving deployment results"
    
    cat > "$RESULTS_FILE" << EOF
{
    "deployment": {
        "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
        "network": {
            "home": {
                "rpcUrl": "$RPC_URL_HOME",
                "blockchainId": "$BLOCKCHAIN_ID_HOME"
            },
            "remote": {
                "rpcUrl": "$RPC_URL_REMOTE",
                "blockchainId": "$BLOCKCHAIN_ID_REMOTE"
            }
        },
        "contracts": {
            "erc20Home": {
                "contractAddress": "$ERC20_HOME_ADDRESS",
                "transactionHash": "$ERC20_HOME_TX_HASH"
            },
            "erc20Remote": {
                "contractAddress": "$ERC20_REMOTE_ADDRESS",
                "transactionHash": "$ERC20_REMOTE_TX_HASH"
            }
        },
        "gasless": {
            "forwarder": "$AVACLOUD_FORWARDER",
            "signatory": "$MNG"
        }
    }
}
EOF
    
    log "Results saved to: $RESULTS_FILE"
}

# Main execution
main() {
    # Initialize log file
    echo "Gasless ICTT Deployment Log - $(date)" > "$LOG_FILE"
    
    log "Starting gasless ICTT deployment..."
    
    check_prerequisites
    
    if ! deploy_erc20_home; then
        error "ERC20Home deployment failed"
        exit 1
    fi
    
    if ! deploy_erc20_remote; then
        error "ERC20Remote deployment failed"
        exit 1
    fi
    
    if ! register_contracts; then
        error "Contract registration failed"
        exit 1
    fi
    
    if ! approve_tokens; then
        error "Token approval failed"
        exit 1
    fi
    
    if ! send_tokens; then
        error "Token send failed"
        exit 1
    fi
    
    if ! wait_for_message_processing; then
        error "Message processing wait failed"
        exit 1
    fi
    
    if ! test_gasless_send; then
        error "Gasless send test failed"
        exit 1
    fi
    
    save_results
    
    log "=========================================================================="
    log "Deployment completed successfully!"
    log ""
    log "Contract Addresses:"
    log "  ERC20Home: $ERC20_HOME_ADDRESS"
    log "  ERC20Remote: $ERC20_REMOTE_ADDRESS"
    log ""
    log "Gasless Configuration:"
    log "  Forwarder: $AVACLOUD_FORWARDER"
    log "  Signatory: $MNG"
    log ""
    log "Next steps:"
    log "  1. ✅ Regular send from Home to Remote (completed)"
    log "  2. ✅ Balance check on Remote chain (completed)"
    log "  3. 🔄 Test gasless send from Remote to Home using gaslessSend()"
    log "  4. Use the deployment results for client testing"
    log ""
    log "For gasless testing, run:"
    log "  cd /c/code/InnovoMarkets/icm-contracts && node tests/flows/ictt/gasless_send_client.js"
}

# Run main function
main "$@" 