/**
 * Health Check Routes
 */

import { FastifyInstance } from "fastify";
import { healthController } from "./health.controller";
import { authenticate } from "../auth/jwt.middleware";

export default async function healthRoutes(app: FastifyInstance) {
  // Readiness probe - no authentication required (for k8s/docker health checks)
  app.get("/ready", healthController.getReadiness.bind(healthController));

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
