#!/bin/bash

# Sync gasless config between contracts and tests directories
# This script can be used to manually sync the config files

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR=$(dirname "$0")
CONTRACTS_CONFIG="$SCRIPT_DIR/../../../contracts/ictt/gasless_config.json"
TESTS_CONFIG="$SCRIPT_DIR/gasless_config.json"

log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

info() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

# Function to sync from contracts to tests
sync_to_tests() {
    if [[ ! -f "$CONTRACTS_CONFIG" ]]; then
        warn "Contracts config not found: $CONTRACTS_CONFIG"
        return 1
    fi
    
    log "Copying config from contracts to tests..."
    cp "$CONTRACTS_CONFIG" "$TESTS_CONFIG"
    log "✅ Config synced to tests directory"
}

# Function to sync from tests to contracts
sync_to_contracts() {
    if [[ ! -f "$TESTS_CONFIG" ]]; then
        warn "Tests config not found: $TESTS_CONFIG"
        return 1
    fi
    
    log "Copying config from tests to contracts..."
    cp "$TESTS_CONFIG" "$CONTRACTS_CONFIG"
    log "✅ Config synced to contracts directory"
}

# Function to show differences
show_diff() {
    if [[ ! -f "$CONTRACTS_CONFIG" ]] || [[ ! -f "$TESTS_CONFIG" ]]; then
        warn "One or both config files not found"
        return 1
    fi
    
    log "Showing differences between config files..."
    diff "$CONTRACTS_CONFIG" "$TESTS_CONFIG" || true
}

# Function to validate config
validate_config() {
    local config_file="$1"
    local config_name="$2"
    
    if [[ ! -f "$config_file" ]]; then
        warn "$config_name config not found: $config_file"
        return 1
    fi
    
    log "Validating $config_name config..."
    
    # Check if it's valid JSON
    if ! jq empty "$config_file" 2>/dev/null; then
        warn "$config_name config is not valid JSON"
        return 1
    fi
    
    # Check required fields
    local required_fields=("avaCloudRpcUrl" "avaCloudAuth" "erc20HomeAddress" "erc20RemoteAddress")
    local missing_fields=()
    
    for field in "${required_fields[@]}"; do
        if ! jq -e ".$field" "$config_file" > /dev/null 2>&1; then
            missing_fields+=("$field")
        fi
    done
    
    if [[ ${#missing_fields[@]} -gt 0 ]]; then
        warn "$config_name config missing fields: ${missing_fields[*]}"
        return 1
    else
        log "✅ $config_name config is valid"
    fi
}

# Main function
main() {
    case "${1:-help}" in
        "to-tests")
            sync_to_tests
            ;;
        "to-contracts")
            sync_to_contracts
            ;;
        "diff")
            show_diff
            ;;
        "validate")
            validate_config "$CONTRACTS_CONFIG" "Contracts"
            validate_config "$TESTS_CONFIG" "Tests"
            ;;
        "help"|*)
            echo "Usage: $0 [command]"
            echo ""
            echo "Commands:"
            echo "  to-tests     - Copy config from contracts to tests directory"
            echo "  to-contracts - Copy config from tests to contracts directory"
            echo "  diff         - Show differences between config files"
            echo "  validate     - Validate both config files"
            echo "  help         - Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0 to-tests     # After deployment, sync to tests"
            echo "  $0 validate     # Check if configs are valid"
            echo "  $0 diff         # See what's different"
            ;;
    esac
}

# Run main function
main "$@" 