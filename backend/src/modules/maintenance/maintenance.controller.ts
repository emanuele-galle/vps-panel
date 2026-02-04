import { FastifyRequest, FastifyReply } from 'fastify';
import { maintenanceService } from './maintenance.service';
import { maintenanceSchedulerService } from './maintenance.scheduler';

export const maintenanceController = {
  // GET /api/maintenance/status
  async getStatus(request: FastifyRequest, reply: FastifyReply) {
    try {
      const status = await maintenanceService.getMaintenanceStatus();
      return reply.send({
        success: true,
        data: {
          ...status,
          schedulerRunning: maintenanceSchedulerService.isRunning(),
          currentSchedule: maintenanceSchedulerService.getSchedule(),
        },
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Errore sconosciuto',
      });
    }
  },

  // POST /api/maintenance/run
  async runFullMaintenance(request: FastifyRequest, reply: FastifyReply) {
    try {
      const report = await maintenanceService.runFullMaintenance();
      return reply.send({
        success: true,
        data: report,
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Errore sconosciuto',
      });
    }
  },

  // POST /api/maintenance/run/:taskId
  async runSingleTask(
    request: FastifyRequest<{ Params: { taskId: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { taskId } = request.params;
      const result = await maintenanceService.runSingleTask(taskId);
      return reply.send({
        success: true,
        data: result,
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Errore sconosciuto',
      });
    }
  },

  // GET /api/maintenance/report
  async getLastReport(request: FastifyRequest, reply: FastifyReply) {
    try {
      const report = maintenanceService.getLastReport();
      return reply.send({
        success: true,
        data: report,
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Errore sconosciuto',
      });
    }
  },

  // POST /api/maintenance/scheduler/start
  async startScheduler(request: FastifyRequest, reply: FastifyReply) {
    try {
      await maintenanceSchedulerService.start();
      return reply.send({
        success: true,
        message: 'Scheduler avviato',
        running: maintenanceSchedulerService.isRunning(),
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Errore sconosciuto',
      });
    }
  },

  // POST /api/maintenance/scheduler/stop
  async stopScheduler(request: FastifyRequest, reply: FastifyReply) {
    try {
      maintenanceSchedulerService.stop();
      return reply.send({
        success: true,
        message: 'Scheduler fermato',
        running: maintenanceSchedulerService.isRunning(),
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Errore sconosciuto',
      });
    }
  },

  // POST /api/maintenance/scheduler/restart
  async restartScheduler(request: FastifyRequest, reply: FastifyReply) {
    try {
      await maintenanceSchedulerService.restart();
      return reply.send({
        success: true,
        message: 'Scheduler riavviato',
        running: maintenanceSchedulerService.isRunning(),
        schedule: maintenanceSchedulerService.getSchedule(),
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Errore sconosciuto',
      });
    }
  },
};
