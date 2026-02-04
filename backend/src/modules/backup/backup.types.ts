import { BackupStatus } from '@prisma/client';
import { MultipartFile } from '@fastify/multipart';

export interface BackupUploadData {
  file: MultipartFile;
  userId: string;
  notes?: string;
}

export interface ImportBackupData {
  backupId: string;
  userId: string;
  projectName?: string;
  projectSlug?: string;
}

export interface ExportProjectData {
  projectId: string;
  userId: string;
  notes?: string;
}

export interface GoogleDriveUploadData {
  backupId: string;
  userId: string;
  folderId?: string;
}

export interface BackupFilters {
  userId: string;
  status?: BackupStatus;
  projectId?: string;
  limit?: number;
  offset?: number;
}

export interface BackupAnalysis {
  hasPackageJson: boolean;
  hasDockerCompose: boolean;
  hasPrismaSchema: boolean;
  detectedFramework?: 'nextjs' | 'nestjs' | 'express' | 'fastify' | 'wordpress' | 'other';
  filesCount: number;
  totalSize: number;
  directories: string[];
  filesToCleanup: string[];
  dependencies?: {
    runtime?: string[];
    global?: string[];
  };
}
