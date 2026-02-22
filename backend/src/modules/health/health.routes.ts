/**
 * Health Check Routes
 */

import { FastifyInstance } from "fastify";
import { healthController } from "./health.controller";
import { authenticate } from "../auth/jwt.middleware";

export default async function healthRoutes(app: FastifyInstance) {
  // Readiness probe - no authentication required (for k8s/docker health checks)
  app.get("/ready", healthController.getReadiness.bind(healthController));

  // Client error reporting - no auth required (errors happen before/during login)
  app.post("/client-errors", {
    schema: {
      body: {
        type: 'object',
        required: ['message'],
        properties: {
          message: { type: 'string', maxLength: 2000 },
          stack: { type: 'string', maxLength: 5000 },
          componentStack: { type: 'string', maxLength: 5000 },
          url: { type: 'string', maxLength: 500 },
          userAgent: { type: 'string', maxLength: 500 },
        },
      },
    },
    handler: healthController.reportClientError.bind(healthController),
  });

  // All other routes require authentication
  app.addHook("preHandler", authenticate);

  // Get system-wide health status
  app.get("/", healthController.getSystemHealth.bind(healthController));

  // Check SSL certificate expiry
  app.get("/ssl", healthController.checkSSLExpiry.bind(healthController));

  // Get container health
  app.get("/container/:containerId", healthController.getContainerHealth.bind(healthController));

  // Get resource usage (CPU, RAM, Disk)
  app.get("/resources", healthController.getResourceStatus.bind(healthController));

  // Clear health cache
  app.post("/clear-cache", healthController.clearCache.bind(healthController));
}
