import { FastifyInstance } from 'fastify';
import { usersController } from './users.controller';
import { authenticate } from '../../middlewares/auth';
import { requireAdmin } from '../../middlewares/admin';

export default async function usersRoutes(fastify: FastifyInstance) {
  // Add authentication and admin middleware to all routes
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', requireAdmin);

  // Get all users
  fastify.get('/', usersController.getAllUsers);

  // Get user statistics
  fastify.get('/stats', usersController.getUserStats);

  // Search users
  fastify.get('/search', usersController.searchUsers);

  // Get user by ID
  fastify.get('/:id', usersController.getUserById);

  // Create user
  fastify.post('/', usersController.createUser);

  // Update user
  fastify.patch('/:id', usersController.updateUser);

  // Delete user
  fastify.delete('/:id', usersController.deleteUser);

  // Change user password
  fastify.post('/:id/password', usersController.changeUserPassword);

  // Toggle user status
  fastify.post('/:id/toggle-status', usersController.toggleUserStatus);
}
