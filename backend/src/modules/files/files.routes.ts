import { FastifyInstance } from 'fastify';
import { filesController } from './files.controller';
import { authenticate } from '../../middlewares/auth';

export async function filesRoutes(fastify: FastifyInstance) {
  // Add authentication middleware to all routes
  fastify.addHook('onRequest', authenticate);

  // List directory contents
  fastify.get('/list', filesController.listDirectory);

  // Create directory
  fastify.post('/directory', filesController.createDirectory);

  // Delete item
  fastify.delete('/item', filesController.deleteItem);

  // Rename item
  fastify.patch('/item', filesController.renameItem);

  // Download file
  fastify.get('/download', filesController.downloadFile);

  // Download directory as zip
  fastify.get('/download-zip', filesController.downloadAsZip);

  // Get file content (text)
  fastify.get('/content', filesController.getFileContent);

  // Upload file (requires multipart)
  fastify.post('/upload', filesController.uploadFile);

  // Move item
  fastify.post('/move', filesController.moveItem);

  // Copy item
  fastify.post('/copy', filesController.copyItem);

  // Extract archive
  fastify.post('/extract', filesController.extractArchive);
}
