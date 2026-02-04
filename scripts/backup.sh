#!/bin/bash

# Backup Script for VPS Panel
# This script creates backups of the database and important data

set -e

echo "========================================="
echo "VPS Panel - Backup"
echo "========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

# Configuration
BACKUP_DIR="${PROJECT_ROOT}/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}

# Create backup directories
mkdir -p "${BACKUP_DIR}/postgres"
mkdir -p "${BACKUP_DIR}/uploads"
mkdir -p "${BACKUP_DIR}/volumes"

echo -e "${YELLOW}Creating backup: ${TIMESTAMP}${NC}"
echo ""

# ==========================================
# Database Backup
# ==========================================
echo -e "${YELLOW}Backing up PostgreSQL database...${NC}"

DB_BACKUP_FILE="${BACKUP_DIR}/postgres/backup_${TIMESTAMP}.sql.gz"

docker compose -f docker-compose.prod.yml exec -T postgres pg_dump \
    -U ${DATABASE_USER} \
    -d ${DATABASE_NAME} \
    --clean \
    --if-exists \
    --format=plain \
    | gzip > "${DB_BACKUP_FILE}"

if [ $? -eq 0 ]; then
    DB_SIZE=$(du -h "${DB_BACKUP_FILE}" | cut -f1)
    echo -e "${GREEN}✓ Database backup created: ${DB_BACKUP_FILE} (${DB_SIZE})${NC}"
else
    echo -e "${RED}✗ Database backup failed${NC}"
    exit 1
fi

# ==========================================
# Uploads Backup
# ==========================================
echo -e "${YELLOW}Backing up uploads...${NC}"

if [ -d "${PROJECT_ROOT}/backend/uploads" ] && [ "$(ls -A ${PROJECT_ROOT}/backend/uploads 2>/dev/null)" ]; then
    UPLOADS_BACKUP_FILE="${BACKUP_DIR}/uploads/backup_${TIMESTAMP}.tar.gz"

    tar -czf "${UPLOADS_BACKUP_FILE}" -C "${PROJECT_ROOT}/backend" uploads/

    if [ $? -eq 0 ]; then
        UPLOADS_SIZE=$(du -h "${UPLOADS_BACKUP_FILE}" | cut -f1)
        echo -e "${GREEN}✓ Uploads backup created: ${UPLOADS_BACKUP_FILE} (${UPLOADS_SIZE})${NC}"
    else
        echo -e "${RED}✗ Uploads backup failed${NC}"
    fi
else
    echo -e "${YELLOW}ℹ No uploads to backup${NC}"
fi

# ==========================================
# Docker Volumes Backup (Optional)
# ==========================================
echo -e "${YELLOW}Backing up Docker volumes...${NC}"

VOLUMES_BACKUP_FILE="${BACKUP_DIR}/volumes/backup_${TIMESTAMP}.tar.gz"

# Backup postgres data volume
docker run --rm \
    -v vps-panel-postgres-data:/data \
    -v "${BACKUP_DIR}/volumes:/backup" \
    alpine \
    tar -czf "/backup/postgres_volume_${TIMESTAMP}.tar.gz" -C /data .

if [ $? -eq 0 ]; then
    VOLUMES_SIZE=$(du -h "${BACKUP_DIR}/volumes/postgres_volume_${TIMESTAMP}.tar.gz" | cut -f1)
    echo -e "${GREEN}✓ Volume backup created (${VOLUMES_SIZE})${NC}"
else
    echo -e "${YELLOW}⚠ Volume backup skipped${NC}"
fi

# ==========================================
# Configuration Backup
# ==========================================
echo -e "${YELLOW}Backing up configuration files...${NC}"

CONFIG_BACKUP_FILE="${BACKUP_DIR}/config_${TIMESTAMP}.tar.gz"

tar -czf "${CONFIG_BACKUP_FILE}" \
    --exclude='.env.production' \
    docker-compose.prod.yml \
    .env.production.example \
    2>/dev/null || true

if [ -f "${CONFIG_BACKUP_FILE}" ]; then
    echo -e "${GREEN}✓ Configuration backup created${NC}"
fi

echo ""

# ==========================================
# Cleanup Old Backups
# ==========================================
echo -e "${YELLOW}Cleaning up old backups (older than ${RETENTION_DAYS} days)...${NC}"

# Find and delete old backups
find "${BACKUP_DIR}/postgres" -name "backup_*.sql.gz" -type f -mtime +${RETENTION_DAYS} -delete 2>/dev/null || true
find "${BACKUP_DIR}/uploads" -name "backup_*.tar.gz" -type f -mtime +${RETENTION_DAYS} -delete 2>/dev/null || true
find "${BACKUP_DIR}/volumes" -name "*.tar.gz" -type f -mtime +${RETENTION_DAYS} -delete 2>/dev/null || true
find "${BACKUP_DIR}" -name "config_*.tar.gz" -type f -mtime +${RETENTION_DAYS} -delete 2>/dev/null || true

TOTAL_BACKUPS=$(find "${BACKUP_DIR}" -name "backup_*" -type f | wc -l)
echo -e "${GREEN}✓ Cleanup completed (${TOTAL_BACKUPS} backups remaining)${NC}"

echo ""

# ==========================================
# Backup Summary
# ==========================================
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}Backup completed successfully!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "Backup Location: ${BACKUP_DIR}"
echo "Timestamp: ${TIMESTAMP}"
echo ""
echo "Backed up:"
if [ -f "${DB_BACKUP_FILE}" ]; then
    echo "  ✓ Database: $(du -h ${DB_BACKUP_FILE} | cut -f1)"
fi
if [ -f "${UPLOADS_BACKUP_FILE}" ]; then
    echo "  ✓ Uploads: $(du -h ${UPLOADS_BACKUP_FILE} | cut -f1)"
fi
if [ -f "${BACKUP_DIR}/volumes/postgres_volume_${TIMESTAMP}.tar.gz" ]; then
    echo "  ✓ Volumes: $(du -h ${BACKUP_DIR}/volumes/postgres_volume_${TIMESTAMP}.tar.gz | cut -f1)"
fi
echo ""
echo "Total disk usage: $(du -sh ${BACKUP_DIR} | cut -f1)"
echo ""
