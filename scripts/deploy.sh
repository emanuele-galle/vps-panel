#!/bin/bash

# Production Deployment Script for VPS Panel
# This script handles the complete deployment process

set -e

echo "========================================="
echo "VPS Panel - Production Deployment"
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
    echo "Please copy .env.production.example to .env.production and configure it."
    exit 1
fi

# Load environment variables
export $(cat .env.production | grep -v '^#' | xargs)

# Validate required environment variables
REQUIRED_VARS=("DOMAIN" "DATABASE_PASSWORD" "JWT_SECRET" "ENCRYPTION_KEY" "ACME_EMAIL")
MISSING_VARS=()

for VAR in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!VAR}" ]; then
        MISSING_VARS+=("$VAR")
    fi
done

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
    echo -e "${RED}Error: Missing required environment variables:${NC}"
    for VAR in "${MISSING_VARS[@]}"; do
        echo -e "  - ${RED}$VAR${NC}"
    done
    echo ""
    echo "Please configure them in .env.production"
    exit 1
fi

echo -e "${GREEN}✓ Environment variables validated${NC}"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed!${NC}"
    echo "Please install Docker first: https://docs.docker.com/get-docker/"
    exit 1
fi

echo -e "${GREEN}✓ Docker is installed${NC}"

# Check if Docker Compose is available
if ! docker compose version &> /dev/null; then
    echo -e "${RED}Error: Docker Compose is not available!${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Docker Compose is available${NC}"
echo ""

# Create necessary directories
echo -e "${YELLOW}Creating necessary directories...${NC}"
mkdir -p backups/postgres
mkdir -p backend/uploads
mkdir -p logs

echo -e "${GREEN}✓ Directories created${NC}"
echo ""

# Create Traefik network if it doesn't exist
echo -e "${YELLOW}Setting up Traefik network...${NC}"
if ! docker network ls | grep -q traefik-network; then
    docker network create traefik-network
    echo -e "${GREEN}✓ Traefik network created${NC}"
else
    echo -e "${GREEN}✓ Traefik network already exists${NC}"
fi
echo ""

# Build and start services
echo -e "${YELLOW}Building Docker images...${NC}"
docker compose -f docker-compose.prod.yml build --no-cache

echo -e "${GREEN}✓ Docker images built${NC}"
echo ""

echo -e "${YELLOW}Starting services...${NC}"
docker compose -f docker-compose.prod.yml up -d

echo -e "${GREEN}✓ Services started${NC}"
echo ""

# Wait for services to be healthy
echo -e "${YELLOW}Waiting for services to be healthy...${NC}"
sleep 10

# Check if database is ready
echo -e "${YELLOW}Checking database connection...${NC}"
MAX_RETRIES=30
RETRY_COUNT=0

until docker compose -f docker-compose.prod.yml exec -T postgres pg_isready -U ${DATABASE_USER} -d ${DATABASE_NAME} 2>/dev/null; do
    RETRY_COUNT=$((RETRY_COUNT+1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        echo -e "${RED}✗ Database connection timeout${NC}"
        echo "Check logs with: docker compose -f docker-compose.prod.yml logs postgres"
        exit 1
    fi
    echo "Waiting for PostgreSQL... ($RETRY_COUNT/$MAX_RETRIES)"
    sleep 2
done

echo -e "${GREEN}✓ Database is ready${NC}"
echo ""

# Run database migrations
echo -e "${YELLOW}Running database migrations...${NC}"
docker compose -f docker-compose.prod.yml exec -T backend npx prisma migrate deploy

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Database migrations completed${NC}"
else
    echo -e "${RED}✗ Database migrations failed${NC}"
    echo "Check logs with: docker compose -f docker-compose.prod.yml logs backend"
    exit 1
fi
echo ""

# Generate Prisma Client
echo -e "${YELLOW}Generating Prisma Client...${NC}"
docker compose -f docker-compose.prod.yml exec -T backend npx prisma generate
echo -e "${GREEN}✓ Prisma Client generated${NC}"
echo ""

# Initialize default system settings (non-blocking)
echo -e "${YELLOW}Initializing system settings...${NC}"
sleep 5  # Wait for backend to be fully ready

# Check service health
echo -e "${YELLOW}Checking service health...${NC}"
SERVICES=("postgres" "backend" "frontend" "traefik")

for SERVICE in "${SERVICES[@]}"; do
    if docker compose -f docker-compose.prod.yml ps $SERVICE | grep -q "Up"; then
        echo -e "${GREEN}✓ $SERVICE is running${NC}"
    else
        echo -e "${RED}✗ $SERVICE is not running${NC}"
        echo "Check logs with: docker compose -f docker-compose.prod.yml logs $SERVICE"
    fi
done
echo ""

# Display access information
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}Deployment completed successfully!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo -e "${BLUE}Access Information:${NC}"
echo -e "  Main Panel: ${GREEN}https://${DOMAIN}${NC}"
echo -e "  Traefik Dashboard: ${GREEN}https://traefik.${DOMAIN}${NC}"
echo -e "  Adminer (Database): ${GREEN}https://adminer.${DOMAIN}${NC}"
echo ""
echo -e "${YELLOW}Important Next Steps:${NC}"
echo "  1. Ensure DNS records for ${DOMAIN} point to this server"
echo "  2. Wait 1-2 minutes for SSL certificates to be issued"
echo "  3. Register your first admin user at https://${DOMAIN}"
echo "  4. Configure System Settings in the admin panel"
echo "  5. Set up automated backups (see scripts/backup.sh)"
echo ""
echo -e "${BLUE}Useful Commands:${NC}"
echo "  View logs: docker compose -f docker-compose.prod.yml logs -f [service]"
echo "  Restart services: docker compose -f docker-compose.prod.yml restart"
echo "  Stop services: docker compose -f docker-compose.prod.yml down"
echo "  Update deployment: ./scripts/deploy.sh"
echo ""
