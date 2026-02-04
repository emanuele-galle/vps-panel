import { FastifyInstance } from 'fastify';
import { systemSettingsController } from './system-settings.controller';
import { authenticate } from '../../middlewares/auth';
import { requireAdmin } from '../../middlewares/admin';

export default async function systemSettingsRoutes(fastify: FastifyInstance) {
  // Add authentication and admin middleware to all routes
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', requireAdmin);

  // Get all settings
  fastify.get('/', systemSettingsController.getAllSettings);

  // Get settings grouped by category
  fastify.get('/grouped', systemSettingsController.getSettingsGrouped);

  // Get settings by category
  fastify.get('/category/:category', systemSettingsController.getSettingsByCategory);

  // Get single setting by key
  fastify.get('/:key', systemSettingsController.getSettingByKey);

  // Create or update setting (upsert)
  fastify.post('/', systemSettingsController.upsertSetting);

  // Update existing setting
  fastify.put('/:key', systemSettingsController.updateSetting);

  // Bulk update settings
  fastify.post('/bulk', systemSettingsController.bulkUpdateSettings);

  // Delete setting
  fastify.delete('/:key', systemSettingsController.deleteSetting);

  // Initialize default settings
  fastify.post('/initialize', systemSettingsController.initializeDefaults);
}
