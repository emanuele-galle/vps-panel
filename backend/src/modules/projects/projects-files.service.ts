import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { UserRole } from '@prisma/client';
import { NotFoundError } from '../../utils/errors';
import { safeDu, validatePath } from '../../utils/shell-sanitizer';
import { monitoringService } from '../monitoring/monitoring.service';

type GetProjectByIdFn = (projectId: string, userId: string, userRole?: UserRole) => Promise<any>;

export class ProjectsFilesService {
  constructor(
    private readonly getProjectById: GetProjectByIdFn
  ) {}

  // ==========================================
  // TEMPORARY FILES MANAGEMENT
  // ==========================================

  /**
   * Get temp uploads directory for a project
   */
  private getTempUploadsDir(projectPath: string): string {
    return path.join(projectPath, 'temp-uploads');
  }

  /**
   * List temporary files for a project
   */
  async getTempFiles(projectId: string, userId: string) {
    const project = await this.getProjectById(projectId, userId);
    const tempDir = this.getTempUploadsDir(project.path);

    try {
      await fs.access(tempDir);
    } catch {
      // Directory doesn't exist, return empty array
      return [];
    }

    const files = await fs.readdir(tempDir, { withFileTypes: true });
    const fileInfos = await Promise.all(
      files
        .filter((f) => f.isFile())
        .map(async (f) => {
          const filePath = path.join(tempDir, f.name);
          const stats = await fs.stat(filePath);
          return {
            name: f.name,
            size: stats.size,
            modified: stats.mtime,
          };
        })
    );

    return fileInfos;
  }

  /**
   * Upload a temporary file
   */
  async uploadTempFile(projectId: string, userId: string, part: any): Promise<string> {
    const project = await this.getProjectById(projectId, userId);
    const tempDir = this.getTempUploadsDir(project.path);

    // Ensure temp directory exists
    await fs.mkdir(tempDir, { recursive: true });

    // Sanitize filename
    const sanitizedFilename = part.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = path.join(tempDir, sanitizedFilename);

    // Write file
    const buffer = await part.toBuffer();
    await fs.writeFile(filePath, buffer);

    return sanitizedFilename;
  }

  /**
   * Delete a specific temporary file
   */
  async deleteTempFile(projectId: string, userId: string, filename: string) {
    const project = await this.getProjectById(projectId, userId);
    const tempDir = this.getTempUploadsDir(project.path);
    const filePath = path.join(tempDir, filename);

    // Security: ensure the file is within the temp directory
    const normalizedPath = path.normalize(filePath);
    if (!normalizedPath.startsWith(tempDir)) {
      throw new Error('Invalid file path');
    }

    try {
      await fs.unlink(filePath);
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Clear all temporary files for a project
   */
  async clearTempFiles(projectId: string, userId: string) {
    const project = await this.getProjectById(projectId, userId);
    const tempDir = this.getTempUploadsDir(project.path);

    try {
      await fs.rm(tempDir, { recursive: true, force: true });
      await fs.mkdir(tempDir, { recursive: true });
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  // ==========================================
  // PROJECT SIZE CALCULATION
  // ==========================================

  /**
   * Format bytes to human readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get project size (folder + containers + databases)
   */
  async getProjectSize(projectId: string, userId: string, userRole: UserRole) {
    const project = await this.getProjectById(projectId, userId, userRole);

    // Calculate folder size
    let folderSize = 0;
    try {
      if (project.path && validatePath(project.path)) {
        folderSize = await safeDu(project.path);
      }
    } catch (_error) {
      // Folder might not exist or be accessible
    }

    // Get container sizes from monitoring service
    let containersSize = 0;
    let containersCount = 0;
    try {
      const containersData = await monitoringService.getContainersStorageUsage();
      // Filter containers belonging to this project
      const projectContainers = containersData.containers.filter(
        (c: any) => c.projectSlug === project.slug ||
                   c.name?.startsWith(project.slug) ||
                   c.projectName?.toLowerCase().includes(project.name.toLowerCase())
      );
      containersSize = projectContainers.reduce((sum: number, c: { size?: number }) => sum + (c.size || 0), 0);
      containersCount = projectContainers.length;
    } catch (_error) {
      // Ignore errors
    }

    // Get database sizes
    let databasesSize = 0;
    let databasesCount = 0;
    try {
      const databasesData = await monitoringService.getDatabaseSizes();
      // Filter databases belonging to this project
      const projectDatabases = databasesData.databases.filter(
        (d: any) => d.projectSlug === project.slug
      );
      databasesSize = projectDatabases.reduce((sum: number, d: { size?: number }) => sum + (d.size || 0), 0);
      databasesCount = projectDatabases.length;
    } catch (_error) {
      // Ignore errors
    }

    const totalSize = folderSize + containersSize + databasesSize;

    return {
      folder: {
        size: folderSize,
        sizeFormatted: this.formatBytes(folderSize),
      },
      containers: {
        size: containersSize,
        sizeFormatted: this.formatBytes(containersSize),
        count: containersCount,
      },
      databases: {
        size: databasesSize,
        sizeFormatted: this.formatBytes(databasesSize),
        count: databasesCount,
      },
      total: {
        size: totalSize,
        sizeFormatted: this.formatBytes(totalSize),
      },
    };
  }

  // ==========================================
  // ENVIRONMENT VARIABLES MANAGEMENT
  // ==========================================

  /**
   * Get environment variables from project .env file
   */
  async getEnvVars(projectId: string, userId: string, userRole: UserRole): Promise<Array<{ key: string; value: string }>> {
    const project = await this.getProjectById(projectId, userId, userRole);

    if (!project.path) {
      return [];
    }

    const envPath = path.join(project.path, '.env');

    // Check if .env file exists
    if (!fsSync.existsSync(envPath)) {
      // Try .env.local or .env.production
      const altPaths = [
        path.join(project.path, '.env.local'),
        path.join(project.path, '.env.production'),
      ];
      for (const altPath of altPaths) {
        if (fsSync.existsSync(altPath)) {
          return this.parseEnvFile(altPath);
        }
      }
      return [];
    }

    return this.parseEnvFile(envPath);
  }

  /**
   * Parse .env file into array of key-value pairs
   */
  parseEnvFile(filePath: string): Array<{ key: string; value: string }> {
    try {
      const content = fsSync.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      const variables: Array<{ key: string; value: string }> = [];

      for (const line of lines) {
        const trimmed = line.trim();

        // Skip empty lines and comments
        if (!trimmed || trimmed.startsWith('#')) {
          continue;
        }

        // Parse key=value
        const equalsIndex = trimmed.indexOf('=');
        if (equalsIndex > 0) {
          const key = trimmed.substring(0, equalsIndex).trim();
          let value = trimmed.substring(equalsIndex + 1).trim();

          // Remove surrounding quotes if present
          if ((value.startsWith('"') && value.endsWith('"')) ||
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }

          variables.push({ key, value });
        }
      }

      return variables;
    } catch (_error) {
      return [];
    }
  }

  /**
   * Update environment variables in project .env file
   */
  async updateEnvVars(
    projectId: string,
    userId: string,
    userRole: UserRole,
    variables: Array<{ key: string; value: string }>
  ): Promise<{ updated: boolean; path: string }> {
    const project = await this.getProjectById(projectId, userId, userRole);

    if (!project.path) {
      throw new NotFoundError('Project path not configured');
    }

    const envPath = path.join(project.path, '.env');

    // Build .env content
    const content = variables
      .map(({ key, value }) => {
        // Quote values that contain spaces or special characters
        if (value.includes(' ') || value.includes('#') || value.includes('=')) {
          return `${key}="${value}"`;
        }
        return `${key}=${value}`;
      })
      .join('\n');

    // Write to .env file
    fsSync.writeFileSync(envPath, content + '\n', { mode: 0o600 });

    return {
      updated: true,
      path: envPath,
    };
  }
}
