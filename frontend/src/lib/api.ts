import axios, { AxiosInstance, AxiosError } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Helper to get CSRF token from cookie
function getCsrfTokenFromCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/csrf_token=([^;]+)/);
  return match ? match[1] : null;
}

// Request interceptor - add CSRF token (auth handled via HttpOnly cookies)
api.interceptors.request.use(
  (config) => {
    // NOTE: Auth tokens are handled via HttpOnly cookies automatically
    // No need to add Authorization header - cookies are sent with withCredentials: true

    // Add CSRF token for state-changing requests (POST, PUT, DELETE, PATCH)
    const method = config.method?.toUpperCase();
    if (method && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      const csrfToken = getCsrfTokenFromCookie();
      if (csrfToken) {
        config.headers['x-csrf-token'] = csrfToken;
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Track if we're already refreshing to prevent multiple refresh attempts
let isRefreshing = false;

// Response interceptor - handle errors and refresh token
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as any;

    // Handle 401 Unauthorized
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Skip refresh attempt for auth endpoints to prevent loops
      if (originalRequest.url?.includes('/auth/')) {
        return Promise.reject(error);
      }

      // Prevent multiple simultaneous refresh attempts
      if (isRefreshing) {
        return Promise.reject(error);
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Try to refresh token (refresh token is in HttpOnly cookie)
        await axios.post(`${API_URL}/auth/refresh`, {}, { withCredentials: true });

        isRefreshing = false;
        // Cookies are automatically updated by the backend
        // Retry original request (cookies will be sent automatically)
        return api(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        // Refresh failed - don't redirect, let the app handle it
        // The authStore will set isAuthenticated: false and the app will redirect
        return Promise.reject(refreshError);
      }
    }

    // Handle other errors
    const responseData = error.response?.data as any;
    const errorMessage =
      responseData?.error?.message ||
      responseData?.message ||
      error.message ||
      'An unexpected error occurred';

    return Promise.reject(new Error(errorMessage));
  }
);

export default api;

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

// Auth API
export const authApi = {
  // REMOVED: Public registration disabled for security
  // register: (data: { email: string; name: string; password: string }) =>
  //   api.post<ApiResponse>('/auth/register', data),

  login: (data: { email: string; password: string; twoFactorCode?: string }) =>
    api.post<ApiResponse>('/auth/login', data),

  logout: () => api.post<ApiResponse>('/auth/logout'),

  me: () => api.get<ApiResponse>('/auth/me'),

  refresh: (refreshToken: string) =>
    api.post<ApiResponse>('/auth/refresh', { refreshToken }),

  setup2FA: () => api.post<ApiResponse>('/auth/2fa/setup'),

  enable2FA: (code: string) =>
    api.post<ApiResponse>('/auth/2fa/enable', { code }),

  disable2FA: (code: string) =>
    api.post<ApiResponse>('/auth/2fa/disable', { code }),

  updatePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.put<ApiResponse>('/auth/password', data),
};

// Monitoring API
export const monitoringApi = {
  getCurrent: () => api.get<ApiResponse>('/monitoring/current'),

  getHistory: (hours: number = 24) =>
    api.get<ApiResponse>(`/monitoring/history?hours=${hours}`),

  getContainerStats: (containerId: string) =>
    api.get<ApiResponse>(`/monitoring/container/${containerId}`),

  // Disk metrics
  getDiskMetrics: () => api.get<ApiResponse>('/monitoring/disk'),

  getVolumesStorage: () => api.get<ApiResponse>('/monitoring/disk/volumes'),

  getContainersStorage: () => api.get<ApiResponse>('/monitoring/disk/containers', { timeout: 60000 }),

  getImagesStorage: () => api.get<ApiResponse>('/monitoring/disk/images'),

  getDatabasesStorage: () => api.get<ApiResponse>('/monitoring/disk/databases'),

  getDashboardSummary: () => api.get<ApiResponse>('/monitoring/dashboard-summary'),
};

// Projects API
export const projectsApi = {
  getAll: (params?: { status?: string; template?: string }) =>
    api.get<ApiResponse>('/projects', { params }),

  getById: (id: string) => api.get<ApiResponse>(`/projects/${id}`),

  create: (data: {
    name: string;
    slug: string;
    description?: string;
    clientName?: string;
    clientEmail?: string;
    template: string;
  }) => api.post<ApiResponse>('/projects', data),

  update: (
    id: string,
    data: {
      name?: string;
      description?: string;
      status?: string;
      clientName?: string;
      clientEmail?: string;
    }
  ) => api.put<ApiResponse>(`/projects/${id}`, data),

  delete: (id: string) => api.delete<ApiResponse>(`/projects/${id}`),

  start: (id: string) => api.post<ApiResponse>(`/projects/${id}/start`),

  stop: (id: string) => api.post<ApiResponse>(`/projects/${id}/stop`),

  restart: (id: string) => api.post<ApiResponse>(`/projects/${id}/restart`),

  getLogs: (id: string, tail?: number) =>
    api.get<ApiResponse>(`/projects/${id}/logs`, { params: { tail } }),

  // Discovery API (ADMIN only)
  discoverProjects: () => api.get<ApiResponse>('/projects/discovery/scan'),

  importProject: (data: {
    folderName: string;
    path: string;
    name: string;
    slug: string;
    template: string;
    description?: string;
    previewUrl?: string;
  }) => api.post<ApiResponse>('/projects/discovery/import', data),

  importAllProjects: () => api.post<ApiResponse>('/projects/discovery/import-all'),

  // Sync credentials from vps-credentials.json file in project root
  syncCredentials: (id: string) => api.post<ApiResponse>(`/projects/${id}/sync-credentials`),

  // Deploy
  deploy: (id: string, branch?: string) =>
    api.post<ApiResponse>(`/projects/${id}/deploy`, { branch }),

  getDeployments: (id: string, params?: { limit?: number; offset?: number }) =>
    api.get<ApiResponse>(`/projects/${id}/deployments`, { params }),

  getLatestDeployment: (id: string) =>
    api.get<ApiResponse>(`/projects/${id}/deployments/latest`),

  rollbackDeploy: (id: string, deploymentId: string) =>
    api.post<ApiResponse>(`/projects/${id}/deploy/rollback`, { deploymentId }),
};

// Docker/Containers API
export const dockerApi = {
  listContainers: (all: boolean = true) =>
    api.get<ApiResponse>('/docker/containers', { params: { all } }),

  getContainer: (id: string) => api.get<ApiResponse>(`/docker/containers/${id}`),

  startContainer: (id: string) =>
    api.post<ApiResponse>(`/docker/containers/${id}/start`),

  stopContainer: (id: string) =>
    api.post<ApiResponse>(`/docker/containers/${id}/stop`),

  restartContainer: (id: string) =>
    api.post<ApiResponse>(`/docker/containers/${id}/restart`),

  removeContainer: (id: string, force: boolean = false) =>
    api.delete<ApiResponse>(`/docker/containers/${id}`, { params: { force } }),

  getContainerLogs: (id: string, tail?: number) =>
    api.get<ApiResponse>(`/docker/containers/${id}/logs`, { params: { tail } }),

  getContainerStats: (id: string) =>
    api.get<ApiResponse>(`/docker/containers/${id}/stats`),

  listNetworks: () => api.get<ApiResponse>('/docker/networks'),

  listVolumes: () => api.get<ApiResponse>('/docker/volumes'),

  listImages: () => api.get<ApiResponse>('/docker/images'),
};

// Domains API
export const domainsApi = {
  getAll: (params?: { projectId?: string; isActive?: boolean }) =>
    api.get<ApiResponse>('/domains', { params }),

  getById: (id: string) => api.get<ApiResponse>(`/domains/${id}`),

  create: (data: {
    domain: string;
    projectId: string;
    sslEnabled?: boolean;
  }) => api.post<ApiResponse>('/domains', data),

  update: (
    id: string,
    data: {
      sslEnabled?: boolean;
      isActive?: boolean;
    }
  ) => api.put<ApiResponse>(`/domains/${id}`, data),

  delete: (id: string) => api.delete<ApiResponse>(`/domains/${id}`),

  verify: (domain: string) =>
    api.post<ApiResponse>('/domains/verify', { domain }),
};

// Databases API
export const databasesApi = {
  getAll: (params?: { projectId?: string; type?: string }) =>
    api.get<ApiResponse>('/databases', { params }),

  getById: (id: string) => api.get<ApiResponse>(`/databases/${id}`),

  create: (data: {
    name: string;
    type: string;
    projectId: string;
    username?: string;
    password?: string;
  }) => api.post<ApiResponse>('/databases', data),

  update: (
    id: string,
    data: {
      password?: string;
    }
  ) => api.put<ApiResponse>(`/databases/${id}`, data),

  delete: (id: string) => api.delete<ApiResponse>(`/databases/${id}`),

  getConnectionString: (id: string) =>
    api.get<ApiResponse>(`/databases/${id}/connection`),
};

// Backups API
export const backupsApi = {
  // Upload a backup ZIP file
  upload: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    return api.post<ApiResponse>('/backups/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 300000, // 5 minutes for large uploads
    });
  },

  // Get all backups
  getAll: (params?: { status?: string }) =>
    api.get<ApiResponse>('/backups', { params }),

  // Get specific backup
  getById: (id: string) => api.get<ApiResponse>(`/backups/${id}`),

  // Import backup as project
  importBackup: (id: string, projectName?: string) =>
    api.post<ApiResponse>(`/backups/${id}/import`, { projectName }),

  // Delete backup
  delete: (id: string) => api.delete<ApiResponse>(`/backups/${id}`),

  // Export project as backup (TODO)
  exportProject: (projectId: string, notes?: string) =>
    api.post<ApiResponse>('/backups/export', { projectId, notes }),

  // Upload backup to Google Drive
  uploadToDrive: (id: string, folderId?: string) =>
    api.post<ApiResponse>(`/backups/${id}/upload-drive`, { backupId: id, folderId }),

  // Cleanup expired backups (admin only)
  cleanup: () => api.get<ApiResponse>('/backups/cleanup'),
};

// Users API
export const usersApi = {
  getAll: (params?: { role?: string; isActive?: boolean }) =>
    api.get<ApiResponse>('/users', { params }),

  getById: (id: string) => api.get<ApiResponse>(`/users/${id}`),

  create: (data: {
    email: string;
    name: string;
    password: string;
    role?: string;
  }) => api.post<ApiResponse>('/users', data),

  update: (
    id: string,
    data: {
      name?: string;
      role?: string;
      isActive?: boolean;
      password?: string;
    }
  ) => api.put<ApiResponse>(`/users/${id}`, data),

  delete: (id: string) => api.delete<ApiResponse>(`/users/${id}`),
};

// Email API
export const emailApi = {
  getAll: (params?: { domain?: string }) =>
    api.get<ApiResponse>('/email', { params }),

  getStats: () => api.get<ApiResponse>('/email/stats'),

  sync: () => api.post<ApiResponse>('/email/sync'),

  getById: (id: string) => api.get<ApiResponse>(`/email/${id}`),

  create: (data: {
    email: string;
    password: string;
    domain: string;
  }) => api.post<ApiResponse>('/email', data),

  update: (
    id: string,
    data: {
      password?: string;
      forwardTo?: string;
      autoReply?: boolean;
      autoReplyMsg?: string;
    }
  ) => api.patch<ApiResponse>(`/email/${id}`, data),

  delete: (id: string) => api.delete<ApiResponse>(`/email/${id}`),

  changePassword: (id: string, password: string) =>
    api.post<ApiResponse>(`/email/${id}/password`, { password }),
};

// Activity API
export const activityApi = {
  getAll: (params?: {
    userId?: string;
    action?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }) => api.get<ApiResponse>('/activity', { params }),

  getById: (id: string) => api.get<ApiResponse>(`/activity/${id}`),
};

// System Settings API
export const systemSettingsApi = {
  getAll: () => api.get<ApiResponse>('/system-settings'),

  get: (key: string) => api.get<ApiResponse>(`/system-settings/${key}`),

  update: (key: string, value: any) =>
    api.put<ApiResponse>(`/system-settings/${key}`, { value }),

  bulkUpdate: (settings: Record<string, any>) =>
    api.put<ApiResponse>('/system-settings', settings),
};

// File Manager API
export const fileManagerApi = {
  // FileBrowser instances management
  getAllInstances: () => api.get<ApiResponse>('/filemanager/instances'),

  getSystemInstance: () => api.get<ApiResponse>('/filemanager/system'),

  getInstance: (projectId: string) =>
    api.get<ApiResponse>(`/filemanager/${projectId}`),

  startFileBrowser: (projectId: string) =>
    api.post<ApiResponse>(`/filemanager/${projectId}/start`),

  stopFileBrowser: (projectId: string) =>
    api.post<ApiResponse>(`/filemanager/${projectId}/stop`),
};

// Claude Code API
export const claudeCodeApi = {
  // Authentication status
  getAuthStatus: () => api.get<ApiResponse>('/claude-code/auth-status'),

  // Session management
  startSession: (projectId?: string) =>
    api.post<ApiResponse>('/claude-code/sessions', { projectId }),

  reconnectSession: (sessionId: string) =>
    api.post<ApiResponse>(`/claude-code/sessions/${sessionId}/reconnect`),

  getSessions: () => api.get<ApiResponse>('/claude-code/sessions'),

  getAllSessions: () => api.get<ApiResponse>('/claude-code/sessions/all'),

  getSessionStatus: (sessionId: string) =>
    api.get<ApiResponse>(`/claude-code/sessions/${sessionId}/status`),

  executePrompt: (sessionId: string, prompt: string) =>
    api.post<ApiResponse>(`/claude-code/sessions/${sessionId}/execute`, { prompt }),

  stopSession: (sessionId: string) =>
    api.delete<ApiResponse>(`/claude-code/sessions/${sessionId}`),

  // Usage statistics
  getUsageStats: (params?: { startDate?: string; endDate?: string; userId?: string }) =>
    api.get<ApiResponse>('/claude-code/usage', { params }),

  // API Key management
  getApiKeyInfo: () => api.get<ApiResponse>('/claude-code/api-key'),

  setApiKey: (data: { apiKey: string; name?: string; monthlyLimitCents?: number }) =>
    api.put<ApiResponse>('/claude-code/api-key', data),

  deleteApiKey: () => api.delete<ApiResponse>('/claude-code/api-key'),

  // Admin API key management
  setSystemApiKey: (data: { apiKey: string; name?: string }) =>
    api.put<ApiResponse>('/claude-code/api-key/system', data),

  getAllApiKeys: () => api.get<ApiResponse>('/claude-code/api-keys'),

  resetMonthlyUsage: (userId: string) =>
    api.post<ApiResponse>(`/claude-code/api-keys/${userId}/reset-usage`),

  // WebSocket URL helper
  // NOTE: Auth is handled via cookies (same-origin) when WebSocket connects
  // The server extracts access_token from the cookie header on upgrade request
  getWebSocketUrl: () => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const apiHost = process.env.NEXT_PUBLIC_API_URL?.replace(/^https?:\/\//, '').replace(/\/api$/, '') || 'localhost:3001';
    return `${wsProtocol}//${apiHost}/ws/claude-code`;
  },
};

// N8N Automation API
export const n8nApi = {
  // Status
  getStatus: () => api.get<ApiResponse>('/n8n/status'),

  // Service control
  start: () => api.post<ApiResponse>('/n8n/start'),
  stop: () => api.post<ApiResponse>('/n8n/stop'),
  restart: () => api.post<ApiResponse>('/n8n/restart'),

  // Stats & Logs
  getStats: () => api.get<ApiResponse>('/n8n/stats'),
  getLogs: (tail?: number) => api.get<ApiResponse>('/n8n/logs', { params: { tail } }),

  // Workflows
  getWorkflows: () => api.get<ApiResponse>('/n8n/workflows'),

  // Backups
  listBackups: () => api.get<ApiResponse>('/n8n/backups'),
  createBackup: () => api.post<ApiResponse>('/n8n/backup'),
  restoreBackup: (id: string) => api.post<ApiResponse>(`/n8n/backups/${id}/restore`),
  deleteBackup: (id: string) => api.delete<ApiResponse>(`/n8n/backups/${id}`),

  // Config
  getConfig: () => api.get<ApiResponse>('/n8n/config'),
  updateConfig: (data: {
    enabled?: boolean;
    autoStart?: boolean;
    backupEnabled?: boolean;
    backupSchedule?: string;
    retentionDays?: number;
  }) => api.put<ApiResponse>('/n8n/config', data),

  // SSO
  getSsoToken: () => api.get<ApiResponse>('/n8n/sso-token'),

  // Cleanup
  cleanup: () => api.post<ApiResponse>('/n8n/cleanup'),
};

// Preferences API
export const preferencesApi = {
  get: () => api.get("/auth/preferences"),
  update: (preferences: any) => api.put("/auth/preferences", preferences),
};
