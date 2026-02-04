import { create } from 'zustand';
import api from '@/lib/api';

export interface SystemSetting {
  id: string;
  key: string;
  value: string;
  description: string | null;
  category: string;
  isSecret: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GroupedSettings {
  [category: string]: SystemSetting[];
}

interface SystemSettingsState {
  settings: SystemSetting[];
  groupedSettings: GroupedSettings | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchSettings: () => Promise<void>;
  fetchGroupedSettings: () => Promise<void>;
  fetchSettingsByCategory: (category: string) => Promise<void>;
  updateSetting: (key: string, value: string) => Promise<void>;
  bulkUpdateSettings: (settings: { key: string; value: string }[]) => Promise<void>;
  upsertSetting: (data: {
    key: string;
    value: string;
    description?: string;
    category?: string;
    isSecret?: boolean;
  }) => Promise<void>;
  deleteSetting: (key: string) => Promise<void>;
  initializeDefaults: () => Promise<void>;
}

export const useSystemSettingsStore = create<SystemSettingsState>((set, get) => ({
  settings: [],
  groupedSettings: null,
  isLoading: false,
  error: null,

  fetchSettings: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get('/system-settings');
      set({
        settings: response.data.data,
        isLoading: false,
      });
    } catch (error: any) {
      set({
        error: error.response?.data?.error || 'Failed to fetch settings',
        isLoading: false,
      });
    }
  },

  fetchGroupedSettings: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get('/system-settings/grouped');
      set({
        groupedSettings: response.data.data,
        isLoading: false,
      });
    } catch (error: any) {
      set({
        error: error.response?.data?.error || 'Failed to fetch grouped settings',
        isLoading: false,
      });
    }
  },

  fetchSettingsByCategory: async (category: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get(`/api/system-settings/category/${category}`);
      set({
        settings: response.data.data,
        isLoading: false,
      });
    } catch (error: any) {
      set({
        error: error.response?.data?.error || 'Failed to fetch settings by category',
        isLoading: false,
      });
    }
  },

  updateSetting: async (key: string, value: string) => {
    try {
      const response = await api.put(`/api/system-settings/${key}`, { value });

      // Update local state
      set((state) => ({
        settings: state.settings.map((s) =>
          s.key === key ? { ...s, value: response.data.data.value } : s
        ),
      }));

      // Refresh grouped settings if they exist
      if (get().groupedSettings) {
        await get().fetchGroupedSettings();
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to update setting');
    }
  },

  bulkUpdateSettings: async (settings: { key: string; value: string }[]) => {
    try {
      await api.post('/system-settings/bulk', { settings });

      // Refresh all settings after bulk update
      await get().fetchGroupedSettings();
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to bulk update settings');
    }
  },

  upsertSetting: async (data: {
    key: string;
    value: string;
    description?: string;
    category?: string;
    isSecret?: boolean;
  }) => {
    try {
      const response = await api.post('/system-settings', data);

      // Add or update in local state
      set((state) => {
        const existingIndex = state.settings.findIndex((s) => s.key === data.key);
        if (existingIndex >= 0) {
          const newSettings = [...state.settings];
          newSettings[existingIndex] = response.data.data;
          return { settings: newSettings };
        } else {
          return { settings: [...state.settings, response.data.data] };
        }
      });

      // Refresh grouped settings if they exist
      if (get().groupedSettings) {
        await get().fetchGroupedSettings();
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to save setting');
    }
  },

  deleteSetting: async (key: string) => {
    try {
      await api.delete(`/api/system-settings/${key}`);

      // Remove from local state
      set((state) => ({
        settings: state.settings.filter((s) => s.key !== key),
      }));

      // Refresh grouped settings if they exist
      if (get().groupedSettings) {
        await get().fetchGroupedSettings();
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to delete setting');
    }
  },

  initializeDefaults: async () => {
    try {
      await api.post('/system-settings/initialize');

      // Refresh all settings after initialization
      await get().fetchGroupedSettings();
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to initialize default settings');
    }
  },
}));
