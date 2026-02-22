// BigInt JSON serialization support - PostgreSQL returns bigint for sizes
// Safe because all our BigInt values (file/db sizes) are within Number.MAX_SAFE_INTEGER
(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};
import { buildApp } from './app';
import { config } from './config/env';
import { schedulerService } from './modules/backup/scheduler.service';
import { discoverySchedulerService } from './modules/projects/discovery.scheduler';
import { credentialsSchedulerService } from './modules/projects/credentials.scheduler';
import { resourceAlertsService } from './services/resource-alerts.service';
import { maintenanceSchedulerService } from './modules/maintenance/maintenance.scheduler';
import { databaseSchedulerService } from './modules/databases/database.scheduler';
import { containerSchedulerService } from './modules/docker/container.scheduler';
import { domainSchedulerService } from './modules/domains/domain.scheduler';
import log from './services/logger.service';

async function start() {
  try {
    const app = await buildApp();

    // Start server
    await app.listen({
      port: config.PORT,
      host: config.HOST,
    });

    app.log.info(`🚀 Server running on http://${config.HOST}:${config.PORT}`);
    app.log.info(`📝 Environment: ${config.NODE_ENV}`);
    app.log.info(`🔗 Frontend URL: ${config.FRONTEND_URL}`);

    // Start backup scheduler
    schedulerService.start();
    app.log.info('📦 Backup scheduler started');

    // Start discovery scheduler
    discoverySchedulerService.start(config.SCHEDULE_DISCOVERY);
    app.log.info(`🔍 Discovery scheduler started (${config.SCHEDULE_DISCOVERY})`);

    // Start credentials sync scheduler
    credentialsSchedulerService.start(config.SCHEDULE_CREDENTIALS_SYNC);
    app.log.info(`🔄 Credentials scheduler started (${config.SCHEDULE_CREDENTIALS_SYNC})`);

    // Start resource alerts monitoring
    await resourceAlertsService.start(config.SCHEDULE_RESOURCE_ALERTS_MS);
    app.log.info(`⚠️ Resource alerts monitoring started (${config.SCHEDULE_RESOURCE_ALERTS_MS}ms)`);

    // Start maintenance scheduler
    await maintenanceSchedulerService.start();
    app.log.info('🧹 Maintenance scheduler started');

    // Start database sync scheduler
    databaseSchedulerService.start(config.SCHEDULE_DATABASE_SYNC);
    app.log.info(`🗄️ Database scheduler started (${config.SCHEDULE_DATABASE_SYNC})`);

    // Start container sync scheduler (infra only)
    containerSchedulerService.start(config.SCHEDULE_CONTAINER_SYNC);
    app.log.info(`🐳 Container scheduler started (${config.SCHEDULE_CONTAINER_SYNC})`);

    // Start domain sync scheduler
    domainSchedulerService.start(config.SCHEDULE_DOMAIN_SYNC);
    app.log.info(`🌐 Domain scheduler started (${config.SCHEDULE_DOMAIN_SYNC})`);

    // Graceful shutdown
    const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];

    signals.forEach((signal) => {
      process.on(signal, async () => {
        app.log.info(`${signal} received, closing server gracefully...`);

        // Stop backup scheduler
        schedulerService.stop();
        app.log.info('📦 Backup scheduler stopped');

        // Stop discovery scheduler
        discoverySchedulerService.stop();
        credentialsSchedulerService.stop();
        app.log.info('🔍 Discovery scheduler stopped');

        // Stop resource alerts monitoring
        resourceAlertsService.stop();

        // Stop maintenance scheduler
        maintenanceSchedulerService.stop();
        app.log.info('🧹 Maintenance scheduler stopped');
        app.log.info('⚠️ Resource alerts monitoring stopped');

        // Stop new schedulers
        databaseSchedulerService.stop();
        containerSchedulerService.stop();
        domainSchedulerService.stop();
        app.log.info('📊 Sync schedulers stopped');

        // Close database and cache connections
        const { prisma } = await import('./services/prisma.service');
        const { redis } = await import('./services/redis.service');
        await prisma.$disconnect();
        app.log.info('🗄️ Prisma disconnected');
        await redis.disconnect();
        app.log.info('📮 Redis disconnected');

        await app.close();
        process.exit(0);
      });
    });

  } catch (error) {
    log.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

start();
