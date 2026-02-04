#!/usr/bin/env node
/**
 * Migrazione embeddings usando Supabase JS client
 * Estrae da Supabase e inserisce nel DB locale
 *
 * Uso:
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_KEY=your_service_role_key \
 *   LOCAL_DB_HOST=172.18.0.3 \
 *   LOCAL_DB_USER=user \
 *   LOCAL_DB_PASSWORD=pass \
 *   LOCAL_DB_NAME=dbname \
 *   node supabase-migrate.mjs
 */

import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

// Supabase config
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hggdvrbkjhytwfnvbjhp.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_KEY) {
  console.error('Set SUPABASE_KEY environment variable (use service_role key to bypass RLS)');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Local DB config (from env or defaults)
const LOCAL_DB = {
  host: process.env.LOCAL_DB_HOST || '172.18.0.3',
  port: parseInt(process.env.LOCAL_DB_PORT || '5432'),
  user: process.env.LOCAL_DB_USER || 'eccellenze_user',
  password: process.env.LOCAL_DB_PASSWORD || 'EccItaliane2024Secure!',
  database: process.env.LOCAL_DB_NAME || 'eccellenze_italiane_tv'
};

async function main() {
  const pool = new pg.Pool(LOCAL_DB);

  try {
    // Get video mapping
    const videoMap = new Map();
    const { rows: localVideos } = await pool.query('SELECT id, youtube_id FROM videos');
    for (const v of localVideos) {
      videoMap.set(v.youtube_id, v.id);
    }
    console.log(`Mapped ${videoMap.size} local videos`);

    // Count before
    const { rows: [{ count: beforeCount }] } = await pool.query('SELECT COUNT(*) FROM video_embeddings');
    console.log(`Embeddings before: ${beforeCount}`);

    // Fetch from Supabase in batches
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
        const youtubeId = emb.videos?.youtube_id;
        if (!youtubeId) {
          totalSkipped++;
          continue;
        }

        const localVideoId = videoMap.get(youtubeId);
        if (!localVideoId) {
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
            localVideoId,
            emb.chunk_index,
            emb.content,
            emb.timestamp_start,
            emb.timestamp_end,
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

    // Count after
    const { rows: [{ count: afterCount }] } = await pool.query('SELECT COUNT(*) FROM video_embeddings');

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
