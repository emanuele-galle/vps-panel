import fs from 'fs/promises';
import { createReadStream } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { AppError } from '../../utils/errors';

interface FileItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  modified: string;
  permissions: string;
}

interface DirectoryListing {
  path: string;
  items: FileItem[];
  parent: string | null;
}

const ADMIN_ALLOWED_PATHS = ['/var/www', '/root', '/home/sviluppatore'];
const STAFF_ALLOWED_PATHS = ['/var/www/projects'];

const execAsync = promisify(exec);

// Archive file extensions
const ARCHIVE_EXTENSIONS = ['.zip', '.tar', '.tar.gz', '.tgz', '.tar.bz2', '.tbz2'];

function isArchive(filename: string): boolean {
  const lower = filename.toLowerCase();
  return ARCHIVE_EXTENSIONS.some(ext => lower.endsWith(ext));
}

const BLACKLISTED_FILES = [
  '.env', '.env.local', '.env.production', '.env.development',
  'id_rsa', 'id_ed25519', 'id_ecdsa',
  'credentials.json', 'service-account.json',
];

function isBlacklisted(filename: string): boolean {
  const lower = filename.toLowerCase();
  return BLACKLISTED_FILES.some(pattern => {
    if (pattern.startsWith('*')) {
      return lower.endsWith(pattern.substring(2));
    }
    return lower === pattern || lower.endsWith('.' + pattern) || lower.endsWith(pattern);
  });
}

export const filesService = {
  /**
   * List directory contents
   */
  async listDirectory(dirPath: string, userRole: string): Promise<DirectoryListing> {
    // Add timeout protection
    return Promise.race([
      this._listDirectoryInternal(dirPath, userRole),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new AppError(408, 'Directory listing timeout')), 20000)
      ),
    ]);
  },

  async _listDirectoryInternal(dirPath: string, userRole: string): Promise<DirectoryListing> {
    // Special case: root listing for ADMIN shows allowed directories
    if (userRole === 'ADMIN' && dirPath === '') {
      const items: FileItem[] = [];
      
      for (const allowedPath of ADMIN_ALLOWED_PATHS) {
        try {
          const stats = await fs.stat(allowedPath);
          const name = allowedPath.split('/').filter(Boolean).pop() || allowedPath;
          items.push({
            name: name,
            path: allowedPath.substring(1),
            type: 'directory',
            size: stats.size,
            modified: stats.mtime.toISOString(),
            permissions: (stats.mode & parseInt('777', 8)).toString(8),
          });
        } catch (error) {
          continue;
        }
      }

      return {
        path: '',
        items,
        parent: null,
      };
    }

    // Determine base path and validate
    const allowedPaths = userRole === 'ADMIN' ? ADMIN_ALLOWED_PATHS : STAFF_ALLOWED_PATHS;
    const absolutePath = dirPath.startsWith('/') ? dirPath : '/' + dirPath;
    
    // Resolve symlinks for security
    let realPath;
    try {
      realPath = await fs.realpath(absolutePath);
    } catch {
      realPath = absolutePath;
    }
    
    // Check if path starts with any allowed path
    const isAllowed = allowedPaths.some(allowed => realPath.startsWith(allowed));
    
    if (!isAllowed) {
      throw new AppError(403, 'Access denied - path outside allowed directories');
    }

    try {
      const entries = await fs.readdir(absolutePath, { withFileTypes: true });

      // PERFORMANCE FIX: Parallel fs.stat() instead of sequential
      const statPromises = entries.map(async (entry) => {
        // Skip blacklisted files
        if (isBlacklisted(entry.name)) {
          return null;
        }

        const fullPath = path.join(absolutePath, entry.name);
        try {
          const stats = await fs.stat(fullPath);
          return {
            name: entry.name,
            path: fullPath.substring(1),
            type: entry.isDirectory() ? 'directory' : 'file',
            size: stats.size,
            modified: stats.mtime.toISOString(),
            permissions: (stats.mode & parseInt('777', 8)).toString(8),
          };
        } catch (error) {
          return null;
        }
      });

      // Process in batches to avoid overwhelming filesystem
      const BATCH_SIZE = 50;
      const allItems: FileItem[] = [];

      for (let i = 0; i < statPromises.length; i += BATCH_SIZE) {
        const batch = statPromises.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(batch);
        allItems.push(...results.filter((r): r is FileItem => r !== null));
      }

      // Sort: directories first, then alphabetically
      allItems.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });

      // Determine parent
      const parentPath = path.dirname(absolutePath);
      const hasParent = parentPath !== '/' && parentPath !== absolutePath;
      const parent = hasParent ? parentPath.substring(1) : null;

      return {
        path: absolutePath.substring(1),
        items: allItems,
        parent,
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new AppError(404, 'Directory not found');
      }
      if ((error as NodeJS.ErrnoException).code === 'EACCES') {
        throw new AppError(403, 'Permission denied');
      }
      throw new AppError(500, 'Failed to read directory');
    }
  },

  async createDirectory(dirPath: string, name: string, userRole: string): Promise<void> {
    const allowedPaths = userRole === 'ADMIN' ? ADMIN_ALLOWED_PATHS : STAFF_ALLOWED_PATHS;
    const absolutePath = '/' + path.join(dirPath, name);

    const isAllowed = allowedPaths.some(allowed => absolutePath.startsWith(allowed));
    if (!isAllowed) {
      throw new AppError(403, 'Access denied');
    }

    try {
      await fs.mkdir(absolutePath, { recursive: false });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        throw new AppError(409, 'Directory already exists');
      }
      throw new AppError(500, 'Failed to create directory');
    }
  },

  async deleteItem(itemPath: string, userRole: string): Promise<void> {
    const allowedPaths = userRole === 'ADMIN' ? ADMIN_ALLOWED_PATHS : STAFF_ALLOWED_PATHS;
    const absolutePath = '/' + itemPath;

    const isAllowed = allowedPaths.some(allowed => absolutePath.startsWith(allowed));
    if (!isAllowed) {
      throw new AppError(403, 'Access denied');
    }

    try {
      const stats = await fs.stat(absolutePath);
      if (stats.isDirectory()) {
        await fs.rm(absolutePath, { recursive: true });
      } else {
        await fs.unlink(absolutePath);
      }
    } catch (error) {
      const err = error as NodeJS.ErrnoException;

      // Log error for debugging
      console.error(`[files.service] Delete failed for ${absolutePath}:`, {
        code: err.code,
        message: err.message,
        stack: err.stack,
      });

      // Handle specific error codes
      if (err.code === 'ENOENT') {
        throw new AppError(404, 'Elemento non trovato');
      }

      if (err.code === 'EBUSY') {
        throw new AppError(
          409,
          'La cartella è in uso o è un mount point. Non può essere eliminata mentre è montata.'
        );
      }

      if (err.code === 'EPERM') {
        throw new AppError(
          403,
          'Permessi insufficienti per eliminare questo elemento.'
        );
      }

      if (err.code === 'EACCES') {
        throw new AppError(
          403,
          'Accesso negato. Verifica i permessi del file.'
        );
      }

      // Generic error with error code for debugging
      throw new AppError(
        500,
        `Impossibile eliminare l'elemento${err.code ? ` (${err.code})` : ''}`
      );
    }
  },

  async renameItem(oldPath: string, newName: string, userRole: string): Promise<void> {
    const allowedPaths = userRole === 'ADMIN' ? ADMIN_ALLOWED_PATHS : STAFF_ALLOWED_PATHS;
    const absoluteOldPath = '/' + oldPath;
    const absoluteNewPath = '/' + path.join(path.dirname(oldPath), newName);

    const isOldAllowed = allowedPaths.some(allowed => absoluteOldPath.startsWith(allowed));
    const isNewAllowed = allowedPaths.some(allowed => absoluteNewPath.startsWith(allowed));

    if (!isOldAllowed || !isNewAllowed) {
      throw new AppError(403, 'Access denied');
    }

    try {
      await fs.rename(absoluteOldPath, absoluteNewPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new AppError(404, 'Item not found');
      }
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        throw new AppError(409, 'Item with that name already exists');
      }
      throw new AppError(500, 'Failed to rename item');
    }
  },

  async getFile(filePath: string, userRole: string): Promise<Buffer> {
    const allowedPaths = userRole === 'ADMIN' ? ADMIN_ALLOWED_PATHS : STAFF_ALLOWED_PATHS;
    const absolutePath = '/' + filePath;

    const isAllowed = allowedPaths.some(allowed => absolutePath.startsWith(allowed));
    if (!isAllowed) {
      throw new AppError(403, 'Access denied');
    }

    try {
      return await fs.readFile(absolutePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new AppError(404, 'File not found');
      }
      throw new AppError(500, 'Failed to read file');
    }
  },

  async uploadFile(dirPath: string, filename: string, content: Buffer, userRole: string): Promise<void> {
    const allowedPaths = userRole === 'ADMIN' ? ADMIN_ALLOWED_PATHS : STAFF_ALLOWED_PATHS;
    const absolutePath = '/' + path.join(dirPath, filename);

    const isAllowed = allowedPaths.some(allowed => absolutePath.startsWith(allowed));
    if (!isAllowed) {
      throw new AppError(403, 'Access denied');
    }

    try {
      await fs.writeFile(absolutePath, content);
    } catch (error) {
      throw new AppError(500, 'Failed to upload file');
    }
},

  async moveItem(sourcePath: string, destinationDir: string, userRole: string): Promise<void> {
    const allowedPaths = userRole === 'ADMIN' ? ADMIN_ALLOWED_PATHS : STAFF_ALLOWED_PATHS;
    const absoluteSourcePath = '/' + sourcePath;
    const sourceFilename = path.basename(absoluteSourcePath);
    const absoluteDestinationPath = path.join('/' + destinationDir, sourceFilename);

    // Validate source
    const isSourceAllowed = allowedPaths.some(allowed => absoluteSourcePath.startsWith(allowed));
    if (!isSourceAllowed) {
      throw new AppError(403, 'Access denied - source outside allowed directories');
    }

    // Validate destination
    const isDestinationAllowed = allowedPaths.some(allowed => absoluteDestinationPath.startsWith(allowed));
    if (!isDestinationAllowed) {
      throw new AppError(403, 'Access denied - destination outside allowed directories');
    }

    // Prevent moving into itself (for directories)
    if (absoluteDestinationPath.startsWith(absoluteSourcePath + '/')) {
      throw new AppError(400, 'Cannot move directory into itself');
    }

    // Check source exists
    try {
      await fs.stat(absoluteSourcePath);
    } catch (error) {
      throw new AppError(404, 'Source item not found');
    }

    // Check destination directory exists
    try {
      const destDirStats = await fs.stat('/' + destinationDir);
      if (!destDirStats.isDirectory()) {
        throw new AppError(400, 'Destination must be a directory');
      }
    } catch (error) {
      throw new AppError(404, 'Destination directory not found');
    }

    // Check if destination item already exists
    try {
      await fs.stat(absoluteDestinationPath);
      throw new AppError(409, 'Item with same name already exists in destination');
    } catch (error) {
      // ENOENT is expected (file doesn't exist = good)
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }

    // Move
    try {
      await fs.rename(absoluteSourcePath, absoluteDestinationPath);
    } catch (error) {
      throw new AppError(500, 'Failed to move item');
    }
  },

  async copyItem(sourcePath: string, destinationDir: string, userRole: string): Promise<void> {
    const allowedPaths = userRole === 'ADMIN' ? ADMIN_ALLOWED_PATHS : STAFF_ALLOWED_PATHS;
    const absoluteSourcePath = '/' + sourcePath;
    const sourceFilename = path.basename(absoluteSourcePath);
    const absoluteDestinationPath = path.join('/' + destinationDir, sourceFilename);

    // Validate source
    const isSourceAllowed = allowedPaths.some(allowed => absoluteSourcePath.startsWith(allowed));
    if (!isSourceAllowed) {
      throw new AppError(403, 'Access denied - source outside allowed directories');
    }

    // Validate destination
    const isDestinationAllowed = allowedPaths.some(allowed => absoluteDestinationPath.startsWith(allowed));
    if (!isDestinationAllowed) {
      throw new AppError(403, 'Access denied - destination outside allowed directories');
    }

    // Prevent copying into itself (for directories)
    if (absoluteDestinationPath.startsWith(absoluteSourcePath + '/')) {
      throw new AppError(400, 'Cannot copy directory into itself');
    }

    // Check source exists
    try {
      await fs.stat(absoluteSourcePath);
    } catch (error) {
      throw new AppError(404, 'Source item not found');
    }

    // Check destination directory exists
    try {
      const destDirStats = await fs.stat('/' + destinationDir);
      if (!destDirStats.isDirectory()) {
        throw new AppError(400, 'Destination must be a directory');
      }
    } catch (error) {
      throw new AppError(404, 'Destination directory not found');
    }

    // Check if destination item already exists
    try {
      await fs.stat(absoluteDestinationPath);
      throw new AppError(409, 'Item with same name already exists in destination');
    } catch (error) {
      // ENOENT is expected (file doesn't exist = good)
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }

    // Copy (recursive for directories)
    try {
      await fs.cp(absoluteSourcePath, absoluteDestinationPath, { recursive: true });
    } catch (error) {
      throw new AppError(500, `Failed to copy item: ${(error as Error).message}`);
    }
  },

  async downloadAsZip(
    itemPath: string,
    userRole: string
  ): Promise<{ stream: ReturnType<typeof createReadStream>; cleanup: () => Promise<void>; filename: string }> {
    const allowedPaths = userRole === 'ADMIN' ? ADMIN_ALLOWED_PATHS : STAFF_ALLOWED_PATHS;
    const absolutePath = '/' + itemPath;

    const isAllowed = allowedPaths.some(allowed => absolutePath.startsWith(allowed));
    if (!isAllowed) {
      throw new AppError(403, 'Access denied');
    }

    // Check path exists
    try {
      await fs.stat(absolutePath);
    } catch {
      throw new AppError(404, 'Path not found');
    }

    const baseName = path.basename(absolutePath);
    const tmpFile = `/tmp/download-${Date.now()}-${baseName}.zip`;

    try {
      const command = `cd "${path.dirname(absolutePath)}" && zip -r -q "${tmpFile}" "${baseName}"`;
      await execAsync(command, { timeout: 120000, maxBuffer: 10 * 1024 * 1024 });

      const stream = createReadStream(tmpFile);
      const cleanup = async () => {
        try { await fs.unlink(tmpFile); } catch {}
      };

      return { stream, cleanup, filename: `${baseName}.zip` };
    } catch (error) {
      try { await fs.unlink(tmpFile); } catch {}
      throw new AppError(500, 'Failed to create zip archive');
    }
  },

  async extractArchive(
    archivePath: string,
    destinationPath: string,
    userRole: string
  ): Promise<{ filesExtracted: number; message: string }> {
    const allowedPaths = userRole === 'ADMIN' ? ADMIN_ALLOWED_PATHS : STAFF_ALLOWED_PATHS;
    const absoluteArchivePath = '/' + archivePath;
    const absoluteDestinationPath = '/' + destinationPath;

    // Validate source archive
    const isArchiveAllowed = allowedPaths.some(allowed => absoluteArchivePath.startsWith(allowed));
    if (!isArchiveAllowed) {
      throw new AppError(403, 'Access denied - archive outside allowed directories');
    }

    // Validate destination
    const isDestinationAllowed = allowedPaths.some(allowed => absoluteDestinationPath.startsWith(allowed));
    if (!isDestinationAllowed) {
      throw new AppError(403, 'Access denied - destination outside allowed directories');
    }

    // Check archive exists and get size
    let stats;
    try {
      stats = await fs.stat(absoluteArchivePath);
      if (!stats.isFile()) {
        throw new AppError(400, 'Archive must be a file');
      }
    } catch (error) {
      throw new AppError(404, 'Archive file not found');
    }

    // Security: Reject archives > 500MB (zip bomb protection)
    const MAX_ARCHIVE_SIZE = 500 * 1024 * 1024; // 500MB
    if (stats.size > MAX_ARCHIVE_SIZE) {
      throw new AppError(413, 'Archive too large (max 500MB)');
    }

    // Create destination directory if not exists
    try {
      await fs.mkdir(absoluteDestinationPath, { recursive: true });
    } catch (error) {
      throw new AppError(500, 'Failed to create destination directory');
    }

    // Detect archive type and extract
    const filename = path.basename(absoluteArchivePath).toLowerCase();
    let command: string;
    const timeout = 120000; // 2 minutes timeout

    try {
      if (filename.endsWith('.zip')) {
        // unzip with security flags: -q = quiet, -n = never overwrite, -d = destination
        command = `unzip -q -n "${absoluteArchivePath}" -d "${absoluteDestinationPath}"`;
      } else if (filename.endsWith('.tar.gz') || filename.endsWith('.tgz')) {
        // tar with security flags: --no-same-owner/permissions = use default perms
        command = `tar -xzf "${absoluteArchivePath}" -C "${absoluteDestinationPath}" --no-same-owner --no-same-permissions`;
      } else if (filename.endsWith('.tar.bz2') || filename.endsWith('.tbz2')) {
        command = `tar -xjf "${absoluteArchivePath}" -C "${absoluteDestinationPath}" --no-same-owner --no-same-permissions`;
      } else if (filename.endsWith('.tar')) {
        command = `tar -xf "${absoluteArchivePath}" -C "${absoluteDestinationPath}" --no-same-owner --no-same-permissions`;
      } else {
        throw new AppError(400, 'Unsupported archive format');
      }

      // Execute with timeout and output capture
      await execAsync(command, {
        timeout,
        maxBuffer: 10 * 1024 * 1024, // 10MB output buffer
      });

      // Count extracted files
      const extractedItems = await fs.readdir(absoluteDestinationPath);
      const filesExtracted = extractedItems.length;

      return {
        filesExtracted,
        message: `Successfully extracted ${filesExtracted} items`,
      };

    } catch (error) {
      // Clean up on failure (solo se directory vuota)
      try {
        const itemsInDest = await fs.readdir(absoluteDestinationPath);
        if (itemsInDest.length === 0) {
          await fs.rmdir(absoluteDestinationPath);
        }
      } catch {}

      if ((error as any).killed || (error as any).signal === 'SIGTERM') {
        throw new AppError(408, 'Extraction timeout - archive too large or complex');
      }

      throw new AppError(500, 'Extraction failed: ' + ((error as Error).message || 'Unknown error'));
    }
  },
};
