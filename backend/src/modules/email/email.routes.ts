import { FastifyInstance } from 'fastify';
import { emailController } from './email.controller';
import { authenticate } from '../../middlewares/auth';
import { requireAdmin } from '../../middlewares/admin';

export default async function emailRoutes(fastify: FastifyInstance) {
  // Add authentication and admin middleware to all routes
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', requireAdmin);

  // Get all email accounts
  fastify.get('/', emailController.getAllEmails);

  // Get email statistics
  fastify.get('/stats', emailController.getEmailStats);

  // Sync from Hostinger
  fastify.post('/sync', emailController.syncFromHostinger);

  // Get email account by ID
  fastify.get('/:id', emailController.getEmailById);

  // Create email account
  fastify.post('/', emailController.createEmail);

  // Update email account
  fastify.patch('/:id', emailController.updateEmail);

  // Delete email account
  fastify.delete('/:id', emailController.deleteEmail);

  // Change email password
  fastify.post('/:id/password', emailController.changePassword);
}
