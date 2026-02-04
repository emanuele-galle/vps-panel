import { FastifyInstance } from 'fastify';
import { projectsController } from './projects.controller';
import { authenticate } from '../auth/jwt.middleware';

export default async function projectsRoutes(app: FastifyInstance) {
  // All routes require authentication
  app.addHook('preHandler', authenticate);

  // Project discovery (ADMIN only) - must be before /:id routes
  app.get('/discovery/scan', projectsController.discoverProjects.bind(projectsController));
  app.post('/discovery/import', projectsController.importDiscoveredProject.bind(projectsController));
  app.post('/discovery/import-all', projectsController.importAllDiscoveredProjects.bind(projectsController));

  // CRUD operations
  app.get('/', projectsController.getProjects.bind(projectsController));
  app.get('/:id', projectsController.getProject.bind(projectsController));
  app.post('/', projectsController.createProject.bind(projectsController));
  app.put('/:id', projectsController.updateProject.bind(projectsController));
  app.delete('/:id', projectsController.deleteProject.bind(projectsController));

  // Project actions
  app.post('/:id/start', projectsController.startProject.bind(projectsController));
  app.post('/:id/stop', projectsController.stopProject.bind(projectsController));
  app.post('/:id/restart', projectsController.restartProject.bind(projectsController));
  app.get('/:id/logs', projectsController.getProjectLogs.bind(projectsController));
  app.get('/:id/size', projectsController.getProjectSize.bind(projectsController));
  app.put('/:id/credentials', projectsController.updateCredentials.bind(projectsController));
  app.post('/:id/sync-credentials', projectsController.syncCredentials.bind(projectsController));

  // Temporary files management
  app.get('/:id/temp-files', projectsController.getTempFiles.bind(projectsController));
  app.post('/:id/temp-files', projectsController.uploadTempFiles.bind(projectsController));
  app.delete('/:id/temp-files/:filename', projectsController.deleteTempFile.bind(projectsController));
  app.delete('/:id/temp-files', projectsController.clearTempFiles.bind(projectsController));

  // Project members management
  app.get('/:id/members', projectsController.getMembers.bind(projectsController));
  app.get('/:id/available-staff', projectsController.getAvailableStaff.bind(projectsController));
  app.post('/:id/members', projectsController.addMember.bind(projectsController));
  app.put('/:id/members/:memberId', projectsController.updateMemberRole.bind(projectsController));
  app.delete('/:id/members/:memberId', projectsController.removeMember.bind(projectsController));

  // Environment variables management
  app.get('/:id/env', projectsController.getEnvVars.bind(projectsController));
  app.put('/:id/env', projectsController.updateEnvVars.bind(projectsController));
}
