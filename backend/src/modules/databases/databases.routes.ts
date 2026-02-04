import { FastifyInstance } from 'fastify';
import { databasesController } from './databases.controller';
import { authenticate } from '../auth/jwt.middleware';

export default async function databasesRoutes(app: FastifyInstance) {
  // All routes require authentication
  app.addHook('preHandler', authenticate);

  // CRUD operations
  app.get('/', databasesController.getDatabases.bind(databasesController));
  app.get('/:id', databasesController.getDatabase.bind(databasesController));
  app.post('/', databasesController.createDatabase.bind(databasesController));
  app.put('/:id', databasesController.updateDatabase.bind(databasesController));
  app.delete('/:id', databasesController.deleteDatabase.bind(databasesController));

  // Connection string
  app.get(
    '/:id/connection',
    databasesController.getConnectionString.bind(databasesController)
  );
}
