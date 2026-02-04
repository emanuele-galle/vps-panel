import { create } from 'zustand';
import api from '@/lib/api';

export type LogStatus = 'SUCCESS' | 'ERROR' | 'WARNING';

export interface ActivityLog {
  id: string;
  userId: string | null;
  user: {
    id: string;
    name: string;
    email: string;
  } | null;
  action: string;
  resource: string;
  resourceId: string | null;
  description: string;
  metadata: any;
  status: LogStatus;
  errorMessage: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface ActivityStats {
  total: number;
  success: number;
  error: number;
  warning: number;
  byResource: Record<string, number>;
  byAction: Record<string, number>;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

interface ActivityState {
  logs: ActivityLog[];
  stats: ActivityStats | null;
  pagination: Pagination | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchLogs: (filters?: any, page?: number, limit?: number) => Promise<void>;
  fetchStats: (filters?: any) => Promise<void>;
  searchLogs: (query: string, page?: number) => Promise<void>;
  exportLogs: (filters?: any) => Promise<void>;
}

export const useActivityStore = create<ActivityState>((set, get) => ({
  logs: [],
  stats: null,
  pagination: null,
  isLoading: false,
  error: null,

  fetchLogs: async (filters = {}, page = 1, limit = 50) => {
    set({ isLoading: true, error: null });
    try {
      const params = { page, limit, ...filters };
      const response = await api.get('/activity', { params });

      set({
        logs: response.data.data || [],
        pagination: response.data.pagination,
        isLoading: false,
      });
    } catch (error: any) {
      set({
        error: error.response?.data?.error || 'Failed to fetch activity logs',
        isLoading: false,
      });
    }
  },

  fetchStats: async (filters = {}) => {
    try {
      const response = await api.get('/activity/stats', { params: filters });
      set({ stats: response.data.data });
    } catch (error: any) {
      console.error('Failed to fetch activity stats:', error);
    }
  },

  searchLogs: async (query: string, page = 1) => {
    if (!query.trim()) {
      await get().fetchLogs();
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const response = await api.get('/activity/search', {
        params: { q: query, page, limit: 50 },
      });

      set({
        logs: response.data.data || [],
        pagination: response.data.pagination,
        isLoading: false,
      });
    } catch (error: any) {
      set({
        error: error.response?.data?.error || 'Failed to search activity logs',
        isLoading: false,
      });
    }
  },

  exportLogs: async (filters = {}) => {
    try {
      const response = await api.get('/activity/export', {
        params: filters,
        responseType: 'blob',
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `activity-logs-${new Date().toISOString()}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error: any) {
      console.error('Failed to export logs:', error);
      throw new Error('Failed to export activity logs');
    }
  },
}));
