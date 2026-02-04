# VPS Control Panel - IP-Based Deployment Guide

Quick deployment guide for accessing the panel via IP address (without domain).

**⚠️ Important**: This deployment method uses HTTP without SSL encryption. Suitable for:
- Testing and development
- Local networks
- Temporary deployments before DNS setup
- **NOT recommended for production with sensitive data**

For production deployments with SSL/HTTPS, see [DEPLOYMENT.md](DEPLOYMENT.md)

---

## Quick Start (2 Steps)

### Step 1: Run Deployment Script

```bash
cd /root/vps-panel
./scripts/deploy-ip.sh
```

This script will:
- Auto-detect your server IP
- Generate secure passwords automatically
- Create `.env.ip` configuration
- Build and start all services
- Run database migrations
- Display access URLs

### Step 2: Access the Panel

Open your browser:
```
http://YOUR_SERVER_IP:3000
```

That's it! 🎉

---

## What Gets Deployed

### Services

| Service | Port | URL | Description |
|---------|------|-----|-------------|
| **Frontend** | 3000 | `http://IP:3000` | Main dashboard |
| **Backend API** | 3001 | `http://IP:3001` | REST API |
| **Adminer** | 8080 | `http://IP:8080` | Database manager |
| **PostgreSQL** | Internal | N/A | Database (not exposed) |

### Access URLs

After deployment, you'll see:
```
Main Panel:         http://YOUR_IP:3000
Backend API:        http://YOUR_IP:3001
API Health Check:   http://YOUR_IP:3001/health
Adminer (DB):       http://YOUR_IP:8080
```

---

## Firewall Configuration

If using UFW firewall, allow the required ports:

```bash
# Allow frontend (required)
sudo ufw allow 3000/tcp

# Allow backend API (required)
sudo ufw allow 3001/tcp

# Allow Adminer database manager (optional)
sudo ufw allow 8080/tcp

# Enable firewall
sudo ufw enable
```

---

## Manual Configuration (Optional)

If you want to manually configure before deployment:

### Step 1: Create Environment File

```bash
cp .env.ip.example .env.ip
nano .env.ip
```

### Step 2: Generate Secure Values

```bash
# Database password
openssl rand -base64 32

# JWT Secret
openssl rand -base64 64

# Encryption Key
openssl rand -hex 32
```

### Step 3: Update .env.ip

```bash
SERVER_IP=YOUR_SERVER_IP
DATABASE_PASSWORD=<generated_password>
JWT_SECRET=<generated_secret>
ENCRYPTION_KEY=<generated_key>
```

### Step 4: Deploy

```bash
./scripts/deploy-ip.sh
```

---

## Post-Deployment

### 1. Create Admin User

1. Navigate to `http://YOUR_IP:3000`
2. Click "Register"
3. Create your account (first user = admin)

### 2. Configure System Settings

1. Login as admin
2. Go to **System Settings** (admin menu)
3. Click **"Initialize Defaults"**
4. Configure API keys, SMTP, etc.

### 3. Test the Panel

- Create a test project
- Check monitoring dashboard
- Verify all features work

---

## Management Commands

### View Logs

```bash
# All services
docker compose -f docker-compose.ip.yml logs -f

# Specific service
docker compose -f docker-compose.ip.yml logs -f backend
docker compose -f docker-compose.ip.yml logs -f frontend
```

### Restart Services

```bash
# Restart all
docker compose -f docker-compose.ip.yml restart

# Restart specific service
docker compose -f docker-compose.ip.yml restart backend
```

### Stop Services

```bash
docker compose -f docker-compose.ip.yml down
```

### Start Services

```bash
docker compose -f docker-compose.ip.yml up -d
```

### Check Status

```bash
docker compose -f docker-compose.ip.yml ps
```

---

## Backup & Restore

You can use the same backup scripts as the production deployment:

### Create Backup

```bash
./scripts/backup.sh
```

### Restore Backup

```bash
./scripts/restore.sh
```

### Automated Backups

```bash
./scripts/setup-cron.sh
```

---

## Troubleshooting

### Cannot Access Panel

**Check if services are running:**
```bash
docker compose -f docker-compose.ip.yml ps
```

**Check firewall:**
```bash
sudo ufw status
sudo ufw allow 3000/tcp
```

**Check if port is listening:**
```bash
netstat -tlnp | grep :3000
```

### Database Connection Errors

**Check database status:**
```bash
docker compose -f docker-compose.ip.yml exec postgres pg_isready
```

**View database logs:**
```bash
docker compose -f docker-compose.ip.yml logs postgres
```

### Backend API Not Responding

**Check backend logs:**
```bash
docker compose -f docker-compose.ip.yml logs backend
```

**Check API health:**
```bash
curl http://YOUR_IP:3001/health
```

**Restart backend:**
```bash
docker compose -f docker-compose.ip.yml restart backend
```

### Frontend Not Loading

**Check frontend logs:**
```bash
docker compose -f docker-compose.ip.yml logs frontend
```

**Rebuild frontend:**
```bash
docker compose -f docker-compose.ip.yml build frontend
docker compose -f docker-compose.ip.yml up -d frontend
```

---

## Migrate to Domain-Based Deployment

When you're ready to move to production with a domain and SSL:

### Step 1: Stop IP-Based Deployment

```bash
docker compose -f docker-compose.ip.yml down
```

### Step 2: Backup Data

```bash
./scripts/backup.sh
```

### Step 3: Configure Domain

```bash
cp .env.production.example .env.production
nano .env.production
# Set your domain and other settings
```

### Step 4: Deploy with Domain

```bash
./scripts/deploy.sh
```

### Step 5: Restore Data (if needed)

```bash
./scripts/restore.sh
```

---

## Security Considerations

⚠️ **Important Security Notes:**

1. **No Encryption**: All traffic is unencrypted HTTP
2. **Exposed Ports**: Multiple ports exposed to the internet
3. **No Certificate Validation**: Browsers may show warnings
4. **Testing Only**: Not suitable for production with sensitive data

**For production, always use:**
- Domain-based deployment
- SSL/TLS certificates (Let's Encrypt)
- HTTPS only
- Proper firewall configuration
- Regular security updates

See [DEPLOYMENT.md](DEPLOYMENT.md) for production deployment guide.

---

## Architecture

### IP-Based Deployment

```
Internet
    ↓
Your Server (IP)
    ├── Port 3000 → Frontend (Next.js)
    ├── Port 3001 → Backend API (Fastify)
    ├── Port 8080 → Adminer (DB Manager)
    └── Internal → PostgreSQL Database
```

### vs Domain-Based Deployment

```
Internet
    ↓
Your Domain (HTTPS)
    ↓
Traefik (Reverse Proxy + SSL)
    ├── → Frontend (https://domain.com)
    ├── → Backend (https://domain.com/api)
    ├── → Traefik Dashboard (https://traefik.domain.com)
    └── → Adminer (https://adminer.domain.com)
        └── PostgreSQL (Internal)
```

---

## Benefits of IP-Based Deployment

✅ **Quick Setup**: No DNS configuration needed
✅ **Instant Access**: Works immediately after deployment
✅ **Simple**: Fewer moving parts (no Traefik)
✅ **Testing**: Perfect for development/testing
✅ **Troubleshooting**: Direct access to services

## Limitations

❌ **No SSL/HTTPS**: Unencrypted traffic
❌ **Multiple Ports**: Need to expose/remember multiple ports
❌ **No Auto SSL**: Manual certificate management if needed
❌ **Less Professional**: Not suitable for client-facing production
❌ **Port Conflicts**: May conflict with other services

---

## Summary

**Use IP-based deployment for:**
- Quick testing
- Development environments
- Internal/local networks
- Temporary deployments
- Troubleshooting

**Use domain-based deployment for:**
- Production environments
- Public-facing applications
- Client/user access
- Secure data handling
- Professional deployments

---

## Need Help?

- **Production Deployment**: See [DEPLOYMENT.md](DEPLOYMENT.md)
- **Troubleshooting**: Check service logs
- **Security**: Always use HTTPS in production

---

## Quick Reference

```bash
# Deploy
./scripts/deploy-ip.sh

# Access
http://YOUR_IP:3000

# Logs
docker compose -f docker-compose.ip.yml logs -f

# Restart
docker compose -f docker-compose.ip.yml restart

# Stop
docker compose -f docker-compose.ip.yml down

# Backup
./scripts/backup.sh
```

---

**Ready to deploy? Just run:**

```bash
./scripts/deploy-ip.sh
```

🚀 Your panel will be ready in minutes!
