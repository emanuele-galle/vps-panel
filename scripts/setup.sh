#!/bin/bash

# VPS Panel Setup Script

set -e

echo "🚀 VPS Control Panel - Initial Setup"
echo "======================================"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "⚠️  This script should be run as root or with sudo"
  exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
  echo "❌ Docker is not installed. Please install Docker first."
  exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker compose &> /dev/null; then
  echo "❌ Docker Compose is not installed. Please install Docker Compose first."
  exit 1
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
  echo "📝 Creating .env file..."
  cp .env.example .env

  # Generate secure passwords
  POSTGRES_PASSWORD=$(openssl rand -base64 32)
  REDIS_PASSWORD=$(openssl rand -base64 32)
  JWT_SECRET=$(openssl rand -base64 48)

  # Update .env with generated passwords
  sed -i "s/change-this-secure-password/$POSTGRES_PASSWORD/" .env
  sed -i "s/change-this-redis-password/$REDIS_PASSWORD/" .env
  sed -i "s/change-this-to-a-very-long-random-secret-key-at-least-32-characters/$JWT_SECRET/" .env

  echo "✅ .env file created with secure passwords"
  echo ""
  echo "⚠️  IMPORTANT: Please edit .env and configure:"
  echo "  - PANEL_DOMAIN (your panel domain)"
  echo "  - PREVIEW_DOMAIN (your preview domain)"
  echo "  - CLOUDFLARE_EMAIL and CLOUDFLARE_API_KEY (if using wildcard SSL)"
  echo "  - HOSTINGER_API_KEY (if using Hostinger API)"
  echo ""
  read -p "Press Enter to continue after editing .env..."
fi

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p /var/www/projects
mkdir -p traefik/acme
chmod 600 traefik/acme

# Create Docker network
echo "🌐 Creating Docker network..."
docker network create traefik-public || echo "Network already exists"

# Set permissions for acme.json
touch traefik/acme/acme.json
chmod 600 traefik/acme/acme.json

echo "✅ Setup completed!"
echo ""
echo "Next steps:"
echo "1. Review and edit .env file if needed"
echo "2. Run: docker compose up -d"
echo "3. Wait for services to start"
echo "4. Run migrations: docker compose exec backend npm run prisma:migrate"
echo "5. Run seed: docker compose exec backend npm run prisma:seed"
echo "6. Access panel at: https://${PANEL_DOMAIN:-panel.agenzia.com}"
echo ""
echo "Default admin credentials:"
echo "  Email: admin@vps-panel.local"
echo "  Password: admin123"
echo "  ⚠️  CHANGE THIS IMMEDIATELY AFTER FIRST LOGIN!"
echo ""
