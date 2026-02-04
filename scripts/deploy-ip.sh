#!/bin/bash

# IP-Based Deployment Script for VPS Panel
# This script handles deployment without domain/SSL for direct IP access

set -e

echo "========================================="
echo "VPS Panel - IP-Based Deployment"
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

# Check if .env.ip exists
if [ ! -f .env.ip ]; then
    echo -e "${YELLOW}Creating .env.ip from example...${NC}"

    if [ -f .env.ip.example ]; then
        cp .env.ip.example .env.ip

        # Try to detect server IP
        SERVER_IP=$(curl -s ifconfig.me || curl -s icanhazip.com || echo "")

        if [ ! -z "$SERVER_IP" ]; then
            echo -e "${GREEN}Detected server IP: ${SERVER_IP}${NC}"
            sed -i "s/YOUR_SERVER_IP_HERE/${SERVER_IP}/g" .env.ip
        fi

        # Generate secure passwords
        DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
        JWT_SECRET=$(openssl rand -base64 64)
        ENCRYPTION_KEY=$(openssl rand -hex 32)

        # Update .env.ip with generated values
        sed -i "s/CHANGE_ME_STRONG_PASSWORD_HERE/${DB_PASSWORD}/g" .env.ip
        sed -i "s|CHANGE_ME_STRONG_SECRET_HERE|${JWT_SECRET}|g" .env.ip
        sed -i "s/CHANGE_ME_32_BYTE_HEX_KEY_HERE/${ENCRYPTION_KEY}/g" .env.ip

        echo -e "${GREEN}✓ .env.ip created with auto-generated credentials${NC}"
        echo -e "${YELLOW}Please review and update .env.ip if needed${NC}"
        echo ""
    else
        echo -e "${RED}Error: .env.ip.example not found!${NC}"
        exit 1
    fi
fi

# Load environment variables
export $(cat .env.ip | grep -v '^#' | xargs)

# Validate required environment variables
REQUIRED_VARS=("DATABASE_PASSWORD" "JWT_SECRET" "ENCRYPTION_KEY")
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
    echo "Please configure them in .env.ip"
    exit 1
fi

# Get server IP
if [ -z "$SERVER_IP" ] || [ "$SERVER_IP" == "YOUR_SERVER_IP_HERE" ]; then
    SERVER_IP=$(curl -s ifconfig.me || curl -s icanhazip.com || echo "")
    if [ -z "$SERVER_IP" ]; then
        echo -e "${YELLOW}Warning: Could not detect server IP automatically${NC}"
        read -p "Enter your server IP address: " SERVER_IP
    fi

    # Update .env.ip with detected IP
    if grep -q "SERVER_IP=YOUR_SERVER_IP_HERE" .env.ip; then
        sed -i "s/YOUR_SERVER_IP_HERE/${SERVER_IP}/g" .env.ip
    elif grep -q "SERVER_IP=" .env.ip; then
        sed -i "s/SERVER_IP=.*/SERVER_IP=${SERVER_IP}/g" .env.ip
    else
        echo "SERVER_IP=${SERVER_IP}" >> .env.ip
    fi

    export SERVER_IP
fi

echo -e "${GREEN}✓ Environment variables validated${NC}"
echo -e "${BLUE}Server IP: ${SERVER_IP}${NC}"
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

# Build and start services
echo -e "${YELLOW}Building Docker images...${NC}"
docker compose -f docker-compose.ip.yml --env-file .env.ip build --no-cache

echo -e "${GREEN}✓ Docker images built${NC}"
echo ""

echo -e "${YELLOW}Starting services...${NC}"
docker compose -f docker-compose.ip.yml --env-file .env.ip up -d

echo -e "${GREEN}✓ Services started${NC}"
echo ""

# Wait for services to be healthy
echo -e "${YELLOW}Waiting for services to be healthy...${NC}"
sleep 10

# Check if database is ready
echo -e "${YELLOW}Checking database connection...${NC}"
MAX_RETRIES=30
RETRY_COUNT=0

until docker compose -f docker-compose.ip.yml --env-file .env.ip exec -T postgres pg_isready -U ${DATABASE_USER} -d ${DATABASE_NAME} 2>/dev/null; do
    RETRY_COUNT=$((RETRY_COUNT+1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        echo -e "${RED}✗ Database connection timeout${NC}"
        echo "Check logs with: docker compose -f docker-compose.ip.yml logs postgres"
        exit 1
    fi
    echo "Waiting for PostgreSQL... ($RETRY_COUNT/$MAX_RETRIES)"
    sleep 2
done

echo -e "${GREEN}✓ Database is ready${NC}"
echo ""

# Run database migrations
echo -e "${YELLOW}Running database migrations...${NC}"
docker compose -f docker-compose.ip.yml --env-file .env.ip exec -T backend npx prisma migrate deploy

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Database migrations completed${NC}"
else
    echo -e "${RED}✗ Database migrations failed${NC}"
    echo "Check logs with: docker compose -f docker-compose.ip.yml logs backend"
    exit 1
fi
echo ""

# Generate Prisma Client
echo -e "${YELLOW}Generating Prisma Client...${NC}"
docker compose -f docker-compose.ip.yml --env-file .env.ip exec -T backend npx prisma generate
echo -e "${GREEN}✓ Prisma Client generated${NC}"
echo ""

# Check service health
echo -e "${YELLOW}Checking service health...${NC}"
SERVICES=("postgres" "backend" "frontend" "adminer")

for SERVICE in "${SERVICES[@]}"; do
    if docker compose -f docker-compose.ip.yml ps $SERVICE | grep -q "Up"; then
        echo -e "${GREEN}✓ $SERVICE is running${NC}"
    else
        echo -e "${RED}✗ $SERVICE is not running${NC}"
        echo "Check logs with: docker compose -f docker-compose.ip.yml logs $SERVICE"
    fi
done
echo ""

# Display access information
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}Deployment completed successfully!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo -e "${BLUE}Access Information:${NC}"
echo -e "  Main Panel: ${GREEN}http://${SERVER_IP}:3000${NC}"
echo -e "  Backend API: ${GREEN}http://${SERVER_IP}:3001${NC}"
echo -e "  API Health: ${GREEN}http://${SERVER_IP}:3001/health${NC}"
echo -e "  Adminer (Database): ${GREEN}http://${SERVER_IP}:8080${NC}"
echo ""
echo -e "${YELLOW}Important Notes:${NC}"
echo "  ⚠️  This deployment uses HTTP (not HTTPS)"
echo "  ⚠️  No SSL/TLS encryption - suitable for testing only"
echo "  ⚠️  For production, use domain-based deployment with SSL"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Register your first admin user at http://${SERVER_IP}:3000"
echo "  2. Configure System Settings in the admin panel"
echo "  3. Ensure firewall allows ports 3000, 3001, 8080"
echo ""
echo -e "${BLUE}Firewall Configuration (if using UFW):${NC}"
echo "  sudo ufw allow 3000/tcp  # Frontend"
echo "  sudo ufw allow 3001/tcp  # Backend API"
echo "  sudo ufw allow 8080/tcp  # Adminer"
echo ""
echo -e "${BLUE}Useful Commands:${NC}"
echo "  View logs: docker compose -f docker-compose.ip.yml logs -f [service]"
echo "  Restart services: docker compose -f docker-compose.ip.yml restart"
echo "  Stop services: docker compose -f docker-compose.ip.yml down"
echo ""
