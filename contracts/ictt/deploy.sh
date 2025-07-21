#!/bin/bash

# ICTT Deployment Script v2.0
# Standalone shell script for deploying ERC20Home and ERC20Remote contracts

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration - Edit these values
RPC_URL_HOME="https://api.avax-test.network/ext/bc/C/rpc"
RPC_URL_REMOTE="https://subnets.avax.network/innovomark/testnet/rpc"
PRIVATE_KEY="8a22131111b07684e5df85ef89ffd5350ce106115207c818a3bba12470744eb4"  # Replace with your actual private key
REG_HOME="0xF86Cb19Ad8405AEFa7d09C778215D2Cb6eBfB228"
REG_REMOTE="0x1706b09874052916EC4330d30EeE74b902F354AC"
MNG="0xD5b7DE57f5a0c6674E81Db906ccC1dDEC56d38e8"
BLOCKCHAIN_ID_HOME="0x7fc93d85c6d62c5b2ac0b519c87010ea5294012d1e407030d6acd0021cac10d5"
BLOCKCHAIN_ID_REMOTE="0xeaa43ceb6e928c745155585de433f487399081a800080775b0fce622b113fc95"
ERC20_TOKEN_ADDRESS="0x5425890298aed601595a70ab815c96711a31bc65"  # Replace with your actual ERC20 token address

# Script directory
SCRIPT_DIR=$(dirname "$0")
LOG_FILE="$SCRIPT_DIR/deploy_log.txt"
RESULTS_FILE="$SCRIPT_DIR/deployment_results.json"

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

warn() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local message="[${timestamp}] WARNING: $1"
    echo -e "${YELLOW}${message}${NC}"
    echo "$message" >> "$LOG_FILE"
}

info() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local message="[${timestamp}] INFO: $1"
    echo -e "${BLUE}${message}${NC}"
    echo "$message" >> "$LOG_FILE"
}

# Validation functions
validate_address() {
    local address=$1
    local name=$2
    if [[ ! $address =~ ^0x[a-fA-F0-9]{40}$ ]]; then
        error "$name is not a valid Ethereum address: $address"
        return 1
    fi
}

validate_blockchain_id() {
    local id=$1
    local name=$2
    if [[ ! $id =~ ^0x[a-fA-F0-9]{64}$ ]]; then
        error "$name is not a valid blockchain ID: $id"
        return 1
    fi
}

validate_private_key() {
    local key=$1
    if [[ $key == "pvtKey" ]]; then
        error "Please set your actual private key in the script"
        return 1
    fi
    if [[ ! $key =~ ^[a-fA-F0-9]{64}$ ]]; then
        error "Private key must be 64 hex characters (without 0x prefix)"
        return 1
    fi
}

# Configuration validation
validate_config() {
    log "Validating configuration..."
    
    local errors=0
    
    validate_private_key "$PRIVATE_KEY" || errors=$((errors + 1))
    validate_address "$REG_HOME" "REG_HOME" || errors=$((errors + 1))
    validate_address "$REG_REMOTE" "REG_REMOTE" || errors=$((errors + 1))
    validate_address "$MNG" "MNG" || errors=$((errors + 1))
    validate_blockchain_id "$BLOCKCHAIN_ID_HOME" "BLOCKCHAIN_ID_HOME" || errors=$((errors + 1))
    validate_blockchain_id "$BLOCKCHAIN_ID_REMOTE" "BLOCKCHAIN_ID_REMOTE" || errors=$((errors + 1))
    
    if [[ $ERC20_TOKEN_ADDRESS == "0x..." ]]; then
        error "Please set your actual ERC20 token address"
        errors=$((errors + 1))
    else
        validate_address "$ERC20_TOKEN_ADDRESS" "ERC20_TOKEN_ADDRESS" || errors=$((errors + 1))
    fi
    
    if [[ $errors -gt 0 ]]; then
        error "Configuration validation failed with $errors error(s)"
        return 1
    fi
    
    log "Configuration validation passed"
}

# Print configuration
print_config() {
    info "Deployment Configuration:"
    echo "   Home RPC URL: $RPC_URL_HOME"
    echo "   Remote RPC URL: $RPC_URL_REMOTE"
    echo "   Registry Home: $REG_HOME"
    echo "   Registry Remote: $REG_REMOTE"
    echo "   Manager: $MNG"
    echo "   Blockchain ID Home: $BLOCKCHAIN_ID_HOME"
    echo "   Blockchain ID Remote: $BLOCKCHAIN_ID_REMOTE"
    echo "   ERC20 Token: $ERC20_TOKEN_ADDRESS"
    echo "   Private Key: ${PRIVATE_KEY:0:6}...${PRIVATE_KEY: -4}"
    echo ""
}

# Execute forge command and capture output
execute_forge() {
    local command="$1"
    local description="$2"
    
    log "Executing: $description"
    log "Command: $command"
    
    # Change to the project root directory for proper remappings
    # Use the project root we found earlier
    local project_root="$PROJECT_ROOT"
    cd "$project_root"
    
    # Execute command and capture output
    # Redirect logs temporarily to avoid mixing with command output
    local temp_log=$(mktemp)
    local output
    
    # Temporarily redirect stderr to avoid log mixing
    if output=$(eval "$command" 2>"$temp_log"); then
        log "Command executed successfully"
        echo "$output"
    else
        local error_output=$(cat "$temp_log")
        error "Command failed: $error_output"
        rm -f "$temp_log"
        return 1
    fi
    
    rm -f "$temp_log"
    
    # Return to original directory
    cd "$SCRIPT_DIR"
}

# Extract contract address from forge output
extract_address() {
    local output="$1"
    # Remove color codes and ANSI escape sequences
    local clean_output=$(echo "$output" | sed 's/\x1b\[[0-9;]*m//g' | sed 's/\x1b\[[0-9;]*[a-zA-Z]//g')
    local address=$(echo "$clean_output" | grep -oP '(?<=Deployed to: )0x[a-fA-F0-9]{40}')
    if [[ -z $address ]]; then
        error "Could not extract contract address from output"
        return 1
    fi
    echo "$address"
}

# Extract transaction hash from output
extract_tx_hash() {
    local output="$1"
    # Remove color codes and ANSI escape sequences
    local clean_output=$(echo "$output" | sed 's/\x1b\[[0-9;]*m//g' | sed 's/\x1b\[[0-9;]*[a-zA-Z]//g')
    
    # Try different patterns for transaction hash
    local tx_hash=""
    
    # Pattern 1: "Transaction hash: 0x..."
    tx_hash=$(echo "$clean_output" | grep -oP '(?<=Transaction hash: )0x[a-fA-F0-9]{64}')
    
    # Pattern 2: "blockHash: 0x..." (cast send format)
    if [[ -z $tx_hash ]]; then
        tx_hash=$(echo "$clean_output" | grep -oP '(?<=blockHash: )0x[a-fA-F0-9]{64}')
    fi
    
    # Pattern 3: "hash: 0x..." (alternative cast format)
    if [[ -z $tx_hash ]]; then
        tx_hash=$(echo "$clean_output" | grep -oP '(?<=hash: )0x[a-fA-F0-9]{64}')
    fi
    
    # Pattern 4: Just look for any 0x followed by 64 hex chars
    if [[ -z $tx_hash ]]; then
        tx_hash=$(echo "$clean_output" | grep -oP '0x[a-fA-F0-9]{64}' | head -1)
    fi
    
    if [[ -z $tx_hash ]]; then
        warn "Could not extract transaction hash from output"
        echo "unknown"
        return 0
    fi
    echo "$tx_hash"
}

# Deploy ERC20Home contract
deploy_erc20_home() {
    log "=========================================================================="
    log "Deploying ERC20Home on Home"
    
    local command="forge create --rpc-url $RPC_URL_HOME --private-key $PRIVATE_KEY \
        contracts/ictt/TokenHome/ERC20TokenHome.sol:ERC20TokenHome \
        --constructor-args \
        \"$REG_HOME\" \
        \"$MNG\" \
        \"1\" \
        \"$ERC20_TOKEN_ADDRESS\" \
        \"6\""
    
    local output
    output=$(execute_forge "$command" "ERC20Home deployment")
    
    local contract_address
    contract_address=$(extract_address "$output")
    local tx_hash
    tx_hash=$(extract_tx_hash "$output")
    
    log "ERC20 Home Contract Address: $contract_address"
    log "ERC20 Home Transaction Hash: $tx_hash"
    
    # Store in global variables
    ERC20_HOME_ADDRESS="$contract_address"
    ERC20_HOME_TX_HASH="$tx_hash"
    
    return 0
}

# Deploy ERC20Remote contract
deploy_erc20_remote() {
    log "=========================================================================="
    log "Deploying ERC20Remote on Remote"
    
    # Create the TokenRemoteSettings struct with all required fields
    # Format: (address,address,uint256,bytes32,address,uint8)
    local settings="($REG_REMOTE,$MNG,1,$BLOCKCHAIN_ID_HOME,$ERC20_HOME_ADDRESS,6)"
    
    local command="forge create --rpc-url $RPC_URL_REMOTE --private-key $PRIVATE_KEY \
        contracts/ictt/TokenRemote/ERC20TokenRemote.sol:ERC20TokenRemote \
        --constructor-args \
        \"$settings\" \
        \"MIHIUSDCToken\" \
        \"MUSDCT1\" \
        \"6\""
    
    local output
    output=$(execute_forge "$command" "ERC20Remote deployment")
    
    local contract_address
    contract_address=$(extract_address "$output")
    local tx_hash
    tx_hash=$(extract_tx_hash "$output")
    
    log "ERC20 Remote Contract Address: $contract_address"
    log "ERC20 Remote Transaction Hash: $tx_hash"
    
    # Store in global variables
    ERC20_REMOTE_ADDRESS="$contract_address"
    ERC20_REMOTE_TX_HASH="$tx_hash"
    
    return 0
}

    # Register with Home
    register_with_home() {
        local erc20_remote_address="$1"
        local erc20_home_address="$2"
        
        log "=========================================================================="
        log "Register with Home"
        
        local command="cast send --private-key=$PRIVATE_KEY --rpc-url=$RPC_URL_REMOTE \
            $erc20_remote_address \"registerWithHome((address,uint256))\" \
            \"($erc20_home_address,0)\""
        
        local output
        output=$(execute_forge "$command" "Register with Home")
        
        local tx_hash
        tx_hash=$(extract_tx_hash "$output")
        
        log "Register Transaction Hash: $tx_hash"
        
        # Store for results
        REGISTER_TX_HASH="$tx_hash"
    }

    # Approve ERC20 tokens
    approve_erc20() {
        local erc20_token_address="$1"
        local erc20_home_address="$2"
        local amount="${3:-100000}"
        
        log "=========================================================================="
        log "Approve Transaction"
        log "Approving $amount wei (0.1 USDC) for ERC20Home contract..."
        
        local command="cast send --private-key=$PRIVATE_KEY --rpc-url=$RPC_URL_HOME \
            $erc20_token_address \"approve(address,uint256)\" \
            \"$erc20_home_address\" $amount"
        
        local output
        output=$(execute_forge "$command" "ERC20 approval")
        
        local tx_hash
        tx_hash=$(extract_tx_hash "$output")
        
        log "Approve Transaction Hash: $tx_hash"
        
        # Store for results
        APPROVE_TX_HASH="$tx_hash"
    }

    # Send tokens
    send_tokens() {
        local erc20_home_address="$1"
        local erc20_remote_address="$2"
        local recipient_address="${3:-0x03F2dA5859BA2991Bc243540004793F2b646B296}"
        local amount="${4:-100000}"
        
        log "=========================================================================="
        log "Send Transaction"
        log "Sending $amount wei (0.1 USDC) tokens..."
        
        local send_params="($BLOCKCHAIN_ID_REMOTE,$erc20_remote_address,$recipient_address,$erc20_home_address,0,0,200000,0x0000000000000000000000000000000000000000)"
        
        local command="cast send --private-key=$PRIVATE_KEY --rpc-url=$RPC_URL_HOME \
            $erc20_home_address \"send((bytes32,address,address,address,uint256,uint256,uint256,address),uint256)\" \
            \"$send_params\" $amount"
        
        local output
        output=$(execute_forge "$command" "Token transfer")
        
        local tx_hash
        tx_hash=$(extract_tx_hash "$output")
        
        log "Send Transaction Hash: $tx_hash"
        
        # Store for results
        SEND_TX_HASH="$tx_hash"
    }

    # Save deployment results
    save_results() {
        local erc20_home_address="$1"
        local erc20_remote_address="$2"
        local erc20_home_tx="$3"
        local erc20_remote_tx="$4"
        
        local results="{
  \"erc20Home\": {
    \"contractAddress\": \"$erc20_home_address\",
    \"transactionHash\": \"$erc20_home_tx\"
  },
  \"erc20Remote\": {
    \"contractAddress\": \"$erc20_remote_address\",
    \"transactionHash\": \"$erc20_remote_tx\"
  },
  \"registerWithHome\": {
    \"transactionHash\": \"$REGISTER_TX_HASH\"
  },
  \"approveTokens\": {
    \"transactionHash\": \"$APPROVE_TX_HASH\"
  },
  \"sendTokens\": {
    \"transactionHash\": \"$SEND_TX_HASH\"
  },
  \"timestamp\": \"$(date -Iseconds)\"
}"
        
        echo "$results" > "$RESULTS_FILE"
        log "Deployment results saved to $RESULTS_FILE"
    }

# Wait for user input
wait_for_input() {
    local prompt="$1"
    echo -e "${YELLOW}$prompt${NC}"
    read -r
}

# Main deployment function
deploy_and_configure() {
    log "Teleporter Test Script v2.0"
    log "=========================================================================="
    
    # Validate configuration
    validate_config || exit 1
    print_config
    
    # Step 1: Deploy ERC20Home
    log "Step 1: Deploying ERC20Home contract..."
    if ! deploy_erc20_home; then
        error "Failed to deploy ERC20Home contract"
        exit 1
    fi
    
    # Store the contract address globally
    ERC20_HOME_ADDRESS="$ERC20_HOME_ADDRESS"
    
    wait_for_input "Press Enter to proceed to ERC20Remote deployment..."
    
    # Step 2: Deploy ERC20Remote
    log "Step 2: Deploying ERC20Remote contract..."
    if ! deploy_erc20_remote; then
        error "Failed to deploy ERC20Remote contract"
        exit 1
    fi
    
    # Store the contract address globally
    ERC20_REMOTE_ADDRESS="$ERC20_REMOTE_ADDRESS"
    
    wait_for_input "Press Enter to proceed to registration..."
    
    # Step 3: Register with Home
    log "Step 3: Registering remote contract with home..."
    if ! register_with_home "$ERC20_REMOTE_ADDRESS" "$ERC20_HOME_ADDRESS"; then
        error "Failed to register with home"
        exit 1
    fi
    
    # Step 4: Approve ERC20 tokens
    log "Step 4: Approving ERC20 tokens..."
    if ! approve_erc20 "$ERC20_TOKEN_ADDRESS" "$ERC20_HOME_ADDRESS"; then
        error "Failed to approve ERC20 tokens"
        exit 1
    fi
    
    # Step 5: Send tokens
    log "Step 5: Sending test tokens..."
    if ! send_tokens "$ERC20_HOME_ADDRESS" "$ERC20_REMOTE_ADDRESS"; then
        error "Failed to send tokens"
        exit 1
    fi
    
    # Save results
    save_results "$ERC20_HOME_ADDRESS" "$ERC20_REMOTE_ADDRESS" "$ERC20_HOME_TX_HASH" "$ERC20_REMOTE_TX_HASH"
    
    log "=========================================================================="
    log "Deployment and configuration completed successfully!"
    log "Contract addresses:"
    log "  ERC20Home: $ERC20_HOME_ADDRESS"
    log "  ERC20Remote: $ERC20_REMOTE_ADDRESS"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    if ! command -v forge &> /dev/null; then
        error "Foundry is not installed. Please install Foundry first."
        error ""
        error "Installation instructions:"
        error "1. Visit: https://getfoundry.sh/"
        error "2. Run: curl -L https://foundry.paradigm.xyz | bash"
        error "3. Restart your terminal or run: source ~/.bashrc"
        error "4. Run: foundryup"
        error ""
        error "For Windows:"
        error "1. Install via: https://getfoundry.sh/"
        error "2. Or use WSL/Linux subsystem"
        exit 1
    fi
    
    if ! command -v cast &> /dev/null; then
        error "Cast is not installed. Please install Foundry with cast."
        exit 1
    fi
    
    # Check if we're in a Foundry project
    # Try to find the project root by looking for foundry.toml
    local project_root=""
    local current_dir="$SCRIPT_DIR"
    
    # Walk up the directory tree to find foundry.toml
    while [[ "$current_dir" != "/" && "$current_dir" != "." ]]; do
        if [[ -f "$current_dir/foundry.toml" ]]; then
            project_root="$current_dir"
            break
        fi
        current_dir="$(dirname "$current_dir")"
    done
    
    if [[ -z "$project_root" ]]; then
        error "Could not find foundry.toml. Please ensure you're in a Foundry project."
        error "Expected to find foundry.toml in a parent directory of: $SCRIPT_DIR"
        exit 1
    fi
    
    # Store project root globally for use throughout the script
    PROJECT_ROOT="$project_root"
    
    log "Checking project structure..."
    log "Script directory: $SCRIPT_DIR"
    log "Project root: $PROJECT_ROOT"
    
    # Check if remappings file exists
    if [[ ! -f "$PROJECT_ROOT/remappings.txt" ]]; then
        error "Remappings file not found. Please ensure you're in the correct project directory."
        error "Expected remappings.txt at: $PROJECT_ROOT/remappings.txt"
        exit 1
    fi
    
    log "Prerequisites check passed"
    
    # Test remappings by trying to compile a simple contract
    log "Testing remappings..."
    # Use the project root we found earlier
    local project_root="$PROJECT_ROOT"
    cd "$project_root"
    
    if ! forge build --silent 2>/dev/null; then
        error "Foundry build failed. Please check your remappings and dependencies."
        error "Try running 'forge build' manually to see the full error."
        exit 1
    fi
    
    cd "$SCRIPT_DIR"
    log "Remappings test passed"
}

# Main execution
main() {
    # Initialize log file
    echo "ICTT Deployment Log - $(date)" > "$LOG_FILE"
    
    check_prerequisites
    deploy_and_configure
}

# Run main function
main "$@" 