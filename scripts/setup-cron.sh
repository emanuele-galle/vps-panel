#!/bin/bash

# Setup Automated Backups with Cron
# This script configures automatic backups

set -e

echo "========================================="
echo "VPS Panel - Setup Automated Backups"
echo "========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Check if .env.production exists
if [ -f "${PROJECT_ROOT}/.env.production" ]; then
    export $(cat "${PROJECT_ROOT}/.env.production" | grep -v '^#' | xargs)
fi

BACKUP_SCHEDULE=${BACKUP_SCHEDULE:-"0 2 * * *"}  # Default: 2 AM daily

echo -e "${YELLOW}Configuring automated backups...${NC}"
echo ""
echo "Schedule: ${BACKUP_SCHEDULE}"
echo "Script: ${SCRIPT_DIR}/backup.sh"
echo ""

# Make scripts executable
chmod +x "${SCRIPT_DIR}/backup.sh"
chmod +x "${SCRIPT_DIR}/restore.sh"
chmod +x "${SCRIPT_DIR}/deploy.sh"
chmod +x "${SCRIPT_DIR}/init-db.sh"

echo -e "${GREEN}✓ Scripts made executable${NC}"

# Create cron job
CRON_JOB="${BACKUP_SCHEDULE} cd ${PROJECT_ROOT} && ${SCRIPT_DIR}/backup.sh >> ${PROJECT_ROOT}/logs/backup.log 2>&1"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "${SCRIPT_DIR}/backup.sh"; then
    echo -e "${YELLOW}Cron job already exists. Updating...${NC}"
    # Remove old cron job
    crontab -l 2>/dev/null | grep -v "${SCRIPT_DIR}/backup.sh" | crontab -
fi

# Add new cron job
(crontab -l 2>/dev/null; echo "${CRON_JOB}") | crontab -

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Cron job configured${NC}"
else
    echo -e "${RED}✗ Failed to configure cron job${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}Current crontab:${NC}"
crontab -l | grep backup.sh || echo "No backup jobs found"

echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}Automated backups configured!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "Backup schedule: ${BACKUP_SCHEDULE}"
echo "Backup logs: ${PROJECT_ROOT}/logs/backup.log"
echo ""
echo -e "${BLUE}Useful commands:${NC}"
echo "  View crontab: crontab -l"
echo "  Edit crontab: crontab -e"
echo "  Manual backup: ${SCRIPT_DIR}/backup.sh"
echo "  View backup logs: tail -f ${PROJECT_ROOT}/logs/backup.log"
echo ""
