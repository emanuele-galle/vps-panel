# VPS Control Panel

Modern, full-featured VPS control panel built with **Node.js**, **TypeScript**, **Next.js**, and **Docker**.

🇮🇹 **Interfaccia completamente in Italiano**

## 🚀 Features

- **Project Management**: Create and manage multiple projects with Docker isolation
- **Container Orchestration**: Full Docker management (containers, networks, volumes)
- **Domain Management**: Automatic SSL with Let's Encrypt via Traefik
- **File Manager**: Integrated FileBrowser for file management
- **Database Tools**: Adminer integration for multi-database support (MySQL, PostgreSQL, MongoDB, Redis)
- **Email Management**: Hostinger API integration for email accounts
- **Real-time Monitoring**: CPU, RAM, Disk, Network metrics with WebSocket
- **User Management**: Multi-user support with role-based access control
- **Activity Logs**: Complete audit trail of all actions
- **System Settings**: Advanced system configuration with search, collapsible categories
- **Italian Localization**: Full UI translation to Italian
- **Claude Code Integration**: AI-assisted development and project scaffolding
- **Template Library**: Reusable project templates with components
- **Multi-VPS Management**: Deploy and manage across multiple instances
- **N8N Workflows**: Automation workflow management
- **Automated Deployments**: Zero-downtime deploys with rollback support
- **Notification System**: Configurable alerts via email/webhooks

## 🛠️ Tech Stack

### Backend
- **Node.js 24** + **TypeScript**
- **Fastify** - Fast and low overhead web framework
- **Prisma** - Type-safe ORM
- **PostgreSQL** - Main database
- **Redis** - Cache, queue, and sessions
- **Dockerode** - Docker API client
- **Socket.io** - Real-time WebSocket

### Frontend
- **Next.js 16** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first CSS
- **Zustand** - State management
- **Recharts** - Charts and graphs

### Infrastructure
- **Traefik v3** - Reverse proxy with automatic SSL
- **Docker** + **Compose** - Containerization
- **FileBrowser** - File management
- **Adminer** - Database management

## 📁 Project Structure

```
vps-panel/
├── backend/                 # Node.js/TypeScript API
│   ├── src/
│   │   ├── config/         # Configuration
│   │   ├── modules/        # Feature modules
│   │   ├── services/       # Shared services
│   │   └── utils/          # Utilities
│   ├── prisma/             # Database schema
│   └── Dockerfile
├── frontend/                # Next.js application
│   ├── src/
│   │   ├── app/            # App Router pages
│   │   ├── components/     # React components
│   │   ├── lib/            # Libraries
│   │   ├── hooks/          # Custom hooks
│   │   └── store/          # Zustand stores
│   └── Dockerfile
├── docker/                  # Docker configurations
├── traefik/                 # Traefik configuration
│   ├── traefik.yml         # Static config
│   └── dynamic/            # Dynamic config
├── scripts/                 # Utility scripts
└── docker-compose.yml       # Main stack
```

## 🚀 Quick Start

### Prerequisites

- **Docker** 24+ and **Docker Compose** v2+
- **Root access** or sudo privileges
- Domain name (for SSL)

### Installation

1. **Run the setup script:**

```bash
cd /root/vps-panel
sudo ./scripts/setup.sh
```

This will:
- Create secure passwords
- Initialize `.env` file
- Create necessary directories
- Create Docker networks

2. **Edit `.env` file:**

```bash
nano .env
```

Configure:
- `PANEL_DOMAIN` - Your panel domain (e.g., panel.agenzia.com)
- `PREVIEW_DOMAIN` - Your preview domain (e.g., preview.agenzia.com)
- Cloudflare credentials (if using wildcard SSL)
- Hostinger API key (optional)

3. **Start the services:**

```bash
docker compose up -d
```

4. **Run database migrations:**

```bash
docker compose exec backend npm run prisma:migrate
```

5. **Seed the database:**

```bash
docker compose exec backend npm run prisma:seed
```

6. **Access the panel:**

- **Panel**: https://your-panel-domain.com
- **API**: https://api.your-panel-domain.com
- **Traefik Dashboard**: https://traefik.your-panel-domain.com
- **File Manager**: https://files.your-panel-domain.com
- **Database Manager**: https://db.your-panel-domain.com

### Default Credentials

```
Email: admin@vps-panel.local
Password: admin123
```

**⚠️ IMPORTANT: Change this immediately after first login!**

## 🔧 Configuration

### Environment Variables

Edit `.env` file to configure:

```bash
# Panel domains
PANEL_DOMAIN=panel.agenzia.com
PREVIEW_DOMAIN=preview.agenzia.com

# Database
POSTGRES_PASSWORD=your-secure-password

# Redis
REDIS_PASSWORD=your-redis-password

# JWT
JWT_SECRET=your-jwt-secret

# Cloudflare (for wildcard SSL)
CLOUDFLARE_EMAIL=your-email@example.com
CLOUDFLARE_API_KEY=your-api-key

# Hostinger API
HOSTINGER_API_KEY=your-hostinger-key
```

### DNS Configuration

Point these DNS records to your VPS IP:

```
A     panel.agenzia.com      -> YOUR_VPS_IP
A     api.panel.agenzia.com  -> YOUR_VPS_IP
A     *.preview.agenzia.com  -> YOUR_VPS_IP
```

## 📦 Docker Commands

```bash
# Start all services
docker compose up -d

# Stop all services
docker compose down

# View logs
docker compose logs -f

# Restart a service
docker compose restart backend

# Rebuild and restart
docker compose up -d --build

# Execute command in container
docker compose exec backend npm run prisma:studio
```

## 🔨 Development

### Backend Development

```bash
cd backend

# Install dependencies
npm install

# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Start dev server
npm run dev
```

### Frontend Development

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

## 🗄️ Database

### Prisma Commands

```bash
# Generate Prisma client
docker compose exec backend npm run prisma:generate

# Create migration
docker compose exec backend npm run prisma:migrate

# Open Prisma Studio
docker compose exec backend npm run prisma:studio

# Seed database
docker compose exec backend npm run prisma:seed
```

## 📊 Monitoring

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f traefik

# Traefik logs
tail -f traefik/logs/access.log
```

### System Metrics

Access real-time metrics at:
- Dashboard: `https://your-panel-domain.com/monitoring`
- Traefik: `https://traefik.your-panel-domain.com`

## 🔒 Security

### Important Security Steps

1. **Change default admin password**
2. **Update Traefik dashboard password:**
   ```bash
   htpasswd -nb admin newpassword
   ```
   Update in `traefik/dynamic/middlewares.yml`

3. **Enable 2FA** for all users
4. **Regular backups**
5. **Keep Docker images updated:**
   ```bash
   docker compose pull
   docker compose up -d
   ```

## 🔧 Troubleshooting

### SSL Certificates Not Working

```bash
# Check Traefik logs
docker compose logs traefik

# Check acme.json permissions
chmod 600 traefik/acme/acme.json

# Restart Traefik
docker compose restart traefik
```

### Backend Not Connecting to Database

```bash
# Check PostgreSQL logs
docker compose logs postgres

# Check connection string
docker compose exec backend env | grep DATABASE_URL
```

### Frontend Not Loading

```bash
# Check frontend logs
docker compose logs frontend

# Rebuild frontend
docker compose up -d --build frontend
```

## 🌐 API Documentation

API documentation available at: `https://api.your-panel-domain.com/docs`

## 🤝 Contributing

This is a private project for your agency. For suggestions or issues, document in `/docs`.

## 📄 License

Private - All rights reserved

## 🆘 Support

For support, check:
1. This README
2. `/docs` folder
3. Docker/Traefik logs
4. Prisma documentation

## 🆕 Recent Changes

### v1.7.1 (February 2026)
- **Node.js 24** + **Next.js 16** runtime upgrade
- **Claude Code Integration**: AI-assisted development module
- **Multi-VPS Support**: Manage multiple VPS instances
- **Template Library**: Reusable project templates
- **Deploy System**: Automated deployment with rollback
- **Notification System**: Configurable alerts and notifications
- **20+ Backend Modules**: Auth, projects, Docker, databases, domains, monitoring, backup, email, N8N, and more
- **14 Zustand Stores**: Comprehensive frontend state management
- **Error Tracking**: Client-side error reporting to ActivityLog
- **CI/CD Pipeline**: Automated testing and deployment via GitHub Actions

---

**Built with ❤️ by FODI S.r.l.**

**Last Updated**: 2026-02-22
