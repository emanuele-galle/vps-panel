#!/bin/bash

# N8N Backup Automation Script
# Runs daily at 3 AM via cron: 0 3 * * *

set -e

BACKUP_DIR="/var/backups/vps-panel/n8n"
DATE=$(date +%Y%m%d_%H%M%S)
N8N_CONTAINER="vps-panel-n8n"
RETENTION_DAYS=30

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} ERROR: $1" >&2
}

warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} WARNING: $1"
}

# Check if N8N container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${N8N_CONTAINER}$"; then
    error "N8N container is not running"
    exit 1
fi

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

log "Starting N8N backup..."

# Export workflows
log "Exporting workflows..."
WORKFLOWS_RAW=$(docker exec "$N8N_CONTAINER" n8n export:workflow --all --output=/dev/stdout 2>&1 | sed -n '/^\[/,/^\]/p')
if [ -n "$WORKFLOWS_RAW" ]; then
    echo "$WORKFLOWS_RAW" | jq -c '.' > "${BACKUP_DIR}/workflows_${DATE}.json" || echo "[]" > "${BACKUP_DIR}/workflows_${DATE}.json"
else
    warning "No workflows to export"
    echo "[]" > "${BACKUP_DIR}/workflows_${DATE}.json"
fi

# Export credentials (encrypted)
log "Exporting credentials..."
CREDENTIALS_RAW=$(docker exec "$N8N_CONTAINER" n8n export:credentials --all --output=/dev/stdout 2>&1 | sed -n '/^\[/,/^\]/p')
if [ -n "$CREDENTIALS_RAW" ]; then
    echo "$CREDENTIALS_RAW" | jq -c '.' > "${BACKUP_DIR}/credentials_${DATE}.json" || echo "[]" > "${BACKUP_DIR}/credentials_${DATE}.json"
else
    warning "No credentials to export"
    echo "[]" > "${BACKUP_DIR}/credentials_${DATE}.json"
fi

# Keep workflows and credentials as final backups
cp "${BACKUP_DIR}/workflows_${DATE}.json" "${BACKUP_DIR}/n8n-workflows-backup-${DATE}.json"
cp "${BACKUP_DIR}/credentials_${DATE}.json" "${BACKUP_DIR}/n8n-credentials-backup-${DATE}.json"

# Remove temporary files
rm -f "${BACKUP_DIR}/workflows_${DATE}.json" "${BACKUP_DIR}/credentials_${DATE}.json"

# Get backup size
WORKFLOWS_BACKUP="${BACKUP_DIR}/n8n-workflows-backup-${DATE}.json"
BACKUP_SIZE=$(stat -c%s "$WORKFLOWS_BACKUP" 2>/dev/null || stat -f%z "$WORKFLOWS_BACKUP")
BACKUP_SIZE_KB=$(echo "scale=2; $BACKUP_SIZE / 1024" | bc)

log "Backup created: n8n-workflows-backup-${DATE}.json (${BACKUP_SIZE_KB} KB)"

# Cleanup old backups
log "Cleaning up backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "n8n-*-backup-*.json" -type f -mtime +$RETENTION_DAYS -delete

REMAINING_BACKUPS=$(find "$BACKUP_DIR" -name "n8n-workflows-backup-*.json" -type f | wc -l)
log "Backup completed successfully. $REMAINING_BACKUPS backups remaining."

exit 0
