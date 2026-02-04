# CLAUDE.md - VPS Panel

Console di gestione VPS - Stack Docker completo.

**Versione**: 1.3.0 (2025-12-23)

## Quick Info

| | |
|---|---|
| **Frontend** | https://fodivps1.cloud |
| **Backend API** | https://api.fodivps1.cloud |
| **Path** | `/root/vps-panel` |
| **Changelog** | `CHANGELOG.md` |

## Stack

- **Backend**: Fastify + Prisma + TypeScript
- **Frontend**: Next.js 14 + Tailwind + Shadcn
- **Proxy**: Traefik v3 (SSL Let's Encrypt)
- **DB**: PostgreSQL + Redis

## Comandi

```bash
cd /root/vps-panel

# Stack
docker compose up -d | down | restart backend

# Logs
docker compose logs -f backend

# Database
docker compose exec backend npm run prisma:migrate
docker compose exec postgres psql -U vpsadmin -d vps_panel
```

## Architettura Backend

```
modules/
├── auth/          # JWT + 2FA + Session Management
├── projects/      # CRUD + templates + Env Vars
├── docker/        # dockerode + compose CLI
├── domains/       # Traefik dynamic config
├── databases/     # MySQL/PostgreSQL/Redis provisioning
├── monitoring/    # System metrics + WebSocket
├── users/         # User management + RBAC
```

## Nuove Funzionalità (v1.3.0)

- **2FA TOTP**: Setup con QR code, codici backup
- **Session Management**: Visualizza/revoca sessioni
- **Breadcrumb Navigation**: Auto-generazione da URL
- **Environment Variables**: Gestione .env per progetto

## Architettura Frontend

```
app/(dashboard)/  # Protected routes
components/ui/    # Shadcn/Radix
lib/              # Axios client, Zustand stores
```

## Traefik

Config dinamiche in `/root/vps-panel/traefik/dynamic/`
- Auto-reload ogni 2 secondi
- IP Gateway per PM2: `http://172.19.0.1:{PORT}`

## Deploy Nuovi Progetti

I progetti usano architettura ottimizzata:
- **DB**: Docker container con porta esposta
- **App**: PM2 con Node.js di sistema
- **Routing**: Traefik config statica

Vedere `/home/shared/.claude/CLAUDE.md` per documentazione completa.

## Variabili Critiche (.env)

```env
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=...
PANEL_DOMAIN=fodivps1.cloud
```

## Troubleshooting

| Problema | Soluzione |
|----------|-----------|
| Backend down | `docker compose logs postgres` |
| SSL issues | Check `acme.json` (600), DNS |
| Frontend 404 | Verificare API URL, CORS |
