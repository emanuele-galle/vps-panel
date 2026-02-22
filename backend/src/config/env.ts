import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';
import log from '../services/logger.service';

// Load environment variables
dotenvConfig();

// Environment schema validation
const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3001').transform(Number),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Frontend
  FRONTEND_URL: z.string().url(),

  // Database
  DATABASE_URL: z.string().url(),

  // Redis
  REDIS_URL: z.string().url(),

  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  // Docker
  DOCKER_SOCKET: z.string().default('/var/run/docker.sock'),
  PROJECTS_ROOT: z.string().default('/var/www/projects'),

  // Traefik
  TRAEFIK_NETWORK: z.string().default('traefik-public'),
  PREVIEW_DOMAIN: z.string(),
  PANEL_DOMAIN: z.string(),

  // Google Drive backup folder override (default: derived from PANEL_DOMAIN)
  GDRIVE_BACKUP_FOLDER: z.string().optional(),

  // N8N webhook base URL
  N8N_WEBHOOK_BASE_URL: z.string().url().optional(),

  // Hostinger API
  HOSTINGER_API_KEY: z.string().optional(),
  HOSTINGER_API_URL: z.string().url().optional(),

  // Cloudflare
  CLOUDFLARE_EMAIL: z.string().email().optional(),
  CLOUDFLARE_API_KEY: z.string().optional(),

  // Email (SMTP)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().transform(Number).optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().optional(),

  // Security
  BCRYPT_ROUNDS: z.string().default('12').transform(Number),
  RATE_LIMIT_MAX: z.string().default('100').transform(Number),
  RATE_LIMIT_WINDOW: z.string().default('60000').transform(Number),

  // Encryption (separate from JWT for defense in depth)
  // 64 hex chars = 32 bytes = 256 bits
  ENCRYPTION_KEY: z.string().length(64).regex(/^[a-f0-9]+$/i, {
    message: 'ENCRYPTION_KEY must be 64 hex characters (256 bits)',
  }),

  // Monitoring
  METRICS_INTERVAL: z.string().default('30000').transform(Number),
  CLEANUP_INTERVAL: z.string().default('86400000').transform(Number),

  // Scheduler Cron Expressions
  SCHEDULE_DATABASE_SYNC: z.string().default('*/10 * * * *'),
  SCHEDULE_CONTAINER_SYNC: z.string().default('*/5 * * * *'),
  SCHEDULE_DOMAIN_SYNC: z.string().default('*/10 * * * *'),
  SCHEDULE_DISCOVERY: z.string().default('*/30 * * * *'),
  SCHEDULE_CREDENTIALS_SYNC: z.string().default('*/5 * * * *'),
  SCHEDULE_RESOURCE_ALERTS_MS: z.string().default('60000').transform(Number),
});

// Parse and validate environment
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  log.error('❌ Invalid environment variables:');
  log.error(JSON.stringify(parsed.error.format(), null, 2));
  process.exit(1);
}

export const config = parsed.data;

// Export individual configs for convenience
export const isDevelopment = config.NODE_ENV === 'development';
export const isProduction = config.NODE_ENV === 'production';
export const isTest = config.NODE_ENV === 'test';
