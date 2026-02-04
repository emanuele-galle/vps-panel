import { FastifyInstance } from 'fastify';
import { maintenanceController } from './maintenance.controller';
import { authenticate } from '../../middlewares/auth';
import { requireAdmin } from '../../middlewares/admin';

export async function maintenanceRoutes(fastify: FastifyInstance) {
  // Tutte le rotte richiedono autenticazione e ruolo admin
  fastify.addHook('onRequest', authenticate);
  fastify.addHook('onRequest', requireAdmin);

  // Status e info
  fastify.get('/status', maintenanceController.getStatus);
  fastify.get('/report', maintenanceController.getLastReport);

  // Esecuzione manutenzione
  fastify.post('/run', maintenanceController.runFullMaintenance);
  fastify.post('/run/:taskId', maintenanceController.runSingleTask);

  // Gestione scheduler
  fastify.post('/scheduler/start', maintenanceController.startScheduler);
  fastify.post('/scheduler/stop', maintenanceController.stopScheduler);
  fastify.post('/scheduler/restart', maintenanceController.restartScheduler);
}
