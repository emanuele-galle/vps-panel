import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { filesService } from './files.service';
import { AppError } from '../../utils/errors';
import { UserRole } from '@prisma/client';
import path from 'path';

const listDirectorySchema = z.object({
  path: z.string().default(''),
});

const createDirectorySchema = z.object({
  path: z.string(),
  name: z.string().min(1).max(255),
});

const deleteItemSchema = z.object({
  path: z.string(),
});

const renameItemSchema = z.object({
  path: z.string(),
  newName: z.string().min(1).max(255),
});

const downloadFileSchema = z.object({
  path: z.string(),
});

export const filesController = {
  async listDirectory(
    request: FastifyRequest<{ Querystring: { path?: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const user = request.user as { userId: string; role: UserRole } | undefined;

      if (!user || !['ADMIN', 'STAFF'].includes(user.role)) {
        throw new AppError(403, 'Forbidden - Admin or Staff role required');
      }

      const { path: dirPath } = listDirectorySchema.parse(request.query);
      const listing = await filesService.listDirectory(dirPath, user.role);

      return reply.send({
        success: true,
        data: listing,
      });
    } catch (error) {
      console.error('Files controller error:', error);
      if (error instanceof AppError) {
        return reply.code(error.statusCode).send({
          success: false,
          error: error.message,
        });
      } else {
        return reply.code(500).send({
          success: false,
          error: 'Failed to list directory',
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  },

  async createDirectory(
    request: FastifyRequest<{ Body: { path: string; name: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const user = request.user as { userId: string; role: UserRole } | undefined;

      if (!user || !['ADMIN', 'STAFF'].includes(user.role)) {
        throw new AppError(403, 'Forbidden - Admin or Staff role required');
      }

      const { path: dirPath, name } = createDirectorySchema.parse(request.body);
      await filesService.createDirectory(dirPath, name, user.role);

      return reply.send({
        success: true,
        message: 'Directory created successfully',
      });
    } catch (error) {
      // Log error for debugging
      console.error('[files.controller] createDirectory error:', {
        error,
        errorType: error?.constructor?.name,
        message: error instanceof Error ? error.message : 'Unknown',
        code: (error as any)?.code,
        path: request.body?.path,
        name: request.body?.name,
      });
      
      if (error instanceof AppError) {
        return reply.code(error.statusCode).send({
          success: false,
          error: error.message,
        });
      } else {
        return reply.code(500).send({
          success: false,
          error: 'Failed to create directory',
        });
      }
    }
  },

  async deleteItem(
    request: FastifyRequest<{ Body: { path: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const user = request.user as { userId: string; role: UserRole } | undefined;

      if (!user || !['ADMIN', 'STAFF'].includes(user.role)) {
        throw new AppError(403, 'Forbidden - Admin or Staff role required');
      }

      const { path: itemPath } = deleteItemSchema.parse(request.body);
      
      // DEBUG LOG
      request.log.info({ itemPath, role: user.role }, 'DELETE request received');
      
      await filesService.deleteItem(itemPath, user.role);

      return reply.send({
        success: true,
        message: 'Item deleted successfully',
      });
    } catch (error) {
      // ENHANCED ERROR LOGGING
      request.log.error({ error, errorType: error?.constructor?.name, message: error instanceof Error ? error.message : 'Unknown' }, 'DELETE failed');
      
      if (error instanceof AppError) {
        return reply.code(error.statusCode).send({
          success: false,
          error: error.message,
        });
      } else {
        return reply.code(500).send({
          success: false,
          error: 'Failed to delete item',
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  },

  async renameItem(
    request: FastifyRequest<{ Body: { path: string; newName: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const user = request.user as { userId: string; role: UserRole } | undefined;

      if (!user || !['ADMIN', 'STAFF'].includes(user.role)) {
        throw new AppError(403, 'Forbidden - Admin or Staff role required');
      }

      const { path: itemPath, newName } = renameItemSchema.parse(request.body);
      await filesService.renameItem(itemPath, newName, user.role);

      return reply.send({
        success: true,
        message: 'Item renamed successfully',
      });
    } catch (error) {
      if (error instanceof AppError) {
        return reply.code(error.statusCode).send({
          success: false,
          error: error.message,
        });
      } else {
        return reply.code(500).send({
          success: false,
          error: 'Failed to rename item',
        });
      }
    }
  },

  async downloadFile(
    request: FastifyRequest<{ Querystring: { path: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const user = request.user as { userId: string; role: UserRole } | undefined;

      if (!user || !['ADMIN', 'STAFF'].includes(user.role)) {
        throw new AppError(403, 'Forbidden - Admin or Staff role required');
      }

      const { path: filePath } = downloadFileSchema.parse(request.query);
      const content = await filesService.getFile(filePath, user.role);
      const filename = path.basename('/' + filePath);

      return reply
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .type('application/octet-stream')
        .send(content);
    } catch (error) {
      if (error instanceof AppError) {
        return reply.code(error.statusCode).send({
          success: false,
          error: error.message,
        });
      } else {
        return reply.code(500).send({
          success: false,
          error: 'Failed to download file',
        });
      }
    }
  },

  async downloadAsZip(
    request: FastifyRequest<{ Querystring: { path: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const user = request.user as { userId: string; role: UserRole } | undefined;

      if (!user || !['ADMIN', 'STAFF'].includes(user.role)) {
        throw new AppError(403, 'Forbidden - Admin or Staff role required');
      }

      const { path: itemPath } = downloadFileSchema.parse(request.query);
      const { stream, cleanup, filename } = await filesService.downloadAsZip(itemPath, user.role);

      reply.raw.on('close', () => { cleanup(); });

      return reply
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .type('application/zip')
        .send(stream);
    } catch (error) {
      if (error instanceof AppError) {
        return reply.code(error.statusCode).send({
          success: false,
          error: error.message,
        });
      } else {
        return reply.code(500).send({
          success: false,
          error: 'Failed to create zip archive',
        });
      }
    }
  },

  async getFileContent(
    request: FastifyRequest<{ Querystring: { path: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const user = request.user as { userId: string; role: UserRole } | undefined;

      if (!user || !['ADMIN', 'STAFF'].includes(user.role)) {
        throw new AppError(403, 'Forbidden - Admin or Staff role required');
      }

      const { path: filePath } = z.object({ path: z.string() }).parse(request.query);
      const content = await filesService.getFile(filePath, user.role);

      return reply
        .type('text/plain; charset=utf-8')
        .send(content.toString('utf-8'));
    } catch (error) {
      if (error instanceof AppError) {
        return reply.code(error.statusCode).send({
          success: false,
          error: error.message,
        });
      } else {
        return reply.code(500).send({
          success: false,
          error: 'Failed to get file content',
        });
      }
    }
  },


  async uploadFile(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const user = request.user as { userId: string; role: UserRole } | undefined;

      if (!user || !['ADMIN', 'STAFF'].includes(user.role)) {
        throw new AppError(403, 'Forbidden - Admin or Staff role required');
      }

      const data = await request.file();
      
      if (!data) {
        throw new AppError(400, 'No file uploaded');
      }

      const dirPath = (request.query as any).path || '';
      const content = await data.toBuffer();

      await filesService.uploadFile(dirPath, data.filename, content, user.role);

      return reply.send({
        success: true,
        message: 'File uploaded successfully',
      });
    } catch (error) {
      if (error instanceof AppError) {
        return reply.code(error.statusCode).send({
          success: false,
          error: error.message,
        });
      } else {
        return reply.code(500).send({
          success: false,
          error: 'Failed to upload file',
        });
      }
    }
},

  async moveItem(
    request: FastifyRequest<{ Body: { sourcePath: string; destinationDir: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const user = request.user as { userId: string; role: UserRole } | undefined;

      if (!user || !['ADMIN', 'STAFF'].includes(user.role)) {
        throw new AppError(403, 'Forbidden - Admin or Staff role required');
      }

      const moveItemSchema = z.object({
        sourcePath: z.string().min(1),
        destinationDir: z.string().min(0),
      });

      const { sourcePath, destinationDir } = moveItemSchema.parse(request.body);
      await filesService.moveItem(sourcePath, destinationDir, user.role);

      return reply.send({
        success: true,
        message: 'Item moved successfully',
      });
    } catch (error) {
      if (error instanceof AppError) {
        return reply.code(error.statusCode).send({
          success: false,
          error: error.message,
        });
      } else {
        return reply.code(500).send({
          success: false,
          error: 'Failed to move item',
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
},

  async copyItem(
    request: FastifyRequest<{ Body: { sourcePath: string; destinationDir: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const user = request.user as { userId: string; role: UserRole } | undefined;

      if (!user || !['ADMIN', 'STAFF'].includes(user.role)) {
        throw new AppError(403, 'Forbidden - Admin or Staff role required');
      }

      const copyItemSchema = z.object({
        sourcePath: z.string().min(1),
        destinationDir: z.string(),
      });

      const { sourcePath, destinationDir } = copyItemSchema.parse(request.body);
      await filesService.copyItem(sourcePath, destinationDir, user.role);

      return reply.send({
        success: true,
        message: 'Item copied successfully',
      });
    } catch (error) {
      if (error instanceof AppError) {
        return reply.code(error.statusCode).send({
          success: false,
          error: error.message,
        });
      } else {
        return reply.code(500).send({
          success: false,
          error: 'Failed to copy item',
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  },

  async extractArchive(
    request: FastifyRequest<{ Body: { archivePath: string; destinationPath: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const user = request.user as { userId: string; role: UserRole } | undefined;

      if (!user || !['ADMIN', 'STAFF'].includes(user.role)) {
        throw new AppError(403, 'Forbidden - Admin or Staff role required');
      }

      const extractArchiveSchema = z.object({
        archivePath: z.string().min(1),
        destinationPath: z.string().min(1),
      });

      const { archivePath, destinationPath } = extractArchiveSchema.parse(request.body);
      const result = await filesService.extractArchive(archivePath, destinationPath, user.role);

      return reply.send({
        success: true,
        data: result,
        message: result.message,
      });
    } catch (error) {
      if (error instanceof AppError) {
        return reply.code(error.statusCode).send({
          success: false,
          error: error.message,
        });
      } else {
        return reply.code(500).send({
          success: false,
          error: 'Failed to extract archive',
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  },
};
