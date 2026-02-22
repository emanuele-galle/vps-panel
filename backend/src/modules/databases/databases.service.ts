import { Database, DatabaseType, UserRole } from '@prisma/client';
import { prisma } from '../../services/prisma.service';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs/promises';
import { dockerService } from '../docker/docker.service';
import { AppError } from '../../utils/errors';
import { encryptionService } from '../../services/encryption.service';
import log from '../../services/logger.service';


class DatabasesService {

  /**
   * Get accessible project IDs for a user (same logic as projects service)
   */
  private async getAccessibleProjectIds(userId: string, userRole: UserRole): Promise<string[] | null> {
    if (userRole === 'ADMIN') return null;

    const [ownedProjects, memberProjects] = await Promise.all([
      prisma.project.findMany({
        where: { userId },
        select: { id: true }
      }),
      prisma.projectMember.findMany({
        where: { userId },
        select: { projectId: true }
      })
    ]);

    const ids = new Set<string>();
    ownedProjects.forEach(p => ids.add(p.id));
    memberProjects.forEach(m => ids.add(m.projectId));

    return Array.from(ids);
  }

  /**
   * Get all databases with optional filters (filtered by user access)
   */
  async getDatabases(filters?: {
    projectId?: string;
    type?: DatabaseType;
  }, userId?: string, userRole?: UserRole): Promise<Database[]> {
    try {
      const where: any = {};

      if (filters?.projectId) {
        where.projectId = filters.projectId;
      }

      if (filters?.type) {
        where.type = filters.type;
      }

      // Filter by accessible projects for STAFF users
      if (userId && userRole && userRole !== 'ADMIN') {
        const accessibleIds = await this.getAccessibleProjectIds(userId, userRole);
        if (accessibleIds !== null) {
          if (filters?.projectId) {
            // Verify the requested project is accessible
            if (!accessibleIds.includes(filters.projectId)) {
              return [];
            }
          } else {
            where.projectId = { in: accessibleIds };
          }
        }
      }

      const databases = await prisma.database.findMany({
        where,
        include: {
          project: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      // Decrypt passwords for display
      return databases.map((db) => ({
        ...db,
        password: '••••••••', // Masked in list - use getConnectionString for actual password
      }));
    } catch (error) {
      throw new AppError(500, `Failed to fetch databases: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get database by ID
   */
  async getDatabaseById(id: string): Promise<Database | null> {
    try {
      const database = await prisma.database.findUnique({
        where: { id },
        include: {
          project: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      });

      if (!database) return null;

      // Decrypt password
      return {
        ...database,
        password: this.decryptPassword(database.password),
      };
    } catch (error) {
      throw new AppError(500, `Failed to fetch database: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create new database
   */
  async createDatabase(data: {
    name: string;
    type: DatabaseType;
    projectId: string;
    username?: string;
    password?: string;
  }): Promise<Database> {
    try {
      // Check if project exists
      const project = await prisma.project.findUnique({
        where: { id: data.projectId },
      });

      if (!project) {
        throw new AppError(404, 'Project not found');
      }

      // Generate credentials if not provided
      const username = data.username || `db_${data.name.replace(/[^a-z0-9]/gi, '_')}`;
      const password = data.password || this.generatePassword();
      const databaseName = data.name.replace(/[^a-z0-9]/gi, '_');

      // Get available port
      const port = await dockerService.getAvailablePort(
        this.getDefaultPort(data.type)
      );

      // Create database container
      const containerConfig = this.getContainerConfig(
        data.type,
        databaseName,
        username,
        password,
        port,
        project.slug
      );

      // Write docker-compose file for database
      const dbPath = path.join(
        '/var/www/projects',
        project.slug,
        'databases',
        databaseName
      );
      await fs.mkdir(dbPath, { recursive: true });

      const composePath = path.join(dbPath, 'docker-compose.yml');
      await fs.writeFile(composePath, containerConfig);

      // Start database container
      await dockerService.composeUp(dbPath);

      // Create database record
      const database = await prisma.database.create({
        data: {
          name: data.name,
          type: data.type,
          projectId: data.projectId,
          host: 'localhost',
          port,
          username,
          password: encryptionService.encrypt(password),
          databaseName,
        },
        include: {
          project: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      });

      // Return with decrypted password
      return {
        ...database,
        password: this.decryptPassword(database.password),
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(500, `Failed to create database: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update database password
   */
  async updateDatabase(
    id: string,
    data: {
      password?: string;
    }
  ): Promise<Database> {
    try {
      const database = await prisma.database.findUnique({
        where: { id },
        include: {
          project: {
            select: { slug: true },
          },
        },
      });

      if (!database) {
        throw new AppError(404, 'Database not found');
      }

      const updateData: any = {};

      if (data.password) {
        // Get old password for container update (needed for auth)
        const oldPassword = this.decryptPassword(database.password);

        updateData.password = encryptionService.encrypt(data.password);

        // Update password in running container
        try {
          await this.updateContainerPassword(database, oldPassword, data.password);
        } catch (containerError) {
          log.warn(
            { databaseId: id, type: database.type },
            `Failed to update password in container: ${containerError instanceof Error ? containerError.message : 'Unknown error'}`
          );
          // Continue anyway - the panel record will be updated
        }
      }

      const updatedDatabase = await prisma.database.update({
        where: { id },
        data: updateData,
        include: {
          project: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      });

      return {
        ...updatedDatabase,
        password: this.decryptPassword(updatedDatabase.password),
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(500, `Failed to update database: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete database
   */
  async deleteDatabase(id: string): Promise<void> {
    try {
      const database = await prisma.database.findUnique({
        where: { id },
        include: {
          project: true,
        },
      });

      if (!database) {
        throw new AppError(404, 'Database not found');
      }

      // Stop and remove database container
      const dbPath = path.join(
        '/var/www/projects',
        database.project.slug,
        'databases',
        database.databaseName
      );

      try {
        await dockerService.composeDown(dbPath);
        // Remove database directory
        await fs.rm(dbPath, { recursive: true, force: true });
      } catch (error) {
        log.error('Failed to remove database container:', error instanceof Error ? error.message : 'Unknown error');
      }

      // Delete database record
      await prisma.database.delete({
        where: { id },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(500, `Failed to delete database: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update password in running database container
   */
  private async updateContainerPassword(
    database: Database & { project: { slug: string } },
    oldPassword: string,
    newPassword: string
  ): Promise<void> {
    const containerName = `${database.project.slug}_${database.databaseName}`;

    // Escape single quotes in passwords for shell safety
    const escapeShell = (str: string) => str.replace(/'/g, "'\\''");
    const escapedNew = escapeShell(newPassword);
    const escapedOld = escapeShell(oldPassword);
    const escapedUser = escapeShell(database.username);

    let command: string;

    switch (database.type) {
      case 'POSTGRESQL':
        command = `docker exec ${containerName} psql -U ${escapedUser} -c "ALTER USER \\"${escapedUser}\\" WITH PASSWORD '${escapedNew}'"`;
        break;
      case 'MYSQL':
        command = `docker exec ${containerName} mysql -u root -p'${escapedOld}' -e "ALTER USER '${escapedUser}'@'%' IDENTIFIED BY '${escapedNew}'; FLUSH PRIVILEGES;"`;
        break;
      case 'MONGODB':
        command = `docker exec ${containerName} mongosh admin -u '${escapedUser}' -p '${escapedOld}' --eval "db.changeUserPassword('${escapedUser}', '${escapedNew}')"`;
        break;
      case 'REDIS':
        command = `docker exec ${containerName} redis-cli -a '${escapedOld}' CONFIG SET requirepass '${escapedNew}'`;
        break;
      case 'SQLITE':
        return; // No container for SQLite
      default:
        log.warn({ type: database.type }, 'Unsupported database type for container password update');
        return;
    }

    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    await execAsync(command, { timeout: 15000 });
    log.info({ databaseId: database.id, type: database.type }, 'Container password updated successfully');
  }

  /**
   * Get database connection string
   */
  getConnectionString(database: Database): string {
    const password = this.decryptPassword(database.password);

    switch (database.type) {
      case 'MYSQL':
        return `mysql://${database.username}:${password}@${database.host}:${database.port}/${database.databaseName}`;
      case 'POSTGRESQL':
        return `postgresql://${database.username}:${password}@${database.host}:${database.port}/${database.databaseName}`;
      case 'MONGODB':
        return `mongodb://${database.username}:${password}@${database.host}:${database.port}/${database.databaseName}`;
      case 'REDIS':
        return `redis://:${password}@${database.host}:${database.port}`;
      case 'SQLITE':
        return `file:${database.databaseName}.db`;
      default:
        return '';
    }
  }

  /**
   * Generate docker-compose configuration for database
   */
  private getContainerConfig(
    type: DatabaseType,
    name: string,
    username: string,
    password: string,
    port: number,
    projectSlug: string
  ): string {
    const configs: Record<DatabaseType, string> = {
      MYSQL: `version: '3.8'

services:
  mysql:
    image: mysql:8.0
    container_name: ${projectSlug}_${name}
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: ${password}
      MYSQL_DATABASE: ${name}
      MYSQL_USER: ${username}
      MYSQL_PASSWORD: ${password}
    ports:
      - "${port}:3306"
    volumes:
      - mysql_data:/var/lib/mysql
    networks:
      - db_network

volumes:
  mysql_data:

networks:
  db_network:
    driver: bridge
`,
      POSTGRESQL: `version: '3.8'

services:
  postgres:
    image: postgres:15
    container_name: ${projectSlug}_${name}
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${name}
      POSTGRES_USER: ${username}
      POSTGRES_PASSWORD: ${password}
    ports:
      - "${port}:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - db_network

volumes:
  postgres_data:

networks:
  db_network:
    driver: bridge
`,
      MONGODB: `version: '3.8'

services:
  mongodb:
    image: mongo:6
    container_name: ${projectSlug}_${name}
    restart: unless-stopped
    environment:
      MONGO_INITDB_ROOT_USERNAME: ${username}
      MONGO_INITDB_ROOT_PASSWORD: ${password}
      MONGO_INITDB_DATABASE: ${name}
    ports:
      - "${port}:27017"
    volumes:
      - mongodb_data:/data/db
    networks:
      - db_network

volumes:
  mongodb_data:

networks:
  db_network:
    driver: bridge
`,
      REDIS: `version: '3.8'

services:
  redis:
    image: redis:7-alpine
    container_name: ${projectSlug}_${name}
    restart: unless-stopped
    command: redis-server --requirepass ${password}
    ports:
      - "${port}:6379"
    volumes:
      - redis_data:/data
    networks:
      - db_network

volumes:
  redis_data:

networks:
  db_network:
    driver: bridge
`,
      SQLITE: `# SQLite runs in-process, no container needed`,
    };

    return configs[type] || '';
  }

  /**
   * Get default port for database type
   */
  private getDefaultPort(type: DatabaseType): number {
    const ports: Record<DatabaseType, number> = {
      MYSQL: 3306,
      POSTGRESQL: 5432,
      MONGODB: 27017,
      REDIS: 6379,
      SQLITE: 0,
    };

    return ports[type] || 3306;
  }

  /**
   * Generate random password
   */
  private generatePassword(length: number = 16): string {
    const charset =
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';

    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * charset.length);
      password += charset[randomIndex];
    }

    return password;
  }

  /**
   * Decrypt password with migration support
   *
   * Handles both old format (hex iv:ciphertext with CBC) and
   * new format (base64 with GCM) for backward compatibility.
   * New encryptions always use the new GCM format.
   */
  private decryptPassword(encryptedValue: string): string {
    // If value is empty, return as-is
    if (!encryptedValue) return encryptedValue;

    // Check if the value looks encrypted (base64 with minimum GCM length)
    if (!encryptionService.isEncrypted(encryptedValue)) {
      // Not encrypted - return as plaintext (likely from manual entry or migration)
      return encryptedValue;
    }

    try {
      // Check if it's old format (contains colon and looks like hex)
      if (encryptedValue.includes(':') && /^[a-f0-9]+:[a-f0-9]+$/i.test(encryptedValue)) {
        // Old CBC format - decrypt and return (data stays as-is until re-saved)
        return this.decryptLegacyCBC(encryptedValue);
      }

      // New GCM format
      return encryptionService.decrypt(encryptedValue);
    } catch (error) {
      log.warn({ password_length: encryptedValue.length }, 'Failed to decrypt database password - returning as-is');
      // Return original if decryption fails
      return encryptedValue;
    }
  }

  /**
   * Decrypt legacy CBC format
   * Used for backward compatibility with passwords encrypted before migration
   *
   * @deprecated Will be removed after all passwords are migrated
   */
  private decryptLegacyCBC(text: string): string {
    // Use old key derivation (first 32 chars of JWT_SECRET)
    const { config } = require('../../config/env');
    const oldKey = Buffer.from(config.JWT_SECRET.substring(0, 32));

    const parts = text.split(':');
    const iv = Buffer.from(parts.shift()!, 'hex');
    const encryptedText = Buffer.from(parts.join(':'), 'hex');

    const decipher = crypto.createDecipheriv('aes-256-cbc', oldKey, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString();
  }
}

export const databasesService = new DatabasesService();
