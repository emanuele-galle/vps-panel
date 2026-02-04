import { FastifyInstance } from 'fastify';
import { deployController } from './deploy.controller';
import { authenticate } from '../auth/jwt.middleware';

export default async function deployRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.post('/:id/deploy', deployController.startDeploy.bind(deployController));
  app.get('/:id/deployments', deployController.getDeployments.bind(deployController));
  app.get('/:id/deployments/latest', deployController.getLatestDeployment.bind(deployController));
}
