# VPS Control Panel - Production Deployment Guide

Comprehensive guide for deploying the VPS Control Panel in production.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Server Requirements](#server-requirements)
3. [Quick Start](#quick-start)
4. [Detailed Setup](#detailed-setup)
5. [Configuration](#configuration)
6. [Deployment](#deployment)
7. [Post-Deployment](#post-deployment)
8. [Backup & Restore](#backup--restore)
9. [Monitoring](#monitoring)
10. [Troubleshooting](#troubleshooting)
11. [Security](#security)
12. [Maintenance](#maintenance)

---

## Prerequisites

### Required Software

- **Docker** (version 24.0 or higher)
- **Docker Compose** (version 2.20 or higher)
- **Git** (for cloning the repository)
- **Domain name** with DNS access

### System Requirements

- **OS**: Ubuntu 20.04/22.04 LTS or similar Linux distribution
- **CPU**: Minimum 2 cores (recommended: 4+ cores)
- **RAM**: Minimum 4GB (recommended: 8GB+)
- **Storage**: Minimum 20GB (recommended: 50GB+ for projects and backups)
- **Network**: Public IP address, ports 80 and 443 open

---

## Server Requirements

### Minimum Specifications

- 2 vCPU
- 4GB RAM
- 20GB SSD storage
- Ubuntu 22.04 LTS

### Recommended Specifications (Hostinger VPS)

- 8 vCPU
- 32GB RAM
- 400GB NVMe storage
- Ubuntu 22.04 LTS

---

## Quick Start

For experienced users who want to deploy quickly:

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/vps-panel.git
cd vps-panel

# 2. Configure environment
cp .env.production.example .env.production
nano .env.production  # Edit with your values

# 3. Deploy
./scripts/deploy.sh
```

That's it! The panel will be available at `https://your-domain.com`

---

## Detailed Setup

### Step 1: Server Preparation

#### Install Docker

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add current user to docker group
sudo usermod -aG docker $USER

# Start Docker service
sudo systemctl enable docker
sudo systemctl start docker

# Verify installation
docker --version
docker compose version
```

#### Install Additional Dependencies

```bash
# Install useful tools
sudo apt install -y git curl wget htop nano apache2-utils
```

### Step 2: Clone Repository

```bash
# Clone the repository
cd /root
git clone https://github.com/yourusername/vps-panel.git
cd vps-panel
```

### Step 3: DNS Configuration

Before deploying, configure your DNS records:

1. **A Record**: Point your domain to your server's IP
   ```
   panel.yourdomain.com  ->  YOUR_SERVER_IP
   ```

2. **CNAME Records** (optional subdomains):
   ```
   traefik.yourdomain.com  ->  panel.yourdomain.com
   adminer.yourdomain.com  ->  panel.yourdomain.com
   ```

**Wait 5-15 minutes** for DNS propagation before deployment.

### Step 4: Environment Configuration

```bash
# Copy example environment file
cp .env.production.example .env.production

# Edit configuration
nano .env.production
```

#### Required Configuration

```bash
# Domain (REQUIRED)
DOMAIN=panel.yourdomain.com
ACME_EMAIL=admin@yourdomain.com

# Database (REQUIRED)
DATABASE_PASSWORD=GENERATE_STRONG_PASSWORD_HERE

# JWT Secret (REQUIRED)
# Generate with: openssl rand -base64 64
JWT_SECRET=GENERATE_STRONG_SECRET_HERE

# Encryption Key (REQUIRED)
# Generate with: openssl rand -hex 32
ENCRYPTION_KEY=GENERATE_32_BYTE_HEX_KEY_HERE

# Traefik Dashboard Auth (REQUIRED)
# Generate with: echo $(htpasswd -nb admin your_password) | sed -e s/\\$/\\$\\$/g
TRAEFIK_DASHBOARD_AUTH=admin:$$apr1$$GENERATE_HASH_HERE
```

#### Generate Secure Values

```bash
# Generate JWT Secret
openssl rand -base64 64

# Generate Encryption Key
openssl rand -hex 32

# Generate Traefik Dashboard Password
echo $(htpasswd -nb admin your_password) | sed -e s/\\$/\\$\\$/g
```

#### Optional Configuration

```bash
# Hostinger API (for email management)
HOSTINGER_API_KEY=your_hostinger_api_key

# Cloudflare API (for DNS management)
CLOUDFLARE_API_TOKEN=your_cloudflare_token

# SMTP (for email notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your@email.com
SMTP_PASSWORD=your_password
SMTP_FROM_EMAIL=noreply@yourdomain.com

# Backup Configuration
BACKUP_ENABLED=true
BACKUP_RETENTION_DAYS=30
BACKUP_SCHEDULE=0 2 * * *
```

---

## Deployment

### Deploy with Automated Script

The easiest way to deploy:

```bash
./scripts/deploy.sh
```

This script will:
1. ✅ Validate environment variables
2. ✅ Check Docker installation
3. ✅ Create necessary directories
4. ✅ Set up Traefik network
5. ✅ Build Docker images
6. ✅ Start all services
7. ✅ Run database migrations
8. ✅ Verify service health

### Manual Deployment

If you prefer manual control:

```bash
# 1. Create Traefik network
docker network create traefik-network

# 2. Create directories
mkdir -p backups/postgres backend/uploads logs

# 3. Build images
docker compose -f docker-compose.prod.yml build

# 4. Start services
docker compose -f docker-compose.prod.yml up -d

# 5. Wait for database
sleep 10

# 6. Run migrations
docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy

# 7. Generate Prisma Client
docker compose -f docker-compose.prod.yml exec backend npx prisma generate
```

---

## Post-Deployment

### Step 1: Verify Services

Check that all services are running:

```bash
docker compose -f docker-compose.prod.yml ps
```

Expected output:
```
NAME                    STATUS
vps-panel-postgres      Up (healthy)
vps-panel-backend       Up (healthy)
vps-panel-frontend      Up (healthy)
vps-panel-traefik       Up (healthy)
vps-panel-adminer       Up
```

### Step 2: Check Logs

```bash
# View all logs
docker compose -f docker-compose.prod.yml logs -f

# View specific service logs
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f frontend
```

### Step 3: SSL Certificate

Traefik will automatically request SSL certificates from Let's Encrypt. This may take 1-2 minutes.

Check certificate status:
```bash
docker compose -f docker-compose.prod.yml logs traefik | grep -i "certificate"
```

### Step 4: Create Admin User

1. Open your browser and navigate to `https://your-domain.com`
2. Click "Register" to create the first account
3. This first user will automatically be an admin
4. Subsequent users will be regular users (can be promoted via Users page)

### Step 5: Configure System Settings

1. Log in as admin
2. Navigate to **System Settings** (admin menu)
3. Click **"Initialize Defaults"** to populate default settings
4. Configure:
   - **Traefik**: Set ACME email
   - **API Keys**: Add Hostinger, Cloudflare keys if needed
   - **SMTP**: Configure email settings
   - **Backup**: Set retention and schedule
   - **Limits**: Adjust default resource limits

---

## Backup & Restore

### Automated Backups

Setup automated daily backups:

```bash
# Setup cron job (default: 2 AM daily)
./scripts/setup-cron.sh
```

This will:
- Backup PostgreSQL database (compressed)
- Backup uploaded files
- Backup Docker volumes
- Clean up old backups (30 days default)

### Manual Backup

```bash
./scripts/backup.sh
```

Backups are stored in `./backups/`:
- `postgres/` - Database dumps
- `uploads/` - User uploaded files
- `volumes/` - Docker volume backups
- `config_*.tar.gz` - Configuration files

### Restore from Backup

```bash
# List and restore interactively
./scripts/restore.sh

# Restore specific backup (use index from list)
./scripts/restore.sh 0  # Restore latest backup
```

**Important**: The restore script will:
1. Create a safety backup of current data
2. Stop the backend
3. Restore the database
4. Restore uploads (if available)
5. Restart the backend

### Backup to External Storage (Recommended)

#### Option 1: Rsync to Remote Server

```bash
# Add to crontab after backup
rsync -avz --delete /root/vps-panel/backups/ user@backup-server:/backups/vps-panel/
```

#### Option 2: AWS S3

```bash
# Install AWS CLI
sudo apt install -y awscli

# Configure credentials
aws configure

# Sync backups to S3
aws s3 sync /root/vps-panel/backups/ s3://your-bucket/vps-panel-backups/
```

---

## Monitoring

### Service Health

```bash
# Check all services
docker compose -f docker-compose.prod.yml ps

# Check specific service health
docker inspect --format='{{.State.Health.Status}}' vps-panel-backend
```

### Resource Usage

```bash
# Docker stats
docker stats

# System resources
htop
df -h
free -h
```

### Access Logs

```bash
# Traefik access logs
docker compose -f docker-compose.prod.yml logs -f traefik | grep -i "access"

# Backend API logs
docker compose -f docker-compose.prod.yml logs -f backend

# Application logs
tail -f logs/app.log
```

### Traefik Dashboard

Access Traefik dashboard at:
```
https://traefik.your-domain.com
```

Login with credentials from `TRAEFIK_DASHBOARD_AUTH`.

### Database Management

Access Adminer at:
```
https://adminer.your-domain.com
```

Connection details:
- **System**: PostgreSQL
- **Server**: postgres
- **Username**: from `DATABASE_USER`
- **Password**: from `DATABASE_PASSWORD`
- **Database**: from `DATABASE_NAME`

---

## Troubleshooting

### SSL Certificate Issues

**Problem**: SSL certificate not issued after 5 minutes

**Solution**:
```bash
# Check Traefik logs
docker compose -f docker-compose.prod.yml logs traefik | grep -i "acme"

# Verify DNS resolution
nslookup your-domain.com

# Ensure ports 80/443 are open
sudo ufw status
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

### Database Connection Issues

**Problem**: Backend can't connect to database

**Solution**:
```bash
# Check database status
docker compose -f docker-compose.prod.yml exec postgres pg_isready

# View database logs
docker compose -f docker-compose.prod.yml logs postgres

# Restart database
docker compose -f docker-compose.prod.yml restart postgres
```

### Service Won't Start

**Problem**: Container immediately exits

**Solution**:
```bash
# Check logs
docker compose -f docker-compose.prod.yml logs [service]

# Check environment variables
docker compose -f docker-compose.prod.yml exec [service] env

# Rebuild image
docker compose -f docker-compose.prod.yml build --no-cache [service]
docker compose -f docker-compose.prod.yml up -d [service]
```

### Out of Disk Space

**Solution**:
```bash
# Check disk usage
df -h

# Clean up Docker
docker system prune -a --volumes

# Clean old backups
find ./backups -type f -mtime +30 -delete

# Clean logs
truncate -s 0 logs/*.log
```

---

## Security

### Firewall Configuration

```bash
# Install UFW
sudo apt install -y ufw

# Allow SSH (IMPORTANT: Do this first!)
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

### SSH Hardening

```bash
# Disable root login
sudo nano /etc/ssh/sshd_config
# Set: PermitRootLogin no
# Set: PasswordAuthentication no (if using SSH keys)

# Restart SSH
sudo systemctl restart sshd
```

### Regular Updates

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Update Docker images
cd /root/vps-panel
docker compose -f docker-compose.prod.yml pull
./scripts/deploy.sh
```

### Security Best Practices

1. ✅ Use strong passwords (20+ characters)
2. ✅ Enable 2FA for admin accounts
3. ✅ Regular backups (daily recommended)
4. ✅ Keep system and Docker updated
5. ✅ Monitor activity logs regularly
6. ✅ Use SSH keys instead of passwords
7. ✅ Limit SSH access to specific IPs if possible
8. ✅ Regular security audits

---

## Maintenance

### Update Deployment

```bash
# Pull latest changes
cd /root/vps-panel
git pull

# Run deployment script
./scripts/deploy.sh
```

### Restart Services

```bash
# Restart all services
docker compose -f docker-compose.prod.yml restart

# Restart specific service
docker compose -f docker-compose.prod.yml restart backend
```

### View Logs

```bash
# Real-time logs (all services)
docker compose -f docker-compose.prod.yml logs -f

# Logs for specific service
docker compose -f docker-compose.prod.yml logs -f backend

# Last 100 lines
docker compose -f docker-compose.prod.yml logs --tail=100
```

### Database Maintenance

```bash
# Backup database
./scripts/backup.sh

# Access PostgreSQL console
docker compose -f docker-compose.prod.yml exec postgres psql -U vpsadmin -d vps_panel

# Vacuum database (optimize)
docker compose -f docker-compose.prod.yml exec postgres psql -U vpsadmin -d vps_panel -c "VACUUM ANALYZE;"
```

### Clean Up Old Data

```bash
# Clean old activity logs (older than 90 days)
# This can be configured in System Settings

# Clean old backups
find ./backups -type f -mtime +30 -delete

# Clean Docker system
docker system prune -a --volumes
```

---

## Useful Commands

### Service Management

```bash
# Start services
docker compose -f docker-compose.prod.yml up -d

# Stop services
docker compose -f docker-compose.prod.yml down

# Restart services
docker compose -f docker-compose.prod.yml restart

# View status
docker compose -f docker-compose.prod.yml ps

# View logs
docker compose -f docker-compose.prod.yml logs -f [service]
```

### Database Operations

```bash
# Create backup
./scripts/backup.sh

# Restore backup
./scripts/restore.sh

# Run migrations
docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy

# Access database
docker compose -f docker-compose.prod.yml exec postgres psql -U vpsadmin -d vps_panel
```

### Monitoring

```bash
# Resource usage
docker stats

# Disk usage
df -h

# Service health
docker compose -f docker-compose.prod.yml ps

# Check specific container health
docker inspect --format='{{.State.Health.Status}}' vps-panel-backend
```

---

## Support

### Documentation

- **Main README**: `README.md`
- **API Documentation**: Access via `/api/docs` (if enabled)
- **Architecture Docs**: `docs/ARCHITECTURE.md`

### Logs

All logs are stored in:
- **Application logs**: `logs/`
- **Backup logs**: `logs/backup.log`
- **Docker logs**: `docker compose -f docker-compose.prod.yml logs`

### Common Issues

Check the [Troubleshooting](#troubleshooting) section above.

### Getting Help

1. Check logs: `docker compose -f docker-compose.prod.yml logs -f`
2. Check GitHub issues
3. Contact system administrator

---

## License

See `LICENSE` file for details.

---

## Changelog

### Version 1.0.0 (Initial Release)

- ✅ Complete VPS management system
- ✅ Docker-based project isolation
- ✅ Traefik reverse proxy with SSL
- ✅ User management and RBAC
- ✅ Activity logging and audit trails
- ✅ Automated backups
- ✅ Production-ready deployment
