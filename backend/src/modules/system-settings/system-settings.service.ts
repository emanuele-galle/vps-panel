
import { prisma } from '../../services/prisma.service';


export interface SystemSettingData {
  key: string;
  value: string;
  description?: string;
  category?: string;
  isSecret?: boolean;
}

export interface UpdateSystemSettingData {
  value: string;
  description?: string;
  category?: string;
  isSecret?: boolean;
}

class SystemSettingsService {
  // Get all system settings
  async getAllSettings() {
    return await prisma.systemSetting.findMany({
      orderBy: [
        { category: 'asc' },
        { key: 'asc' },
      ],
    });
  }

  // Get settings by category
  async getSettingsByCategory(category: string) {
    return await prisma.systemSetting.findMany({
      where: { category },
      orderBy: { key: 'asc' },
    });
  }

  // Get single setting by key
  async getSettingByKey(key: string) {
    return await prisma.systemSetting.findUnique({
      where: { key },
    });
  }

  // Get setting value (returns null if not found)
  async getSettingValue(key: string): Promise<string | null> {
    const setting = await this.getSettingByKey(key);
    return setting?.value || null;
  }

  // Create or update setting
  async upsertSetting(data: SystemSettingData) {
    return await prisma.systemSetting.upsert({
      where: { key: data.key },
      update: {
        value: data.value,
        description: data.description,
        category: data.category,
        isSecret: data.isSecret,
        updatedAt: new Date(),
      },
      create: {
        key: data.key,
        value: data.value,
        description: data.description,
        category: data.category || 'general',
        isSecret: data.isSecret || false,
      },
    });
  }

  // Update existing setting
  async updateSetting(key: string, data: UpdateSystemSettingData) {
    const existing = await this.getSettingByKey(key);
    if (!existing) {
      throw new Error('Setting not found');
    }

    return await prisma.systemSetting.update({
      where: { key },
      data: {
        value: data.value,
        description: data.description,
        category: data.category,
        isSecret: data.isSecret,
        updatedAt: new Date(),
      },
    });
  }

  // Delete setting
  async deleteSetting(key: string) {
    const existing = await this.getSettingByKey(key);
    if (!existing) {
      throw new Error('Setting not found');
    }

    return await prisma.systemSetting.delete({
      where: { key },
    });
  }

  // Initialize default settings if they don't exist
  async initializeDefaultSettings() {
    const defaults: SystemSettingData[] = [
      // Traefik Settings
      {
        key: 'traefik.acme_email',
        value: '',
        description: 'Email for Let\'s Encrypt SSL certificates',
        category: 'traefik',
        isSecret: false,
      },
      {
        key: 'traefik.dashboard_enabled',
        value: 'true',
        description: 'Enable Traefik dashboard',
        category: 'traefik',
        isSecret: false,
      },

      // API Keys
      {
        key: 'api.hostinger_key',
        value: '',
        description: 'Hostinger API key for email management',
        category: 'api_keys',
        isSecret: true,
      },
      {
        key: 'api.cloudflare_token',
        value: '',
        description: 'Cloudflare API token for DNS management',
        category: 'api_keys',
        isSecret: true,
      },

      // Default Resource Limits
      {
        key: 'limits.default_memory',
        value: '512m',
        description: 'Default memory limit for containers',
        category: 'limits',
        isSecret: false,
      },
      {
        key: 'limits.default_cpu',
        value: '1',
        description: 'Default CPU limit for containers',
        category: 'limits',
        isSecret: false,
      },
      {
        key: 'limits.default_storage',
        value: '10g',
        description: 'Default storage limit for projects',
        category: 'limits',
        isSecret: false,
      },
      {
        key: 'limits.max_projects_per_user',
        value: '10',
        description: 'Maximum projects per user',
        category: 'limits',
        isSecret: false,
      },

      // SMTP Settings
      {
        key: 'smtp.host',
        value: '',
        description: 'SMTP server hostname',
        category: 'smtp',
        isSecret: false,
      },
      {
        key: 'smtp.port',
        value: '587',
        description: 'SMTP server port',
        category: 'smtp',
        isSecret: false,
      },
      {
        key: 'smtp.username',
        value: '',
        description: 'SMTP authentication username',
        category: 'smtp',
        isSecret: false,
      },
      {
        key: 'smtp.password',
        value: '',
        description: 'SMTP authentication password',
        category: 'smtp',
        isSecret: true,
      },
      {
        key: 'smtp.from_email',
        value: '',
        description: 'Default sender email address',
        category: 'smtp',
        isSecret: false,
      },
      {
        key: 'smtp.from_name',
        value: 'VPS Panel',
        description: 'Default sender name',
        category: 'smtp',
        isSecret: false,
      },

      // Backup Settings
      {
        key: 'backup.enabled',
        value: 'false',
        description: 'Enable automatic backups',
        category: 'backup',
        isSecret: false,
      },
      {
        key: 'backup.schedule',
        value: '0 2 * * *',
        description: 'Backup schedule (cron format)',
        category: 'backup',
        isSecret: false,
      },
      {
        key: 'backup.retention_days',
        value: '30',
        description: 'Number of days to keep backups',
        category: 'backup',
        isSecret: false,
      },
      {
        key: 'backup.storage_path',
        value: '/var/backups/vps-panel',
        description: 'Local backup storage path',
        category: 'backup',
        isSecret: false,
      },

      // System Settings
      {
        key: 'system.maintenance_mode',
        value: 'false',
        description: 'Enable maintenance mode',
        category: 'system',
        isSecret: false,
      },
      {
        key: 'system.log_retention_days',
        value: '90',
        description: 'Number of days to keep activity logs',
        category: 'system',
        isSecret: false,
      },
      {
        key: 'system.session_timeout',
        value: '3600',
        description: 'Session timeout in seconds',
        category: 'system',
        isSecret: false,
      },

      // Maintenance Settings
      {
        key: 'maintenance.enabled',
        value: 'true',
        description: 'Enable automatic maintenance',
        category: 'maintenance',
        isSecret: false,
      },
      {
        key: 'maintenance.schedule',
        value: '0 3 * * 0',
        description: 'Maintenance schedule (cron format) - Default: Sunday 3:00 AM',
        category: 'maintenance',
        isSecret: false,
      },
      {
        key: 'maintenance.n8n_retention_days',
        value: '7',
        description: 'Days to keep N8N execution history',
        category: 'maintenance',
        isSecret: false,
      },
      {
        key: 'maintenance.docker_prune_images',
        value: 'true',
        description: 'Prune unused Docker images',
        category: 'maintenance',
        isSecret: false,
      },
      {
        key: 'maintenance.docker_prune_volumes',
        value: 'false',
        description: 'Prune dangling Docker volumes (caution!)',
        category: 'maintenance',
        isSecret: false,
      },
      {
        key: 'maintenance.journal_max_size',
        value: '100',
        description: 'Max systemd journal size in MB',
        category: 'maintenance',
        isSecret: false,
      },
      {
        key: 'maintenance.container_log_max_size',
        value: '50',
        description: 'Max container log size in MB before truncation',
        category: 'maintenance',
        isSecret: false,
      },
    ];

    const results = [];
    for (const setting of defaults) {
      const existing = await this.getSettingByKey(setting.key);
      if (!existing) {
        const created = await this.upsertSetting(setting);
        results.push(created);
      }
    }

    return results;
  }

  // Get settings grouped by category
  async getSettingsGrouped() {
    const settings = await this.getAllSettings();

    const grouped: Record<string, unknown[]> = {};
    for (const setting of settings) {
      const category = setting.category || 'general';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(setting);
    }

    return grouped;
  }

  // Bulk update settings
  async bulkUpdateSettings(settings: { key: string; value: string }[]) {
    const results = [];
    for (const setting of settings) {
      const updated = await this.updateSetting(setting.key, { value: setting.value });
      results.push(updated);
    }
    return results;
  }
}

export const systemSettingsService = new SystemSettingsService();
