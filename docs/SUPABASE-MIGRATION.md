# Migrazione Database da Supabase a PostgreSQL Locale

Guida per migrare progetti che usano Supabase come database verso PostgreSQL locale gestito dal VPS Panel.

## Panoramica

Quando si importa un progetto che usa Supabase, è necessario:
1. Migrare lo schema del database
2. Migrare i dati (inclusi embeddings vettoriali)
3. Aggiornare la configurazione dell'applicazione

## Prerequisiti

- Node.js installato nel sistema
- Accesso al progetto Supabase (service_role key)
- PostgreSQL locale con estensione pgvector (se il progetto usa embeddings)

## 1. Ottenere Credenziali Supabase

Dal dashboard Supabase (https://supabase.com/dashboard):

1. **Project Settings** → **API**
2. Copiare:
   - **Project URL**: `https://<project-ref>.supabase.co`
   - **service_role key** (NON anon key)

**IMPORTANTE**: La `service_role` key è necessaria per bypassare Row Level Security (RLS).

## 2. Script di Migrazione Embeddings

Per progetti con embeddings vettoriali (pgvector), usare lo script seguente.

### Installazione dipendenze

```bash
mkdir migration && cd migration
npm init -y
npm install @supabase/supabase-js pg
```

### Script: supabase-migrate.mjs

```javascript
#!/usr/bin/env node
/**
 * Migrazione embeddings usando Supabase JS client
 * Estrae da Supabase e inserisce nel DB locale
 */

import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

// Supabase config (da variabili ambiente)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_KEY || !SUPABASE_URL) {
  console.error('Set SUPABASE_URL and SUPABASE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Local DB config (da variabili ambiente)
const LOCAL_DB = {
  host: process.env.LOCAL_DB_HOST,
  port: parseInt(process.env.LOCAL_DB_PORT || '5432'),
  user: process.env.LOCAL_DB_USER,
  password: process.env.LOCAL_DB_PASSWORD,
  database: process.env.LOCAL_DB_NAME
};

async function main() {
  const pool = new pg.Pool(LOCAL_DB);

  try {
    // Mappa entità per foreign keys (es. youtube_id -> video_id locale)
    const entityMap = new Map();
    const { rows: localEntities } = await pool.query(
      'SELECT id, youtube_id FROM videos'  // Adattare alla propria tabella
    );
    for (const e of localEntities) {
      entityMap.set(e.youtube_id, e.id);
    }
    console.log(`Mapped ${entityMap.size} local entities`);

    // Count prima della migrazione
    const { rows: [{ count: beforeCount }] } = await pool.query(
      'SELECT COUNT(*) FROM video_embeddings'
    );
    console.log(`Embeddings before: ${beforeCount}`);

    // Fetch da Supabase in batch
    const BATCH_SIZE = 50;
    let offset = 0;
    let totalInserted = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    while (true) {
      console.log(`\nFetching batch at offset ${offset}...`);

      const { data: embeddings, error } = await supabase
        .from('video_embeddings')
        .select(`
          chunk_index,
          content,
          timestamp_start,
          timestamp_end,
          embedding,
          metadata,
          videos!inner(youtube_id)
        `)
        .range(offset, offset + BATCH_SIZE - 1);

      if (error) {
        console.error('Supabase error:', error.message);
        break;
      }

      if (!embeddings || embeddings.length === 0) {
        console.log('No more embeddings');
        break;
      }

      console.log(`Got ${embeddings.length} embeddings`);

      for (const emb of embeddings) {
        const foreignKey = emb.videos?.youtube_id;
        if (!foreignKey) {
          totalSkipped++;
          continue;
        }

        const localId = entityMap.get(foreignKey);
        if (!localId) {
          totalSkipped++;
          continue;
        }

        try {
          const result = await pool.query(`
            INSERT INTO video_embeddings
              (video_id, chunk_index, content, timestamp_start, timestamp_end, embedding, metadata)
            VALUES ($1, $2, $3, $4, $5, $6::vector, $7::jsonb)
            ON CONFLICT DO NOTHING
            RETURNING id
          `, [
            localId,
            emb.chunk_index,
            emb.content,
            emb.timestamp_start,
            emb.timestamp_end,
            // IMPORTANTE: non stringificare se già stringa
            typeof emb.embedding === 'string' ? emb.embedding : JSON.stringify(emb.embedding),
            typeof emb.metadata === 'string' ? emb.metadata : JSON.stringify(emb.metadata)
          ]);

          if (result.rows.length > 0) {
            totalInserted++;
          }
        } catch (err) {
          console.error(`Error: ${err.message.substring(0, 100)}`);
          totalErrors++;
        }
      }

      offset += BATCH_SIZE;

      if (embeddings.length < BATCH_SIZE) {
        break;
      }
    }

    // Count dopo la migrazione
    const { rows: [{ count: afterCount }] } = await pool.query(
      'SELECT COUNT(*) FROM video_embeddings'
    );

    console.log(`\n=== RESULT ===`);
    console.log(`Inserted: ${totalInserted}`);
    console.log(`Skipped: ${totalSkipped}`);
    console.log(`Errors: ${totalErrors}`);
    console.log(`Embeddings after: ${afterCount}`);

  } finally {
    await pool.end();
  }
}

main().catch(console.error);
```

### Esecuzione

```bash
SUPABASE_URL=https://xxxxx.supabase.co \
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... \
LOCAL_DB_HOST=container-postgres \
LOCAL_DB_PORT=5432 \
LOCAL_DB_USER=myuser \
LOCAL_DB_PASSWORD=mypassword \
LOCAL_DB_NAME=mydatabase \
node supabase-migrate.mjs
```

## 3. Problemi Comuni e Soluzioni

### "No more embeddings" con 0 risultati

**Causa**: Uso della `anon key` invece della `service_role key`

**Soluzione**: Usare la service_role key per bypassare RLS

### "invalid input syntax for type vector"

**Causa**: L'embedding viene stringificato due volte

**Soluzione**: Verificare il tipo prima di stringificare:
```javascript
typeof emb.embedding === 'string' ? emb.embedding : JSON.stringify(emb.embedding)
```

### Connessione diretta PostgreSQL fallisce

**Causa**: Supabase blocca connessioni IPv6 dirette da alcuni ambienti

**Soluzione**: Usare il Supabase JS client invece di pg_dump/psql diretto

### pg_dump version mismatch

**Causa**: Versione pg_dump locale < versione server Supabase (17.x)

**Soluzione**: Non usare pg_dump, usare il JS client

## 4. Migrazione Schema (senza embeddings)

Per tabelle normali senza vettori, si può usare l'MCP Supabase o query dirette:

```javascript
// Via Supabase JS client
const { data, error } = await supabase
  .from('table_name')
  .select('*');

// Inserire nel DB locale
for (const row of data) {
  await pool.query(
    'INSERT INTO table_name (...) VALUES (...)',
    [row.field1, row.field2, ...]
  );
}
```

## 5. Aggiornamento Configurazione Progetto

Dopo la migrazione, aggiornare il progetto per usare PostgreSQL locale:

### docker-compose.yml

```yaml
services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - internal

  app:
    # ...
    environment:
      DATABASE_URL: postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}
    depends_on:
      - postgres
```

### .env

```env
# Rimuovere
# SUPABASE_URL=...
# SUPABASE_KEY=...

# Aggiungere
DB_HOST=postgres
DB_PORT=5432
DB_USER=myuser
DB_PASSWORD=securepassword
DB_NAME=mydatabase
DATABASE_URL=postgresql://myuser:securepassword@postgres:5432/mydatabase
```

## 6. Verifica Migrazione

```bash
# Contare record nel DB locale
docker exec <postgres-container> psql -U <user> -d <db> -c "SELECT COUNT(*) FROM <table>"

# Verificare dimensioni vettori (se pgvector)
docker exec <postgres-container> psql -U <user> -d <db> -c "SELECT vector_dims(embedding) FROM video_embeddings LIMIT 1"
```

## 7. Checklist Post-Migrazione

- [ ] Tutti i dati migrati correttamente
- [ ] Applicazione funziona con DB locale
- [ ] Backup configurato per il nuovo database
- [ ] Progetto Supabase può essere eliminato
- [ ] Credenziali Supabase rimosse dal codice/env

## Riferimenti

- Script migrazione: `/root/eccellenze-migration/supabase-migrate.mjs`
- Supabase JS Client: https://supabase.com/docs/reference/javascript
- pgvector: https://github.com/pgvector/pgvector
