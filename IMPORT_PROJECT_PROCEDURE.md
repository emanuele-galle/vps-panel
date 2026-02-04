# Procedura Standard: Importazione Progetti nella Console VPS

## ⚠️ Problema Riscontrato

Quando si importa un progetto tramite backup ZIP che **non contiene** `docker-compose.yml`, il sistema:
1. ✅ Estrae i file correttamente
2. ✅ Crea il record nella tabella `projects`
3. ❌ **NON** crea automaticamente metadata (containers, domains, databases, etc.)
4. ❌ **NON** appare nella dashboard con tutte le funzionalità

**Risultato**: Progetto importato ma "invisibile" nella console.

---

## ✅ Procedura Corretta di Importazione

### Fase 1: Upload Backup

```bash
# L'utente carica il file ZIP tramite console VPS
POST /api/backups/upload
```

**Output**:
- File salvato in `/var/www/uploads/{hash}.zip`
- Record creato in `backup_uploads` con status `UPLOADED`

### Fase 2: Importazione File

```bash
# L'utente clicca "Importa" nella console
POST /api/backups/:id/import
```

**Cosa fa il sistema**:
1. Estrae ZIP in `/var/www/projects/import-{backupId}`
2. Analizza contenuto (framework detection)
3. Crea record in `projects` con:
   - `name`, `slug`, `userId`, `template`, `path`
   - Status: `ACTIVE`
4. **Se esiste `docker-compose.yml`**: procede con deploy automatico
5. **Se NON esiste**: **STOP** → serve intervento manuale

### Fase 3A: Deploy Automatico (con docker-compose.yml)

Se il backup contiene `docker-compose.yml`, il sistema:

```typescript
// backend/src/modules/backup/backup.service.ts
async deployImportedProject(project, projectPath) {
  // 1. Verifica docker-compose.yml
  if (!await fileExists('docker-compose.yml')) return;

  // 2. Genera .env da .env.example
  await this.generateEnvFile(projectPath);

  // 3. Docker compose up
  await exec(`docker compose up -d`, { cwd: projectPath });

  // 4. Registra metadata automaticamente
  await this.registerContainers(project.id);
  await this.registerNetworks(project.id);
  await this.registerVolumes(project.id);

  // 5. Aggiorna lastDeployAt
  await prisma.projects.update({
    where: { id: project.id },
    data: { lastDeployAt: new Date() }
  });
}
```

✅ **Tutto funziona automaticamente!**

### Fase 3B: Deploy Manuale (SENZA docker-compose.yml) ⚠️

Se il backup **non** contiene `docker-compose.yml`:

#### Step 1: Creare docker-compose.yml

```bash
cd /var/www/projects/import-{backupId}

# Creare manualmente docker-compose.yml basato su template
nano docker-compose.yml
```

**Template Base**:
```yaml
version: '3.8'

networks:
  traefik-public:
    external: true
  internal:
    driver: bridge

services:
  app:
    image: node:22-alpine  # o altra immagine
    container_name: {project-slug}_app
    working_dir: /app
    command: sh -c "npm ci && npm run build && npm start"
    volumes:
      - .:/app
    environment:
      - NODE_ENV=production
      # ... altre env vars
    networks:
      - traefik-public
      - internal
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.{slug}.rule=Host(`{slug}.preview.agenzia.com`)"
      - "traefik.http.routers.{slug}.entrypoints=websecure"
      - "traefik.http.routers.{slug}.tls.certresolver=letsencrypt"
      - "traefik.http.services.{slug}.loadbalancer.server.port=3000"
```

#### Step 2: Generare .env

```bash
# Generare password sicure
DB_PASS=$(openssl rand -base64 32 | tr -d '/=+' | head -c 32)
NEXTAUTH_SEC=$(openssl rand -base64 32)

# Creare .env
cat > .env << EOF
NODE_ENV=production
DB_PASSWORD=${DB_PASS}
NEXTAUTH_SECRET=${NEXTAUTH_SEC}
# ... altre variabili
EOF
```

#### Step 3: Deploy Docker

```bash
docker compose up -d
```

#### Step 4: ⚠️ **CRITICO** - Registrare Metadata nel Database

**Questo è il passo che mancava!**

```bash
# Andare nella directory backend della console
cd /root/vps-panel/backend

# Eseguire script di sincronizzazione
npm run sync-project-metadata -- --project-id={projectId}
```

**Oppure manualmente** (se lo script non esiste):

```sql
-- Get project ID
SELECT id, slug FROM projects WHERE slug = '{project-slug}';

-- Get Docker container IDs
docker inspect {container_name} --format='{{.Id}}|{{.Name}}|{{.Config.Image}}|{{.State.Status}}'

-- Insert containers
INSERT INTO containers (
  id, "dockerId", name, image, "projectId",
  ports, environment, volumes, networks,
  status, "restartPolicy", "createdAt", "updatedAt", "startedAt"
) VALUES (
  'cmidh' || substr(md5(random()::text), 1, 20),
  '{docker_id}',
  '{container_name}',
  '{image}',
  '{project_id}',
  '{"3000": "3000"}'::jsonb,
  '{}'::jsonb,
  '[]'::jsonb,
  ARRAY['traefik-public', '{network}'],
  'RUNNING',
  'unless-stopped',
  NOW(),
  NOW(),
  NOW()
);

-- Insert domain
INSERT INTO domains (
  id, domain, "projectId", type,
  "sslEnabled", "sslProvider", status,
  "createdAt", "updatedAt", "verifiedAt"
) VALUES (
  'cmidh' || substr(md5(random()::text), 1, 20),
  '{slug}.preview.agenzia.com',
  '{project_id}',
  'PREVIEW',
  true,
  'letsencrypt',
  'ACTIVE',
  NOW(), NOW(), NOW()
);

-- Insert database (se esiste)
INSERT INTO databases (
  id, name, type, "projectId",
  host, port, username, password, "databaseName",
  "createdAt", "updatedAt"
) VALUES (
  'cmidh' || substr(md5(random()::text), 1, 20),
  '{project_name} DB',
  'MYSQL', -- o POSTGRES, MONGODB, REDIS
  '{project_id}',
  '{container_name}_db',
  3306,
  '{db_user}',
  '{db_password}',
  '{db_name}',
  NOW(), NOW()
);

-- Insert volumes
INSERT INTO volumes (
  id, "dockerId", name, driver, mountpoint, "projectId",
  "createdAt", "updatedAt"
) VALUES (
  'cmidh' || substr(md5(random()::text), 1, 20),
  '{volume_docker_id}',
  '{volume_name}',
  'local',
  '{mountpoint}',
  '{project_id}',
  NOW(), NOW()
);

-- Insert networks
INSERT INTO networks (
  id, "dockerId", name, driver, scope, "projectId",
  subnet, gateway, "createdAt"
) VALUES (
  'cmidh' || substr(md5(random()::text), 1, 20),
  '{network_docker_id}',
  '{network_name}',
  'bridge',
  'local',
  '{project_id}',
  '{subnet}',
  '{gateway}',
  NOW()
);
```

#### Step 5: Aggiornare Progetto con Preview URL

```sql
UPDATE projects SET
  "previewUrl" = 'https://{slug}.preview.agenzia.com',
  "clientName" = '{owner_name}',
  "clientEmail" = '{owner_email}',
  description = '{project_description}',
  "lastDeployAt" = NOW(),
  "updatedAt" = NOW()
WHERE id = '{project_id}';
```

#### Step 6: Verificare

```sql
SELECT
  p.name,
  p."previewUrl",
  (SELECT COUNT(*) FROM containers WHERE "projectId" = p.id) as containers,
  (SELECT COUNT(*) FROM domains WHERE "projectId" = p.id) as domains,
  (SELECT COUNT(*) FROM databases WHERE "projectId" = p.id) as databases,
  (SELECT COUNT(*) FROM volumes WHERE "projectId" = p.id) as volumes,
  (SELECT COUNT(*) FROM networks WHERE "projectId" = p.id) as networks
FROM projects p
WHERE p.id = '{project_id}';
```

**Expected Output**:
```
name | previewUrl | containers | domains | databases | volumes | networks
-----|------------|------------|---------|-----------|---------|----------
...  | https://.. |         ≥1 |      ≥1 |       ≥0  |     ≥0  |      ≥0
```

✅ Se tutti i count sono > 0, il progetto è completo!

---

## 🔧 Soluzione Automatizzata (Da Implementare)

### Script di Sincronizzazione

Creare `/root/vps-panel/backend/scripts/sync-project-metadata.ts`:

```typescript
/**
 * Sync Project Metadata Script
 *
 * Registra automaticamente nel database tutti i container, networks,
 * volumes, domains associati a un progetto deployato manualmente.
 *
 * Usage:
 *   npm run sync-metadata -- --project-id=cmiXXXXXX
 *   npm run sync-metadata -- --slug=my-project-slug
 */

import { PrismaClient } from '@prisma/client';
import Docker from 'dockerode';
import { execSync } from 'child_process';

const prisma = new PrismaClient();
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

async function syncProjectMetadata(projectIdOrSlug: string) {
  // 1. Get project
  const project = await prisma.projects.findFirst({
    where: {
      OR: [
        { id: projectIdOrSlug },
        { slug: projectIdOrSlug }
      ]
    }
  });

  if (!project) {
    throw new Error(`Project not found: ${projectIdOrSlug}`);
  }

  console.log(`Syncing metadata for: ${project.name} (${project.slug})`);

  // 2. Find containers in project directory
  const containers = await docker.listContainers({ all: true });

  const projectContainers = containers.filter(c =>
    c.Labels?.['com.docker.compose.project.working_dir'] === project.path
  );

  console.log(`Found ${projectContainers.length} containers`);

  // 3. Register containers
  for (const container of projectContainers) {
    const inspect = await docker.getContainer(container.Id).inspect();

    await prisma.containers.upsert({
      where: { dockerId: inspect.Id },
      create: {
        dockerId: inspect.Id,
        name: inspect.Name.replace('/', ''),
        image: inspect.Config.Image,
        projectId: project.id,
        ports: inspect.NetworkSettings.Ports || {},
        environment: {},
        volumes: [],
        networks: Object.keys(inspect.NetworkSettings.Networks),
        status: inspect.State.Running ? 'RUNNING' : 'STOPPED',
        restartPolicy: inspect.HostConfig.RestartPolicy.Name,
        startedAt: inspect.State.StartedAt ? new Date(inspect.State.StartedAt) : null
      },
      update: {
        status: inspect.State.Running ? 'RUNNING' : 'STOPPED'
      }
    });
  }

  // 4. Register networks
  const networks = await docker.listNetworks({
    filters: { label: [`com.docker.compose.project=${project.path.split('/').pop()}`] }
  });

  for (const network of networks) {
    const inspect = await docker.getNetwork(network.Id).inspect();

    await prisma.networks.upsert({
      where: { dockerId: network.Id },
      create: {
        dockerId: network.Id,
        name: network.Name,
        driver: network.Driver,
        scope: network.Scope,
        projectId: project.id,
        subnet: inspect.IPAM?.Config?.[0]?.Subnet,
        gateway: inspect.IPAM?.Config?.[0]?.Gateway
      },
      update: {}
    });
  }

  // 5. Register volumes
  const volumesCmd = execSync(
    `docker volume ls --filter label=com.docker.compose.project=${project.path.split('/').pop()} --format "{{.Name}}"`
  ).toString().trim().split('\n').filter(Boolean);

  for (const volumeName of volumesCmd) {
    const inspect = await docker.getVolume(volumeName).inspect();

    await prisma.volumes.upsert({
      where: { dockerId: inspect.Name },
      create: {
        dockerId: inspect.Name,
        name: inspect.Name.split('_').pop() || inspect.Name,
        driver: inspect.Driver,
        mountpoint: inspect.Mountpoint,
        projectId: project.id
      },
      update: {}
    });
  }

  // 6. Register preview domain if not exists
  const previewDomain = `${project.slug}.preview.agenzia.com`;

  await prisma.domains.upsert({
    where: { domain: previewDomain },
    create: {
      domain: previewDomain,
      projectId: project.id,
      type: 'PREVIEW',
      sslEnabled: true,
      sslProvider: 'letsencrypt',
      status: 'ACTIVE',
      verifiedAt: new Date()
    },
    update: {}
  });

  // 7. Update project preview URL
  await prisma.projects.update({
    where: { id: project.id },
    data: {
      previewUrl: `https://${previewDomain}`,
      lastDeployAt: new Date()
    }
  });

  console.log('✅ Metadata sync completed!');

  // Print summary
  const summary = await prisma.projects.findUnique({
    where: { id: project.id },
    include: {
      _count: {
        select: {
          containers: true,
          domains: true,
          databases: true,
          volumes: true,
          networks: true
        }
      }
    }
  });

  console.log('\n📊 Summary:');
  console.log(`  Containers: ${summary._count.containers}`);
  console.log(`  Domains: ${summary._count.domains}`);
  console.log(`  Databases: ${summary._count.databases}`);
  console.log(`  Volumes: ${summary._count.volumes}`);
  console.log(`  Networks: ${summary._count.networks}`);
}

// CLI
const args = process.argv.slice(2);
const projectArg = args.find(a => a.startsWith('--project-id=') || a.startsWith('--slug='));

if (!projectArg) {
  console.error('Usage: npm run sync-metadata -- --project-id=XXX or --slug=YYY');
  process.exit(1);
}

const projectIdOrSlug = projectArg.split('=')[1];
syncProjectMetadata(projectIdOrSlug)
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
```

### Aggiungere al package.json

```json
{
  "scripts": {
    "sync-metadata": "tsx src/scripts/sync-project-metadata.ts"
  }
}
```

### Usage

```bash
cd /root/vps-panel/backend

# By project ID
npm run sync-metadata -- --project-id=cmidfhoom000bip2jjbls1p77

# By slug
npm run sync-metadata -- --slug=studio-notarile-pellican-3e2084cf
```

---

## 📋 Checklist Post-Importazione

Dopo aver importato un progetto, verificare:

- [ ] Record in `projects` creato
- [ ] File estratti in `/var/www/projects/import-{backupId}`
- [ ] `docker-compose.yml` presente (o creato manualmente)
- [ ] `.env` configurato con password sicure
- [ ] Container avviati: `docker ps | grep {project-slug}`
- [ ] **Metadata registrati nel database**:
  - [ ] Containers registrati
  - [ ] Domains registrati
  - [ ] Databases registrati (se applicabile)
  - [ ] Volumes registrati
  - [ ] Networks registrati
- [ ] `previewUrl` configurato nel progetto
- [ ] `lastDeployAt` aggiornato
- [ ] Progetto visibile in dashboard console VPS
- [ ] Link funzionante nella card progetto
- [ ] Containers non in categoria "altri container"

---

## 🎯 Best Practices

### 1. Sempre Usare lo Script di Sync

Dopo ogni deploy manuale:
```bash
npm run sync-metadata -- --slug={project-slug}
```

### 2. Template Docker Compose Standardizzati

Mantenere template pronti per:
- Next.js + MySQL
- Next.js + PostgreSQL
- WordPress + MySQL
- Node.js generico
- PHP + MySQL
- Python + PostgreSQL

### 3. Naming Convention

Container names: `{project-slug}_{service}`
- ✅ `studio-notarile-pellican-3e2084cf_app`
- ✅ `studio-notarile-pellican-3e2084cf_db`
- ❌ `studio_notarile_pellicano_app` (underscore invece di slug)

### 4. Labels Traefik

Sempre usare slug del progetto nei label:
```yaml
labels:
  - "traefik.http.routers.{slug}.rule=Host(`{slug}.preview.agenzia.com`)"
```

---

**Documento creato**: 24 Novembre 2025
**Ultima modifica**: 24 Novembre 2025
**Versione**: 1.0
