import { FastifyInstance } from 'fastify';
import { monitoringController } from './monitoring.controller';
import { authenticate } from '../auth/jwt.middleware';

export default async function monitoringRoutes(app: FastifyInstance) {
  // All routes require authentication
  app.addHook('preHandler', authenticate);

  app.get('/current', {
    schema: {
      tags: ['Monitoring'],
      summary: 'Metriche correnti',
      description: 'Restituisce le metriche correnti del sistema (CPU, RAM, Disk)',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      response: {
        200: {
          description: 'Metriche correnti',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                cpu: { type: 'number', description: 'Utilizzo CPU in %' },
                memory: {
                  type: 'object',
                  properties: {
                    total: { type: 'number', description: 'RAM totale in bytes' },
                    used: { type: 'number' },
                    free: { type: 'number' },
                    percentage: { type: 'number' },
                  },
                },
                disk: {
                  type: 'object',
                  properties: {
                    total: { type: 'number' },
                    used: { type: 'number' },
                    free: { type: 'number' },
                    percentage: { type: 'number' },
                  },
                },
                network: {
                  type: 'object',
                  properties: {
                    received: { type: 'number' },
                    transmitted: { type: 'number' },
                  },
                },
                docker: {
                  type: 'object',
                  properties: {
                    containersRunning: { type: 'number' },
                    containersStopped: { type: 'number' },
                    imagesCount: { type: 'number' },
                    volumesCount: { type: 'number' },
                  },
                },
                timestamp: { type: 'string' },
              },
            },
          },
        },
      },
    },
    handler: monitoringController.getCurrentMetrics.bind(monitoringController),
  });

  app.get('/history', {
    schema: {
      tags: ['Monitoring'],
      summary: 'Storico metriche',
      description: 'Restituisce lo storico delle metriche (ultimi 60 punti)',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          hours: { type: 'integer', minimum: 1, maximum: 168, description: 'Ore di storia (default 24)' },
        },
      },
    },
    handler: monitoringController.getMetricsHistory.bind(monitoringController),
  });

  app.get('/container/:id', {
    schema: {
      tags: ['Monitoring'],
      summary: 'Statistiche container',
      description: 'Restituisce le statistiche di un container Docker specifico',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'ID o nome del container' },
        },
      },
    },
    handler: monitoringController.getContainerStats.bind(monitoringController),
  });

  // Disk metrics routes
  app.get('/disk', {
    schema: {
      tags: ['Monitoring'],
      summary: 'Metriche disco',
      description: 'Analisi dettagliata utilizzo disco',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
    },
    handler: monitoringController.getDiskMetrics.bind(monitoringController),
  });

  app.get('/disk/volumes', {
    schema: {
      tags: ['Monitoring'],
      summary: 'Storage volumi Docker',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
    },
    handler: monitoringController.getVolumesStorage.bind(monitoringController),
  });

  app.get('/disk/containers', {
    schema: {
      tags: ['Monitoring'],
      summary: 'Storage container Docker',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
    },
    handler: monitoringController.getContainersStorage.bind(monitoringController),
  });

  app.get('/disk/images', {
    schema: {
      tags: ['Monitoring'],
      summary: 'Storage immagini Docker',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
    },
    handler: monitoringController.getImagesStorage.bind(monitoringController),
  });

  app.get('/disk/databases', {
    schema: {
      tags: ['Monitoring'],
      summary: 'Storage database',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
    },
    handler: monitoringController.getDatabasesStorage.bind(monitoringController),
  });
}
