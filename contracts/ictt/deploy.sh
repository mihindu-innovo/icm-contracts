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

# ERC2771 Configuration - AvaCloud Relayer Infrastructure
# AvaCloud provides a unified relayer that handles both home and remote chains
AVACLOUD_RELAYER_ACCOUNT="0x56112666e55fc1e735439c5c6cd34f6a4cc65e5e"  # Relayer account that pays for gas
AVACLOUD_REGISTRY_CONTRACT="0x1706b09874052916EC4330d30EeE74b902F354AC"  # Registry contract
AVACLOUD_TELEPORTER_CONTRACT="0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf"  # Teleporter contract (handles ICTT messaging)

# TODO: Need to get the actual ERC2771Forwarder address from AvaCloud
# The Teleporter contract is NOT the ERC2771 forwarder - it handles ICTT cross-chain messaging
# The relayer account is NOT the forwarder - it pays for gas
AVACLOUD_FORWARDER="0xf780e046ce91a126617847fd9ffee022b37e9ab7"  # Replace with actual ERC2771Forwarder address

# Deployment Mode
# Set to "erc2771" to deploy ERC2771-compatible contracts, "standard" for original contracts
DEPLOYMENT_MODE="erc2771"  # Options: "standard" or "erc2771"

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
    
    # Validate ERC2771 configuration if using ERC2771 mode
    if [[ "$DEPLOYMENT_MODE" == "erc2771" ]]; then
        validate_address "$AVACLOUD_RELAYER_ACCOUNT" "AVACLOUD_RELAYER_ACCOUNT" || errors=$((errors + 1))
        validate_address "$AVACLOUD_REGISTRY_CONTRACT" "AVACLOUD_REGISTRY_CONTRACT" || errors=$((errors + 1))
        validate_address "$AVACLOUD_TELEPORTER_CONTRACT" "AVACLOUD_TELEPORTER_CONTRACT" || errors=$((errors + 1))
        
        # Check if forwarder address is set (not placeholder)
        if [[ "$AVACLOUD_FORWARDER" == "0x0000000000000000000000000000000000000000" ]]; then
            error "Please set the actual ERC2771Forwarder address from AvaCloud"
            errors=$((errors + 1))
        else
            validate_address "$AVACLOUD_FORWARDER" "AVACLOUD_FORWARDER" || errors=$((errors + 1))
        fi
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
    echo "   Deployment Mode: $DEPLOYMENT_MODE"
    if [[ "$DEPLOYMENT_MODE" == "erc2771" ]]; then
        echo "   AvaCloud Relayer Account: $AVACLOUD_RELAYER_ACCOUNT"
        echo "   AvaCloud Registry Contract: $AVACLOUD_REGISTRY_CONTRACT"
        echo "   AvaCloud Teleporter Contract: $AVACLOUD_TELEPORTER_CONTRACT"
        echo "   AvaCloud ERC2771Forwarder: $AVACLOUD_FORWARDER"
    fi
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
    
    local command
    if [[ "$DEPLOYMENT_MODE" == "erc2771" ]]; then
        log "Deploying ERC2771-compatible ERC20Home with AvaCloud forwarder"
        command="forge create --rpc-url $RPC_URL_HOME --private-key $PRIVATE_KEY \
            contracts/ictt/TokenHome/ERC20TokenHome.sol:ERC20TokenHome \
            --constructor-args \
            \"$REG_HOME\" \
            \"$MNG\" \
            \"1\" \
            \"$ERC20_TOKEN_ADDRESS\" \
            \"6\" \
            \"$AVACLOUD_FORWARDER\""
    else
        log "Deploying standard ERC20Home (with zero forwarder)"
        command="forge create --rpc-url $RPC_URL_HOME --private-key $PRIVATE_KEY \
            contracts/ictt/TokenHome/ERC20TokenHome.sol:ERC20TokenHome \
            --constructor-args \
            \"$REG_HOME\" \
            \"$MNG\" \
            \"1\" \
            \"$ERC20_TOKEN_ADDRESS\" \
            \"6\" \
            \"0x0000000000000000000000000000000000000000\""
    fi
    
    local output
    output=$(execute_forge "$command" "ERC20Home deployment")
    
    local contract_address
    contract_address=$(extract_address "$output")
    local tx_hash
    tx_hash=$(extract_tx_hash "$output")
    
    if [[ -z "$contract_address" ]]; then
        error "ERC20Home deployment failed - could not extract contract address"
        return 1
    fi
    
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
    
    local command
    if [[ "$DEPLOYMENT_MODE" == "erc2771" ]]; then
        log "Deploying ERC2771-compatible ERC20Remote with AvaCloud forwarder"
        command="forge create --rpc-url $RPC_URL_REMOTE --private-key $PRIVATE_KEY \
            contracts/ictt/TokenRemote/ERC20TokenRemote.sol:ERC20TokenRemote \
            --constructor-args \
            \"$settings\" \
            \"MIHIUSDCToken\" \
            \"MUSDCT1\" \
            \"6\" \
            \"$AVACLOUD_FORWARDER\""
    else
        log "Deploying standard ERC20Remote (with zero forwarder)"
        command="forge create --rpc-url $RPC_URL_REMOTE --private-key $PRIVATE_KEY \
            contracts/ictt/TokenRemote/ERC20TokenRemote.sol:ERC20TokenRemote \
            --constructor-args \
            \"$settings\" \
            \"MIHIUSDCToken\" \
            \"MUSDCT1\" \
            \"6\" \
            \"0x0000000000000000000000000000000000000000\""
    fi
    
    local output
    output=$(execute_forge "$command" "ERC20Remote deployment")
    
    local contract_address
    contract_address=$(extract_address "$output")
    local tx_hash
    tx_hash=$(extract_tx_hash "$output")
    
    if [[ -z "$contract_address" ]]; then
        error "ERC20Remote deployment failed - could not extract contract address"
        return 1
    fi
    
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

    # Test gasless operations (only for ERC2771 mode)
    test_gasless_operations() {
        if [[ "$DEPLOYMENT_MODE" != "erc2771" ]]; then
            log "Skipping gasless tests (not in ERC2771 mode)"
            return 0
        fi
        
        log "=========================================================================="
        log "Testing Gasless Operations"
        log "Note: This requires AvaCloud's relayer to be running"
        log "You can test gasless operations using the ICTTRelayerClient.js"
        
        # Save gasless configuration
        local gasless_config="{
  \"avaCloudRelayerAccount\": \"$AVACLOUD_RELAYER_ACCOUNT\",
  \"avaCloudRegistryContract\": \"$AVACLOUD_REGISTRY_CONTRACT\",
  \"avaCloudTeleporterContract\": \"$AVACLOUD_TELEPORTER_CONTRACT\",
  \"avaCloudForwarder\": \"$AVACLOUD_FORWARDER\",
  \"erc20HomeAddress\": \"$ERC20_HOME_ADDRESS\",
  \"erc20RemoteAddress\": \"$ERC20_REMOTE_ADDRESS\",
  \"erc20TokenAddress\": \"$ERC20_TOKEN_ADDRESS\"
}"
        
        echo "$gasless_config" > "$SCRIPT_DIR/gasless_config.json"
        log "Gasless configuration saved to gasless_config.json"
        
        # Create example usage script
        local example_script="const ICTTRelayerClient = require('./ICTTRelayerClient.js');
const config = require('./gasless_config.json');

// Initialize provider and wallet
const provider = new ethers.providers.Web3Provider(window.ethereum);
const userWallet = provider.getSigner();

// Initialize contracts
const icttHomeContract = new ethers.Contract(config.erc20HomeAddress, icttHomeABI, userWallet);
const icttRemoteContract = new ethers.Contract(config.erc20RemoteAddress, icttRemoteABI, userWallet);
const forwarderContract = new ethers.Contract(config.avaCloudForwarder, forwarderABI, userWallet);

const client = new ICTTRelayerClient(
    provider, 
    icttHomeContract, 
    icttRemoteContract, 
    forwarderContract, 
    userWallet
);

// Example gasless approval
async function gaslessApprove(amount) {
    const approvalData = await client.createGaslessApproval(
        config.erc20TokenAddress, 
        config.erc20HomeAddress, 
        amount
    );
    // Use AvaCloud's relayer account
    const receipt = await client.submitGaslessTransaction(approvalData, config.avaCloudRelayerAccount);
    return receipt;
}

// Example gasless send
async function gaslessSend(destinationBlockchainID, recipient, amount) {
    const sendInput = {
        destinationBlockchainID,
        destinationTokenTransferrerAddress: config.erc20RemoteAddress,
        recipient,
        primaryFeeTokenAddress: ethers.constants.AddressZero,
        primaryFee: 0,
        secondaryFee: 0,
        requiredGasLimit: 500000,
        multiHopFallback: userWallet.address
    };
    
    const sendData = await client.createGaslessSend(sendInput, amount);
    // Use AvaCloud's relayer account
    const receipt = await client.submitGaslessTransaction(sendData, config.avaCloudRelayerAccount);
    return receipt;
}

// Example: Get AvaCloud infrastructure info
console.log('AvaCloud Relayer Account:', config.avaCloudRelayerAccount);
console.log('AvaCloud Registry Contract:', config.avaCloudRegistryContract);
console.log('AvaCloud Teleporter Contract:', config.avaCloudTeleporterContract);
"
        
        echo "$example_script" > "$SCRIPT_DIR/example_gasless_usage.js"
        log "Example gasless usage script saved to example_gasless_usage.js"
    }

    # Save deployment results
    save_results() {
        local erc20_home_address="$1"
        local erc20_remote_address="$2"
        local erc20_home_tx="$3"
        local erc20_remote_tx="$4"
        
        local results="{
  \"deploymentMode\": \"$DEPLOYMENT_MODE\",
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
  }"
        
        if [[ "$DEPLOYMENT_MODE" == "erc2771" ]]; then
            results="$results,
  \"avaCloudRelayerAccount\": \"$AVACLOUD_RELAYER_ACCOUNT\",
  \"avaCloudRegistryContract\": \"$AVACLOUD_REGISTRY_CONTRACT\",
  \"avaCloudTeleporterContract\": \"$AVACLOUD_TELEPORTER_CONTRACT\",
  \"avaCloudForwarder\": \"$AVACLOUD_FORWARDER\""
        fi
        
        results="$results,
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
    
    # Step 6: Test gasless operations (ERC2771 mode only)
    test_gasless_operations
    
    # Save results
    save_results "$ERC20_HOME_ADDRESS" "$ERC20_REMOTE_ADDRESS" "$ERC20_HOME_TX_HASH" "$ERC20_REMOTE_TX_HASH"
    
    log "=========================================================================="
    log "Deployment and configuration completed successfully!"
    log "Contract addresses:"
    log "  ERC20Home: $ERC20_HOME_ADDRESS"
    log "  ERC20Remote: $ERC20_REMOTE_ADDRESS"
    
    if [[ "$DEPLOYMENT_MODE" == "erc2771" ]]; then
        log ""
        log "ERC2771 Gasless Configuration:"
        log "  AvaCloud Relayer Account: $AVACLOUD_RELAYER_ACCOUNT"
        log "  AvaCloud Registry Contract: $AVACLOUD_REGISTRY_CONTRACT"
        log "  AvaCloud Teleporter Contract: $AVACLOUD_TELEPORTER_CONTRACT"
        log "  AvaCloud Unified Forwarder: $AVACLOUD_FORWARDER"
        log "  Gasless config saved to: gasless_config.json"
        log "  Example usage saved to: example_gasless_usage.js"
        log ""
        log "To test gasless operations:"
        log "  1. Use ICTTRelayerClient.js with the generated config"
        log "  2. AvaCloud relayer handles gas for both chains"
        log "  3. Test with small amounts first"
        log ""
        log "AvaCloud Infrastructure:"
        log "  - Relayer Account pays for gas on both chains"
        log "  - Teleporter Contract handles ICTT cross-chain messaging"
        log "  - Registry Contract manages contract registrations"
        log "  - ERC2771Forwarder handles meta-transactions"
    fi
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