#!/bin/bash

# Restore script for gasless_config.json
# This script restores the gasless config from backup

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
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

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

# Check if backup file exists
if [[ ! -f "$BACKUP_FILE" ]]; then
    error "No backup file found: $BACKUP_FILE"
    error "Run backup_gasless_config.sh first to create a backup"
    exit 1
fi

log "Found backup file: $BACKUP_FILE"

# Ask for confirmation
echo -e "${YELLOW}This will overwrite the current gasless_config.json with the backup.${NC}"
echo -e "${YELLOW}Current config will be lost. Continue? (y/N)${NC}"
read -r response

if [[ "$response" =~ ^[Yy]$ ]]; then
    log "Restoring gasless_config.json from backup..."
    cp "$BACKUP_FILE" "$CONFIG_FILE"
    log "Restore completed successfully"
    log "Current config: $CONFIG_FILE"
    log "Backup file: $BACKUP_FILE"
else
    log "Restore cancelled"
fi 