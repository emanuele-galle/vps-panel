import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import websocket from '@fastify/websocket';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';

import { config, isProduction } from './config/env';
import { COOKIE_NAMES } from './utils/cookies';
import { errorHandler } from './utils/errors';
import { registerGlobalRateLimit } from './middlewares/rate-limit.middleware';
import { registerCsrfProtection } from './middlewares/csrf.middleware';
import authRoutes from './modules/auth/auth.routes';
import monitoringRoutes from './modules/monitoring/monitoring.routes';
import projectsRoutes from './modules/projects/projects.routes';
import { projectsWsRoutes } from './modules/projects/projects.ws.routes';
import { terminalWsRoutes } from './modules/docker/terminal.ws.routes';
import { initProjectsWebSocket } from './modules/projects/projects.events';
import dockerRoutes from './modules/docker/docker.routes';
import domainsRoutes from './modules/domains/domains.routes';
import databasesRoutes from './modules/databases/databases.routes';
import { fileManagerRoutes } from './modules/filemanager/filemanager.routes';
import { filesRoutes } from './modules/files/files.routes';
import emailRoutes from './modules/email/email.routes';
import usersRoutes from './modules/users/users.routes';
import activityRoutes from './modules/activity/activity.routes';
import systemSettingsRoutes from './modules/system-settings/system-settings.routes';
import backupRoutes from './modules/backup/backup.routes';
import optimizationRoutes from './modules/optimization/optimization.routes';
import systemBackupRoutes from './modules/backup/system-backup.routes';
import n8nRoutes from './modules/n8n/n8n.routes';
import { securityRoutes } from './modules/security/security.routes';
import gdriveBackupRoutes from './modules/backup/gdrive-backup.routes';
import healthRoutes from './modules/health/health.routes';
import { maintenanceRoutes } from './modules/maintenance/maintenance.routes';
import deployRoutes from './modules/projects/deploy.routes';
import notificationRoutes from './modules/notifications/notification.routes';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      transport: config.NODE_ENV === 'development' ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      } : undefined,
    },
    trustProxy: true,
    bodyLimit: 524288000, // 500MB (aumentato per backup)
  });

  // Security plugins with proper CSP for API
  await app.register(helmet, {
    // Content Security Policy - strict for API
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        // APIs don't serve HTML/scripts, but allow same-origin for error pages
        scriptSrc: ["'none'"],
        styleSrc: ["'none'"],
        imgSrc: ["'none'"],
        connectSrc: ["'self'"],
        fontSrc: ["'none'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'none'"],
        frameSrc: ["'none'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        upgradeInsecureRequests: [],
      },
    },
    // Cross-Origin headers for API security
    crossOriginEmbedderPolicy: false, // Disabled - can break CORS
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-origin' },
    // DNS Prefetch Control
    dnsPrefetchControl: { allow: false },
    // Expect-CT is deprecated, skip
    // Frameguard - prevent embedding
    frameguard: { action: 'deny' },
    // Hide X-Powered-By header
    hidePoweredBy: true,
    // HSTS - enable in production
    hsts: config.NODE_ENV === 'production' ? {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    } : false,
    // IE No Open
    ieNoOpen: true,
    // No Sniff - prevent MIME sniffing
    noSniff: true,
    // Origin Agent Cluster
    originAgentCluster: true,
    // Permitted Cross-Domain Policies
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },
    // Referrer Policy
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    // X-XSS-Protection (legacy, but still useful)
    xssFilter: true,
  });

  await app.register(cors, {
    origin: config.FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // Cookie plugin for HttpOnly JWT storage
  await app.register(cookie, {
    secret: config.JWT_SECRET, // Use same secret for cookie signing
    parseOptions: {}, // Accept all cookies
  });

  // JWT plugin with cookie extraction
  await app.register(jwt, {
    secret: config.JWT_SECRET,
    sign: {
      expiresIn: config.JWT_EXPIRES_IN,
    },
    // Custom extraction to support both cookies and Authorization header
    cookie: {
      cookieName: COOKIE_NAMES.ACCESS_TOKEN,
      signed: false, // JWT is self-verifying
    },
  });

  // File upload plugin with proper limits
  await app.register(multipart, {
    limits: {
      fieldNameSize: 100,
      fieldSize: 1000000, // 1MB for text fields
      fields: 10,
      fileSize: 104857600, // 100MB max file size
      files: 10,
      headerPairs: 2000,
    },
  });

  // WebSocket plugin
  await app.register(websocket);

  // Compression handled by Traefik compress@file middleware
  // (removed @fastify/compress to avoid double-compression with proxy)

  // OpenAPI/Swagger documentation
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'VPS Console API',
        description: 'API per la gestione completa del pannello VPS - Progetti, Docker, Domini, Database, Backup, Sicurezza',
        version: '1.7.0',
      },
      servers: [
        { url: 'https://api.fodivps1.cloud', description: 'Production' },
        { url: 'http://localhost:3001', description: 'Development' }
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'JWT token nel header Authorization: Bearer <token>',
          },
          cookieAuth: {
            type: 'apiKey',
            in: 'cookie',
            name: 'access_token',
            description: 'JWT token in HttpOnly cookie (usato dal frontend)',
          },
        },
      },
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      tags: [
        { name: 'Auth', description: 'Autenticazione e gestione sessioni' },
        { name: 'Monitoring', description: 'Monitoraggio sistema (CPU, RAM, Disk)' },
        { name: 'Projects', description: 'Gestione progetti PM2' },
        { name: 'Docker', description: 'Gestione container e servizi Docker' },
        { name: 'Domains', description: 'Gestione domini Cloudflare' },
        { name: 'Databases', description: 'Gestione database PostgreSQL/MySQL/Redis' },
        { name: 'File Manager', description: 'Gestione file e cartelle' },
        { name: 'Email', description: 'Gestione email forwarding' },
        { name: 'Users', description: 'Gestione utenti admin' },
        { name: 'Activity', description: 'Log attività utenti' },
        { name: 'System Settings', description: 'Configurazione sistema' },
        { name: 'Backup', description: 'Backup database e progetti' },
        { name: 'Optimization', description: 'Ottimizzazione sistema' },
        { name: 'N8N', description: 'Integrazione workflow N8N' },
        { name: 'Security', description: 'Sicurezza e firewall' },
        { name: 'Health', description: 'Health check e diagnostica' },
        { name: 'Maintenance', description: 'Manutenzione sistema' },
        { name: 'Deploy', description: 'Deploy progetti da Git' },
        { name: 'Notifications', description: 'Notifiche in-app' },
        { name: 'Terminal', description: 'Web terminal per container Docker' },
      ],
    },
  });

  await app.register(swaggerUI, {
    routePrefix: '/api/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      defaultModelsExpandDepth: 2,
      defaultModelExpandDepth: 2,
      displayRequestDuration: true,
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
      tryItOutEnabled: true,
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
  });

  // Request ID and context logging
  app.addHook('onRequest', async (request, reply) => {
    // Generate request ID if not present
    const requestId = request.headers['x-request-id'] as string ||
      `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Add header to response
    reply.header('x-request-id', requestId);

    // Create child logger with context
    request.log = app.log.child({
      requestId,
      method: request.method,
      url: request.url,
      ip: request.ip,
      userAgent: request.headers['user-agent']?.substring(0, 100),
    });
  });

  // Log request completion
  app.addHook('onResponse', async (request, reply) => {
    request.log.info({
      statusCode: reply.statusCode,
      responseTime: reply.elapsedTime,
    }, 'Request completed');
  });

  // Global rate limiting
  await registerGlobalRateLimit(app);

  // CSRF protection (only in production)
  if (isProduction) {
    await registerCsrfProtection(app);
  }

  // Health check endpoint
  app.get('/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.NODE_ENV,
    };
  });

  // Root endpoint
  app.get('/', async () => {
    return {
      name: 'VPS Control Panel API',
      version: '1.0.0',
      status: 'running',
    };
  });

  // Register module routes
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(monitoringRoutes, { prefix: '/api/monitoring' });
  await app.register(projectsRoutes, { prefix: '/api/projects' });
  await app.register(dockerRoutes, { prefix: '/api/docker' });
  await app.register(domainsRoutes, { prefix: '/api/domains' });
  await app.register(databasesRoutes, { prefix: '/api/databases' });
  await app.register(fileManagerRoutes, { prefix: '/api/filemanager' });
  await app.register(filesRoutes, { prefix: '/api/files' });
  await app.register(emailRoutes, { prefix: '/api/email' });
  await app.register(usersRoutes, { prefix: '/api/users' });
  await app.register(activityRoutes, { prefix: '/api/activity' });
  await app.register(systemSettingsRoutes, { prefix: '/api/system-settings' });
  await app.register(backupRoutes, { prefix: '/api/backups' });
  await app.register(optimizationRoutes, { prefix: '/api/optimization' });
  await app.register(systemBackupRoutes, { prefix: '/api/system-backup' });
  await app.register(n8nRoutes, { prefix: '/api/n8n' });
  await app.register(securityRoutes, { prefix: '/api/security' });
  await app.register(gdriveBackupRoutes, { prefix: '/api/gdrive-backup' });
  await app.register(healthRoutes, { prefix: '/api/health' });
  // Maintenance routes
  await app.register(maintenanceRoutes, { prefix: '/api/maintenance' });
  // Deploy routes (nested under projects)
  await app.register(deployRoutes, { prefix: '/api/projects' });
  // Notification routes
  await app.register(notificationRoutes, { prefix: '/api/notifications' });

  // WebSocket routes for real-time updates
  await app.register(projectsWsRoutes);

  // Terminal WebSocket routes
  await app.register(terminalWsRoutes);

  // Initialize WebSocket handlers
  initProjectsWebSocket(app);

  // Error handler
  app.setErrorHandler(errorHandler);

  // 404 handler
  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route ${request.method}:${request.url} not found`,
      },
    });
  });

  // Start periodic session cleanup (every hour)
  const { authService } = await import('./modules/auth/auth.service');
  setInterval(async () => {
    try {
      const count = await authService.cleanupExpiredSessions();
      if (count > 0) {
        app.log.info({ deletedSessions: count }, 'Cleaned up expired sessions');
      }
    } catch (err) {
      app.log.error({ err }, 'Failed to cleanup expired sessions');
    }
  }, 60 * 60 * 1000); // Every hour

  // Start periodic metrics snapshot (every 5 minutes)
  const { monitoringService } = await import('./modules/monitoring/monitoring.service');
  setInterval(async () => {
    try {
      await monitoringService.saveMetricsSnapshot();
      app.log.info('[Metrics] Snapshot saved');
    } catch (err) {
      app.log.error({ err }, 'Failed to save metrics snapshot');
    }
  }, 5 * 60 * 1000); // Every 5 minutes

  // Save initial metrics snapshot
  try {
    await monitoringService.saveMetricsSnapshot();
    app.log.info('[Metrics] Initial snapshot saved');
  } catch (err) {
    app.log.error({ err }, 'Failed to save initial metrics snapshot');
  }

  // Periodic notification cleanup (daily at startup + every 24h)
  const { notificationService } = await import('./services/notification.service');
  setInterval(async () => {
    try {
      await notificationService.cleanupOld(30);
    } catch (err) {
      app.log.error({ err }, 'Failed to cleanup old notifications');
    }
  }, 24 * 60 * 60 * 1000); // Every 24 hours

  return app;
}
