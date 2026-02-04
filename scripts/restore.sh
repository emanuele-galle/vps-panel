#!/bin/bash

# Restore Script for VPS Panel
# This script restores backups of the database and data

set -e

echo "========================================="
echo "VPS Panel - Restore from Backup"
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

cd "$PROJECT_ROOT"

# Check if .env.production exists
if [ ! -f .env.production ]; then
    echo -e "${RED}Error: .env.production file not found!${NC}"
    exit 1
fi

# Load environment variables
export $(cat .env.production | grep -v '^#' | xargs)

BACKUP_DIR="${PROJECT_ROOT}/backups"

# ==========================================
# List Available Backups
# ==========================================
echo -e "${BLUE}Available database backups:${NC}"
echo ""

DB_BACKUPS=($(find "${BACKUP_DIR}/postgres" -name "backup_*.sql.gz" -type f | sort -r))

if [ ${#DB_BACKUPS[@]} -eq 0 ]; then
    echo -e "${RED}No database backups found!${NC}"
    exit 1
fi

for i in "${!DB_BACKUPS[@]}"; do
    BACKUP_FILE="${DB_BACKUPS[$i]}"
    BACKUP_NAME=$(basename "$BACKUP_FILE")
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    BACKUP_DATE=$(stat -c %y "$BACKUP_FILE" | cut -d'.' -f1)
    echo "  [$i] ${BACKUP_NAME} - ${BACKUP_SIZE} - ${BACKUP_DATE}"
done

echo ""

# ==========================================
# Select Backup
# ==========================================
if [ -z "$1" ]; then
    read -p "Enter backup number to restore (or 'q' to quit): " BACKUP_NUM

    if [ "$BACKUP_NUM" == "q" ]; then
        echo "Restore cancelled."
        exit 0
    fi
else
    BACKUP_NUM="$1"
fi

if ! [[ "$BACKUP_NUM" =~ ^[0-9]+$ ]] || [ "$BACKUP_NUM" -ge "${#DB_BACKUPS[@]}" ]; then
    echo -e "${RED}Invalid backup number!${NC}"
    exit 1
fi

SELECTED_BACKUP="${DB_BACKUPS[$BACKUP_NUM]}"
echo ""
echo -e "${YELLOW}Selected backup: $(basename $SELECTED_BACKUP)${NC}"

# ==========================================
# Confirmation
# ==========================================
echo ""
echo -e "${RED}WARNING: This will replace the current database with the backup!${NC}"
echo -e "${RED}All current data will be lost!${NC}"
echo ""
read -p "Are you sure you want to continue? (type 'yes' to confirm): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Restore cancelled."
    exit 0
fi

echo ""

# ==========================================
# Stop Backend Service
# ==========================================
echo -e "${YELLOW}Stopping backend service...${NC}"
docker compose -f docker-compose.prod.yml stop backend
echo -e "${GREEN}✓ Backend stopped${NC}"
echo ""

# ==========================================
# Create Safety Backup
# ==========================================
echo -e "${YELLOW}Creating safety backup of current database...${NC}"
SAFETY_BACKUP="${BACKUP_DIR}/postgres/safety_backup_$(date +%Y%m%d_%H%M%S).sql.gz"

docker compose -f docker-compose.prod.yml exec -T postgres pg_dump \
    -U ${DATABASE_USER} \
    -d ${DATABASE_NAME} \
    --clean \
    --if-exists \
    --format=plain \
    | gzip > "${SAFETY_BACKUP}"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Safety backup created: ${SAFETY_BACKUP}${NC}"
else
    echo -e "${RED}✗ Safety backup failed${NC}"
    echo "Restore aborted for safety reasons."
    docker compose -f docker-compose.prod.yml start backend
    exit 1
fi
echo ""

# ==========================================
# Restore Database
# ==========================================
echo -e "${YELLOW}Restoring database from backup...${NC}"

# Drop all connections
docker compose -f docker-compose.prod.yml exec -T postgres psql \
    -U ${DATABASE_USER} \
    -d postgres \
    -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${DATABASE_NAME}' AND pid <> pg_backend_pid();" \
    >/dev/null 2>&1 || true

# Restore database
gunzip -c "${SELECTED_BACKUP}" | docker compose -f docker-compose.prod.yml exec -T postgres psql \
    -U ${DATABASE_USER} \
    -d ${DATABASE_NAME}

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Database restored successfully${NC}"
else
    echo -e "${RED}✗ Database restore failed${NC}"
    echo ""
    echo -e "${YELLOW}Attempting to restore safety backup...${NC}"

    gunzip -c "${SAFETY_BACKUP}" | docker compose -f docker-compose.prod.yml exec -T postgres psql \
        -U ${DATABASE_USER} \
        -d ${DATABASE_NAME}

    docker compose -f docker-compose.prod.yml start backend
    exit 1
fi
echo ""

# ==========================================
# Restore Uploads (if available)
# ==========================================
BACKUP_TIMESTAMP=$(basename "$SELECTED_BACKUP" | sed 's/backup_\(.*\)\.sql\.gz/\1/')
UPLOADS_BACKUP="${BACKUP_DIR}/uploads/backup_${BACKUP_TIMESTAMP}.tar.gz"

if [ -f "${UPLOADS_BACKUP}" ]; then
    echo -e "${YELLOW}Restoring uploads...${NC}"

    # Backup current uploads
    if [ -d "${PROJECT_ROOT}/backend/uploads" ]; then
        mv "${PROJECT_ROOT}/backend/uploads" "${PROJECT_ROOT}/backend/uploads.bak.$(date +%Y%m%d_%H%M%S)"
    fi

    # Restore uploads
    tar -xzf "${UPLOADS_BACKUP}" -C "${PROJECT_ROOT}/backend/"

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Uploads restored${NC}"
    else
        echo -e "${YELLOW}⚠ Uploads restore failed (non-critical)${NC}"
    fi
else
    echo -e "${YELLOW}ℹ No uploads backup found for this timestamp${NC}"
fi
echo ""

# ==========================================
# Start Backend Service
# ==========================================
echo -e "${YELLOW}Starting backend service...${NC}"
docker compose -f docker-compose.prod.yml start backend

# Wait for backend to be ready
sleep 5
echo -e "${GREEN}✓ Backend started${NC}"
echo ""

# ==========================================
# Summary
# ==========================================
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}Restore completed successfully!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "Restored from: $(basename $SELECTED_BACKUP)"
echo "Safety backup: ${SAFETY_BACKUP}"
echo ""
echo -e "${BLUE}The panel should now be accessible at: https://${DOMAIN}${NC}"
echo ""
