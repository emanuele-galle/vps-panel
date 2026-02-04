export interface N8nStatus {
  running: boolean;
  containerId?: string;
  containerName?: string;
  state?: string;
  health?: string;
  uptime?: string;
  startedAt?: string;
  version?: string;
  url: string;
}

export interface N8nStats {
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

export interface N8nWorkflow {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  nodes?: number;
}

export interface N8nBackupResult {
  success: boolean;
  filename: string;
  path: string;
  size: number;
  workflows: number;
  credentials: number;
  timestamp: string;
}

export interface N8nRestoreResult {
  success: boolean;
  workflows: number;
  credentials: number;
  errors?: string[];
}

export interface N8nConfig {
  enabled: boolean;
  autoStart: boolean;
  backupEnabled: boolean;
  backupSchedule: string;
  retentionDays: number;
}

export interface N8nSsoToken {
  token: string;
  url: string;
  expiresIn: number;
}
