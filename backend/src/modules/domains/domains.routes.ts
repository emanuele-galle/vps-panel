import { FastifyInstance } from 'fastify';
import { domainsController } from './domains.controller';
import { authenticate } from '../auth/jwt.middleware';

export default async function domainsRoutes(app: FastifyInstance) {
  // All routes require authentication
  app.addHook('preHandler', authenticate);

  // CRUD operations
  app.get('/', domainsController.getDomains.bind(domainsController));
  app.get('/:id', domainsController.getDomain.bind(domainsController));
  app.post('/', domainsController.createDomain.bind(domainsController));
  app.put('/:id', domainsController.updateDomain.bind(domainsController));
  app.delete('/:id', domainsController.deleteDomain.bind(domainsController));

  // Domain verification
  app.post('/verify', domainsController.verifyDomain.bind(domainsController));
}
