import { create } from 'zustand';
import { monitoringApi } from '@/lib/api';
import { SystemMetrics, MetricsSnapshot } from '@/types';

interface MonitoringState {
  currentMetrics: SystemMetrics | null;
  metricsHistory: MetricsSnapshot[];
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchCurrentMetrics: () => Promise<void>;
  fetchMetricsHistory: (hours?: number) => Promise<void>;
  setCurrentMetrics: (metrics: SystemMetrics) => void;
}

export const useMonitoringStore = create<MonitoringState>((set) => ({
  currentMetrics: null,
  metricsHistory: [],
  isLoading: false,
  error: null,

  fetchCurrentMetrics: async () => {
    set({ isLoading: true, error: null });

    try {
      const response = await monitoringApi.getCurrent();
      const metrics = response.data?.data || null;

      set({
        currentMetrics: metrics,
        isLoading: false,
      });
    } catch (error: any) {
      set({
        error: error.message,
        isLoading: false,
      });
    }
  },

  fetchMetricsHistory: async (hours = 24) => {
    set({ isLoading: true, error: null });

    try {
      const response = await monitoringApi.getHistory(hours);
      const history = response.data?.data || [];

      set({
        metricsHistory: history,
        isLoading: false,
      });
    } catch (error: any) {
      set({
        error: error.message,
        isLoading: false,
      });
    }
  },

  setCurrentMetrics: (metrics) => set({ currentMetrics: metrics }),
}));
