// User types
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'STAFF';
  isActive: boolean;
  twoFactorEnabled: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

// Auth types
export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// Monitoring types
export interface SystemMetrics {
  cpu: number;
  memory: {
    total: number;
    used: number;
    free: number;
    percentage: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    percentage: number;
  };
  network: {
    received: number;
    transmitted: number;
  };
  docker: {
    containersRunning: number;
    containersStopped: number;
    imagesCount: number;
    volumesCount: number;
  };
  timestamp: string;
}

export interface MetricsSnapshot {
  timestamp: string;
  cpu: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  disk: {
    used: number;
    total: number;
    percentage: number;
  };
  network: {
    received: number;
    transmitted: number;
  };
  docker: {
    containersRunning: number;
    containersStopped: number;
    imagesCount: number;
    volumesCount: number;
  };
}

// Project types
export interface ProjectCredentials {
  // New format: role-based demo accounts
  accounts?: Record<string, {
    email: string;
    password: string;
    description?: string;
    loginUrl?: string;  // URL per accedere con questo account
  }>;
  // Link rapidi alle dashboard/aree del progetto
  dashboardUrls?: Record<string, string>;
  // URLs del progetto (landing, gestionale, demo sites, etc.)
  urls?: Record<string, {
    url: string;
    description?: string;
  }>;
  // Studios/Tenant demo per SaaS multi-tenant
  studios?: Record<string, {
    name: string;
    slug: string;
    template: string;
    status: string;
    publicUrl?: string;
  }>;
  // Templates disponibili per il progetto
  templates?: Array<{
    id: string;
    name: string;
    preview?: string;
  }>;
  // Servizi aggiuntivi (Redis, MinIO, etc.)
  services?: Record<string, {
    host?: string;
    port?: number;
    password?: string;
    apiPort?: number;
    consolePort?: number;
    accessKey?: string;
    secretKey?: string;
  }>;
  // Processi PM2
  pm2?: Array<{
    name: string;
    port: number;
    description?: string;
  }>;
  // Note generali
  notes?: string;
  // Legacy format support
  app?: {
    url?: string;
    demo?: { email: string; password: string } | Record<string, { email: string; password: string }>;
  };
  admin?: {
    url?: string;
    email?: string;
    password?: string;
    note?: string;
  };
  api?: {
    url?: string;
    docs?: string;
  };
  database?: Record<string, {
    host?: string;
    port?: number;
    database?: string;
    username?: string;
    password?: string;
  }>;
  custom?: Record<string, string>;
}

export interface ProjectMember {
  id: string;
  role: 'OWNER' | 'MANAGER' | 'MEMBER';
  user: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  description?: string;
  template: ProjectTemplate;
  status: ProjectStatus;
  clientName?: string;
  clientEmail?: string;
  previewUrl?: string;
  path: string;
  containers?: Container[];
  domains?: Domain[];
  members?: ProjectMember[];
  credentials?: ProjectCredentials;
  createdAt: string;
  updatedAt: string;
}

export type ProjectTemplate =
  | 'WORDPRESS'
  | 'NODEJS'
  | 'NEXTJS'
  | 'PYTHON'
  | 'PHP'
  | 'STATIC'
  | 'CUSTOM';

export type ProjectStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED' | 'ERROR';

// Container types
export interface ContainerPort {
  internal: number;
  external: number;
  protocol?: string;
}

export interface Container {
  id: string;
  dockerId: string;
  name: string;
  image: string;
  status: ContainerStatus;
  projectId: string;
  createdAt: string;
  ports?: ContainerPort[];
}

export type ContainerStatus =
  | 'CREATED'
  | 'RUNNING'
  | 'STOPPED'
  | 'PAUSED'
  | 'RESTARTING'
  | 'EXITED'
  | 'ERROR';

// Docker Container types (from Docker API)
export interface DockerContainer {
  Id: string;
  Names: string[];
  Image: string;
  ImageID: string;
  Command: string;
  Created: number;
  State: string;
  Status: string;
  Ports: DockerPort[];
  Labels: Record<string, string>;
  NetworkSettings?: {
    Networks: Record<string, any>;
  };
  Mounts?: DockerMount[];
}

export interface DockerPort {
  IP?: string;
  PrivatePort: number;
  PublicPort?: number;
  Type: string;
}

export interface DockerMount {
  Type: string;
  Name?: string;
  Source: string;
  Destination: string;
  Driver?: string;
  Mode: string;
  RW: boolean;
  Propagation: string;
}

export interface ContainerStats {
  cpu: number;
  memory: {
    used: number;
    limit: number;
    percentage: number;
  };
  network: {
    received: number;
    transmitted: number;
  };
}

// Domain types
export interface Domain {
  id: string;
  domain: string;
  projectId: string;
  project?: {
    id: string;
    name: string;
    slug: string;
  };
  sslEnabled: boolean;
  sslProvider?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Database types
export interface Database {
  id: string;
  name: string;
  type: DatabaseType;
  projectId: string;
  project?: {
    id: string;
    name: string;
    slug: string;
  };
  host: string;
  port: number;
  username: string;
  password: string;
  databaseName: string;
  size?: number;
  createdAt: string;
}

export type DatabaseType =
  | 'MYSQL'
  | 'POSTGRESQL'
  | 'MONGODB'
  | 'REDIS'
  | 'SQLITE';

// Backup types
export interface BackupUpload {
  id: string;
  userId: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
  filename: string;
  originalName: string;
  filepath: string;
  size: number;
  mimeType: string;
  status: BackupStatus;
  projectId?: string;
  project?: {
    id: string;
    name: string;
    slug: string;
    status: string;
  };
  projectPath?: string;
  driveFileId?: string;
  driveExportedAt?: string;
  notes?: string;
  errorMessage?: string;
  uploadedAt: string;
  processedAt?: string;
  expiresAt: string;
  deletedAt?: string;
}

export type BackupStatus =
  | 'UPLOADED'
  | 'PROCESSING'
  | 'IMPORTED'
  | 'EXPORTED'
  | 'FAILED'
  | 'EXPIRED';

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

// Disk Metrics types
export interface DiskOverview {
  images: DiskCategory;
  containers: DiskCategory;
  volumes: DiskCategory;
  buildCache: DiskCategory;
  total: {
    size: number;
    sizeFormatted: string;
    reclaimable: number;
    reclaimableFormatted: string;
  };
}

export interface DiskCategory {
  count: number;
  size: number;
  sizeFormatted: string;
  reclaimable: number;
  reclaimableFormatted: string;
}

export interface VolumeMetric {
  name: string;
  driver: string;
  mountpoint: string;
  size: number;
  sizeFormatted: string;
  projectName: string;
  projectSlug: string;
  createdAt: string;
}

export interface ContainerStorageMetric {
  id: string;
  name: string;
  image: string;
  size: number;
  sizeFormatted: string;
  virtualSize: number;
  virtualSizeFormatted: string;
  status: 'running' | 'stopped';
  projectName: string;
  projectSlug: string;
}

export interface ImageStorageMetric {
  id: string;
  repository: string;
  tag: string;
  size: number;
  sizeFormatted: string;
  createdAt: string;
}

export interface DatabaseStorageMetric {
  id: string;
  name: string;
  type: string;
  host: string;
  databaseName: string;
  size: number;
  sizeFormatted: string;
  tablesCount: number;
  projectName: string;
  projectSlug: string;
}

export interface DiskMetrics {
  overview: DiskOverview | null;
  volumes: {
    volumes: VolumeMetric[];
    totalSize: number;
    totalSizeFormatted: string;
    count: number;
  };
  containers: {
    containers: ContainerStorageMetric[];
    totalSize: number;
    totalSizeFormatted: string;
    totalVirtualSize: number;
    totalVirtualSizeFormatted: string;
    count: number;
  };
  images: {
    images: ImageStorageMetric[];
    totalSize: number;
    totalSizeFormatted: string;
    count: number;
  };
  databases: {
    databases: DatabaseStorageMetric[];
    totalSize: number;
    totalSizeFormatted: string;
    count: number;
  };
  timestamp: string;
}
