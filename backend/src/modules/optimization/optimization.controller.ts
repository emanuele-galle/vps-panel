import { FastifyRequest, FastifyReply } from 'fastify';
import { optimizationService } from './optimization.service';

export class OptimizationController {
  /**
   * Analyze cleanup opportunities
   */
  async analyze(request: FastifyRequest, reply: FastifyReply) {
    try {
      const analysis = await optimizationService.analyzeCleanupOpportunities();

      return reply.send({
        success: true,
        data: analysis,
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'ANALYSIS_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  /**
   * Clean Docker build cache
   */
  async cleanDockerCache(request: FastifyRequest, reply: FastifyReply) {
    try {
      const result = await optimizationService.cleanDockerBuildCache();

      return reply.send({
        success: result.success,
        data: result,
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'CLEANUP_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  /**
   * Clean npm cache
   */
  async cleanNpmCache(request: FastifyRequest, reply: FastifyReply) {
    try {
      const result = await optimizationService.cleanNpmCache();

      return reply.send({
        success: result.success,
        data: result,
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'CLEANUP_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  /**
   * Clean apt cache
   */
  async cleanAptCache(request: FastifyRequest, reply: FastifyReply) {
    try {
      const result = await optimizationService.cleanAptCache();

      return reply.send({
        success: result.success,
        data: result,
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'CLEANUP_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  /**
   * Clean journal logs
   */
  async cleanLogs(request: FastifyRequest, reply: FastifyReply) {
    try {
      const result = await optimizationService.cleanJournalLogs();

      return reply.send({
        success: result.success,
        data: result,
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'CLEANUP_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  /**
   * Prune Docker volumes
   */
  async pruneVolumes(request: FastifyRequest, reply: FastifyReply) {
    try {
      const result = await optimizationService.pruneDockerVolumes();

      return reply.send({
        success: result.success,
        data: result,
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'CLEANUP_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  /**
   * Prune Docker images (dangling only)
   */
  async pruneImages(request: FastifyRequest, reply: FastifyReply) {
    try {
      const result = await optimizationService.pruneDockerImages();

      return reply.send({
        success: result.success,
        data: result,
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'CLEANUP_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  /**
   * Prune all unused Docker images
   */
  async pruneUnusedImages(request: FastifyRequest, reply: FastifyReply) {
    try {
      const result = await optimizationService.pruneUnusedImages();

      return reply.send({
        success: result.success,
        data: result,
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'CLEANUP_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  /**
   * Truncate container logs
   */
  async truncateLogs(request: FastifyRequest, reply: FastifyReply) {
    try {
      const result = await optimizationService.truncateContainerLogs();

      return reply.send({
        success: result.success,
        data: result,
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'CLEANUP_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  /**
   * Clean Go cache
   */
  async cleanGoCache(request: FastifyRequest, reply: FastifyReply) {
    try {
      const result = await optimizationService.cleanGoCache();

      return reply.send({
        success: result.success,
        data: result,
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'CLEANUP_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  /**
   * Run full cleanup (async - returns job ID immediately)
   */
  async cleanAll(request: FastifyRequest, reply: FastifyReply) {
    try {
      const jobId = optimizationService.startFullCleanupAsync();

      return reply.send({
        success: true,
        data: {
          jobId,
          message: 'Pulizia avviata in background',
          statusUrl: `/api/optimization/clean-all/status/${jobId}`,
        },
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'CLEANUP_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  /**
   * Get cleanup job status
   */
  async getCleanupStatus(request: FastifyRequest<{ Params: { jobId: string } }>, reply: FastifyReply) {
    try {
      const { jobId } = request.params;
      const job = optimizationService.getCleanupJobStatus(jobId);

      if (!job) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'JOB_NOT_FOUND',
            message: 'Job non trovato o scaduto',
          },
        });
      }

      return reply.send({
        success: true,
        data: job,
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'STATUS_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }
}

export const optimizationController = new OptimizationController();
