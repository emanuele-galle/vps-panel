#!/bin/bash

# Database Initialization Script for VPS Panel
# This script initializes the database with Prisma migrations

set -e

echo "========================================="
echo "VPS Panel - Database Initialization"
echo "========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env.production exists
if [ ! -f .env.production ]; then
    echo -e "${RED}Error: .env.production file not found!${NC}"
    echo "Please copy .env.production.example to .env.production and configure it."
    exit 1
fi

# Load environment variables
export $(cat .env.production | grep -v '^#' | xargs)

echo -e "${YELLOW}Checking database connection...${NC}"

# Wait for database to be ready
until docker compose -f docker-compose.prod.yml exec -T postgres pg_isready -U ${DATABASE_USER} -d ${DATABASE_NAME} 2>/dev/null; do
    echo "Waiting for PostgreSQL to be ready..."
    sleep 2
done

echo -e "${GREEN}✓ Database is ready${NC}"
echo ""

echo -e "${YELLOW}Running Prisma migrations...${NC}"

# Run migrations in the backend container
docker compose -f docker-compose.prod.yml exec -T backend npx prisma migrate deploy

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Migrations completed successfully${NC}"
else
    echo -e "${RED}✗ Migrations failed${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Generating Prisma Client...${NC}"

# Generate Prisma Client
docker compose -f docker-compose.prod.yml exec -T backend npx prisma generate

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Prisma Client generated${NC}"
else
    echo -e "${RED}✗ Prisma Client generation failed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}Database initialization completed!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "Next steps:"
echo "1. Create your first admin user via the registration page"
echo "2. Access the panel at https://${DOMAIN}"
echo ""
