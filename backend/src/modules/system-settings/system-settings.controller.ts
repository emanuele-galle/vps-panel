import { FastifyRequest, FastifyReply } from 'fastify';
import type { JwtPayload } from '../../utils/types';
import { z } from 'zod';
import { systemSettingsService } from './system-settings.service';
import { logActivity } from '../activity/activity.service';

// ============================================
// VALIDATION SCHEMAS
// ============================================

const categoryParamsSchema = z.object({
  category: z.string().min(1).max(100).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'Invalid category format'),
});

const keyParamsSchema = z.object({
  key: z.string().min(1).max(100).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'Invalid key format'),
});

const updateSettingSchema = z.object({
  value: z.string().max(10000),
  description: z.string().max(500).optional(),
  category: z.string().max(100).optional(),
  isSecret: z.boolean().optional(),
});

const upsertSettingSchema = z.object({
  key: z.string().min(1).max(100).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'Invalid key format'),
  value: z.string().max(10000),
  description: z.string().max(500).optional(),
  category: z.string().max(100).optional(),
  isSecret: z.boolean().optional(),
});

const bulkUpdateSchema = z.object({
  settings: z.array(
    z.object({
      key: z.string().min(1).max(100),
      value: z.string().max(10000),
    })
  ).min(1).max(100),
});

// ============================================
// CONTROLLER
// ============================================

class SystemSettingsController {
  // Get all settings
  async getAllSettings(request: FastifyRequest, reply: FastifyReply) {
    try {
      const settings = await systemSettingsService.getAllSettings();

      // Mask secret values
      const maskedSettings = settings.map(setting => ({
        ...setting,
        value: setting.isSecret ? '********' : setting.value,
      }));

      await logActivity({
        userId: (request.user as JwtPayload)?.userId,
        action: 'VIEW',
        resource: 'system_settings',
        description: 'Viewed system settings',
        status: 'SUCCESS',
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      });

      reply.send({
        success: true,
        data: maskedSettings,
      });
    } catch (error) {
      request.log.error(error);
      reply.code(500).send({
        success: false,
        error: 'Failed to fetch system settings',
      });
    }
  }

  // Get settings grouped by category
  async getSettingsGrouped(request: FastifyRequest, reply: FastifyReply) {
    try {
      const grouped = await systemSettingsService.getSettingsGrouped();

      // Mask secret values
      const maskedGrouped: Record<string, Array<{ key: string; value: string; isSecret: boolean; category?: string }>> = {};
      for (const [category, settings] of Object.entries(grouped) as [string, Array<{ key: string; value: string; isSecret: boolean; category?: string }>][]) {
        maskedGrouped[category] = settings.map((setting) => ({
          ...setting,
          value: setting.isSecret ? '********' : setting.value,
        }));
      }

      reply.send({
        success: true,
        data: maskedGrouped,
      });
    } catch (error) {
      request.log.error(error);
      reply.code(500).send({
        success: false,
        error: 'Failed to fetch grouped settings',
      });
    }
  }

  // Get settings by category
  async getSettingsByCategory(
    request: FastifyRequest<{
      Params: { category: string };
    }>,
    reply: FastifyReply
  ) {
    try {
      // Validate params
      const params = categoryParamsSchema.parse(request.params);
      const settings = await systemSettingsService.getSettingsByCategory(params.category);

      // Mask secret values
      const maskedSettings = settings.map(setting => ({
        ...setting,
        value: setting.isSecret ? '********' : setting.value,
      }));

      reply.send({
        success: true,
        data: maskedSettings,
      });
    } catch (error) {
      request.log.error(error);
      reply.code(500).send({
        success: false,
        error: 'Failed to fetch settings by category',
      });
    }
  }

  // Get single setting
  async getSettingByKey(
    request: FastifyRequest<{
      Params: { key: string };
    }>,
    reply: FastifyReply
  ) {
    try {
      // Validate params
      const params = keyParamsSchema.parse(request.params);
      const setting = await systemSettingsService.getSettingByKey(params.key);

      if (!setting) {
        reply.code(404).send({
          success: false,
          error: 'Setting not found',
        });
        return;
      }

      // Mask secret value
      const maskedSetting = {
        ...setting,
        value: setting.isSecret ? '********' : setting.value,
      };

      reply.send({
        success: true,
        data: maskedSetting,
      });
    } catch (error) {
      request.log.error(error);
      reply.code(500).send({
        success: false,
        error: 'Failed to fetch setting',
      });
    }
  }

  // Update setting
  async updateSetting(
    request: FastifyRequest<{
      Params: { key: string };
      Body: {
        value: string;
        description?: string;
        category?: string;
        isSecret?: boolean;
      };
    }>,
    reply: FastifyReply
  ) {
    try {
      // Validate params and body
      const params = keyParamsSchema.parse(request.params);
      const data = updateSettingSchema.parse(request.body);

      const updated = await systemSettingsService.updateSetting(params.key, data as { value: string; description?: string; category?: string; isSecret?: boolean });

      await logActivity({
        userId: (request.user as JwtPayload)?.userId,
        action: 'UPDATE',
        resource: 'system_settings',
        resourceId: updated.id,
        description: `Updated system setting: ${params.key}`,
        metadata: { key: params.key, ...(updated.category && { category: updated.category }) },
        status: 'SUCCESS',
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      });

      // Mask secret value in response
      const maskedSetting = {
        ...updated,
        value: updated.isSecret ? '********' : updated.value,
      };

      reply.send({
        success: true,
        message: 'Setting updated successfully',
        data: maskedSetting,
      });
    } catch (error) {
      request.log.error(error);

      await logActivity({
        userId: (request.user as JwtPayload)?.userId,
        action: 'UPDATE',
        resource: 'system_settings',
        description: `Failed to update system setting: ${request.params.key}`,
        status: 'ERROR',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      });

      reply.code(400).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update setting',
      });
    }
  }

  // Create or update setting (upsert)
  async upsertSetting(
    request: FastifyRequest<{
      Body: {
        key: string;
        value: string;
        description?: string;
        category?: string;
        isSecret?: boolean;
      };
    }>,
    reply: FastifyReply
  ) {
    try {
      // Validate body
      const data = upsertSettingSchema.parse(request.body);
      const setting = await systemSettingsService.upsertSetting(data as { key: string; value: string; description?: string; category?: string; isSecret?: boolean });

      await logActivity({
        userId: (request.user as JwtPayload)?.userId,
        action: 'UPSERT',
        resource: 'system_settings',
        resourceId: setting.id,
        description: `Created/Updated system setting: ${data.key}`,
        metadata: { key: data.key, ...(data.category && { category: data.category }) },
        status: 'SUCCESS',
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      });

      // Mask secret value in response
      const maskedSetting = {
        ...setting,
        value: setting.isSecret ? '********' : setting.value,
      };

      reply.send({
        success: true,
        message: 'Setting saved successfully',
        data: maskedSetting,
      });
    } catch (error) {
      request.log.error(error);
      reply.code(400).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save setting',
      });
    }
  }

  // Bulk update settings
  async bulkUpdateSettings(
    request: FastifyRequest<{
      Body: {
        settings: { key: string; value: string }[];
      };
    }>,
    reply: FastifyReply
  ) {
    try {
      // Validate body
      const body = bulkUpdateSchema.parse(request.body);

      const updated = await systemSettingsService.bulkUpdateSettings(body.settings as { key: string; value: string }[]);

      await logActivity({
        userId: (request.user as JwtPayload)?.userId,
        action: 'BULK_UPDATE',
        resource: 'system_settings',
        description: `Bulk updated ${body.settings.length} system settings`,
        metadata: { count: body.settings.length, keys: body.settings.map(s => s.key) },
        status: 'SUCCESS',
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      });

      reply.send({
        success: true,
        message: `${updated.length} settings updated successfully`,
        data: updated.map(s => ({
          ...s,
          value: s.isSecret ? '********' : s.value,
        })),
      });
    } catch (error) {
      request.log.error(error);

      await logActivity({
        userId: (request.user as JwtPayload)?.userId,
        action: 'BULK_UPDATE',
        resource: 'system_settings',
        description: 'Failed to bulk update system settings',
        status: 'ERROR',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      });

      reply.code(400).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update settings',
      });
    }
  }

  // Delete setting
  async deleteSetting(
    request: FastifyRequest<{
      Params: { key: string };
    }>,
    reply: FastifyReply
  ) {
    try {
      // Validate params
      const params = keyParamsSchema.parse(request.params);
      await systemSettingsService.deleteSetting(params.key);

      await logActivity({
        userId: (request.user as JwtPayload)?.userId,
        action: 'DELETE',
        resource: 'system_settings',
        description: `Deleted system setting: ${params.key}`,
        metadata: { key: params.key },
        status: 'SUCCESS',
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      });

      reply.send({
        success: true,
        message: 'Setting deleted successfully',
      });
    } catch (error) {
      request.log.error(error);
      reply.code(400).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete setting',
      });
    }
  }

  // Initialize default settings
  async initializeDefaults(request: FastifyRequest, reply: FastifyReply) {
    try {
      const created = await systemSettingsService.initializeDefaultSettings();

      await logActivity({
        userId: (request.user as JwtPayload)?.userId,
        action: 'INITIALIZE',
        resource: 'system_settings',
        description: `Initialized ${created.length} default system settings`,
        metadata: { count: created.length },
        status: 'SUCCESS',
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      });

      reply.send({
        success: true,
        message: `${created.length} default settings initialized`,
        data: created.map(s => ({
          ...s,
          value: s.isSecret ? '********' : s.value,
        })),
      });
    } catch (error) {
      request.log.error(error);
      reply.code(500).send({
        success: false,
        error: 'Failed to initialize default settings',
      });
    }
  }
}

export const systemSettingsController = new SystemSettingsController();
