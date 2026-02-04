import { create } from 'zustand';
import api from '@/lib/api';

interface FileBrowserInstance {
  projectId: string;
  projectSlug: string;
  url: string;
  port: number;
  isRunning: boolean;
  containerId?: string;
  username?: string;
}

interface FileManagerState {
  instances: FileBrowserInstance[];
  systemInstance: FileBrowserInstance | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchInstances: () => Promise<void>;
  fetchSystemInstance: () => Promise<void>;
  getInstance: (projectId: string) => Promise<FileBrowserInstance | null>;
  startFileBrowser: (projectId: string) => Promise<FileBrowserInstance>;
  stopFileBrowser: (projectId: string) => Promise<void>;
}

export const useFileManagerStore = create<FileManagerState>((set, get) => ({
  instances: [],
  systemInstance: null,
  isLoading: false,
  error: null,

  fetchInstances: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get('/filemanager/instances');
      set({ instances: response.data.data, isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.error || 'Failed to fetch FileBrowser instances',
        isLoading: false,
      });
    }
  },

  fetchSystemInstance: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get('/filemanager/system');
      set({ systemInstance: response.data.data, isLoading: false });
    } catch (error: any) {
      // If 403, user is not admin (silently ignore)
      if (error.response?.status === 403) {
        set({ systemInstance: null, isLoading: false });
      } else {
        set({
          error: error.response?.data?.error || 'Failed to fetch System FileBrowser',
          isLoading: false,
        });
      }
    }
  },

  getInstance: async (projectId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get(`/api/filemanager/${projectId}`);
      set({ isLoading: false });
      return response.data.data;
    } catch (error: any) {
      set({
        error: error.response?.data?.error || 'Failed to fetch FileBrowser instance',
        isLoading: false,
      });
      return null;
    }
  },

  startFileBrowser: async (projectId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post(`/api/filemanager/${projectId}/start`);
      const instance = response.data.data;

      // Update instances list
      const { instances } = get();
      const existingIndex = instances.findIndex((i) => i.projectId === projectId);

      if (existingIndex >= 0) {
        instances[existingIndex] = instance;
      } else {
        instances.push(instance);
      }

      set({ instances: [...instances], isLoading: false });
      return instance;
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to start FileBrowser';
      set({ error: errorMessage, isLoading: false });
      throw new Error(errorMessage);
    }
  },

  stopFileBrowser: async (projectId: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.post(`/api/filemanager/${projectId}/stop`);

      // Update instance status
      const { instances } = get();
      const updatedInstances = instances.map((instance) =>
        instance.projectId === projectId
          ? { ...instance, isRunning: false }
          : instance
      );

      set({ instances: updatedInstances, isLoading: false });
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to stop FileBrowser';
      set({ error: errorMessage, isLoading: false });
      throw new Error(errorMessage);
    }
  },
}));
