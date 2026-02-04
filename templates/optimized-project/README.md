# Template Progetto Ottimizzato

Questa directory contiene i template per creare nuovi progetti con l'architettura ottimizzata (PM2 + Docker solo per database).

## Vantaggi

- **Meno risorse**: Solo 1 container Docker (database) invece di 2+
- **Startup veloce**: No build all'avvio del container
- **Node.js condiviso**: Usa Node.js di sistema (v20.19.5)
- **Gestione semplice**: PM2 per logs, restart, monitoring

## File Template

| File | Descrizione |
|------|-------------|
| `docker-compose.yml.template` | Docker Compose con solo database |
| `ecosystem.config.js.template` | Configurazione PM2 |
| `traefik.yml.template` | Routing Traefik |
| `.env.template` | Variabili ambiente |

## Procedura Creazione Nuovo Progetto

### 1. Creare directory progetto

```bash
PROJECT_SLUG="nome-progetto"
mkdir -p /var/www/projects/$PROJECT_SLUG
cd /var/www/projects/$PROJECT_SLUG
```

### 2. Copiare e configurare i sorgenti

```bash
# Copiare il codice sorgente del progetto
# ...

# Generare password sicure
DB_PASSWORD=$(openssl rand -base64 24)
DB_ROOT_PASSWORD=$(openssl rand -base64 24)
NEXTAUTH_SECRET=$(openssl rand -base64 32)

echo "DB_PASSWORD: $DB_PASSWORD"
echo "DB_ROOT_PASSWORD: $DB_ROOT_PASSWORD"
echo "NEXTAUTH_SECRET: $NEXTAUTH_SECRET"
```

### 3. Creare docker-compose.yml

Copiare il template e sostituire:
- `{{PROJECT_NAME}}`: Nome univoco (es: `studio-notarile`)
- `{{DB_TYPE}}`: `mysql:8.0` o `postgres:16`
- `{{DB_PORT}}`: Porta host libera (3307-3399 MySQL, 5433-5499 PostgreSQL)

### 4. Creare ecosystem.config.js

Copiare il template e sostituire:
- `{{PROJECT_NAME}}`: Nome processo PM2
- `{{PROJECT_PATH}}`: Path completo progetto
- `{{APP_PORT}}`: Porta libera (3010-3099)
- `{{DOMAIN}}`: Dominio completo

### 5. Creare configurazione Traefik

```bash
# Copiare il template in /root/vps-panel/traefik/dynamic/
cp traefik.yml.template /root/vps-panel/traefik/dynamic/$PROJECT_SLUG.yml
# Editare e sostituire i placeholder
```

### 6. Creare .env

Copiare il template e inserire le password generate.

### 7. Deploy

```bash
# Installare dipendenze
npm install

# Build
npm run build

# Avviare database
docker compose up -d

# Aspettare che il database sia healthy
docker compose ps

# Avviare app con PM2
pm2 start ecosystem.config.js

# Salvare configurazione PM2
pm2 save
```

### 8. Verificare

```bash
# Verificare PM2
pm2 list
pm2 logs $PROJECT_NAME

# Testare
curl -s -o /dev/null -w "%{http_code}" https://$DOMAIN/
```

## Porte Utilizzate

Mantenere traccia delle porte usate per evitare conflitti:

| Progetto | App Port | DB Port | DB Type |
|----------|----------|---------|---------|
| notaio-pellicano | 3010 | 3307 | MySQL |
| (prossimo) | 3011 | 3308 | MySQL |
| (prossimo) | 3012 | 5433 | PostgreSQL |

## Troubleshooting

### App non raggiungibile via Traefik

1. Verificare che l'app sia in ascolto: `netstat -tlnp | grep {PORT}`
2. Verificare IP gateway Docker: `docker exec vps-panel-traefik ip route | grep default`
3. Ricaricare Traefik: `docker restart vps-panel-traefik`

### Database non raggiungibile

1. Verificare container: `docker compose ps`
2. Testare connessione: `mysql -h 127.0.0.1 -P {PORT} -u {USER} -p`

### PM2 crash loop

1. Verificare logs: `pm2 logs {name}`
2. Verificare variabili ambiente in ecosystem.config.js
3. Testare manualmente: `npm start`
