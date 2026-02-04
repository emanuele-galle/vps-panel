import { create } from 'zustand';
import { backupsApi } from '@/lib/api';
import { BackupUpload, BackupStatus } from '@/types';

interface BackupsState {
  backups: BackupUpload[];
  currentBackup: BackupUpload | null;
  isLoading: boolean;
  isUploading: boolean;
  uploadProgress: number;
  error: string | null;

  // Actions
  fetchBackups: (filters?: { status?: BackupStatus }) => Promise<void>;
  fetchBackup: (id: string) => Promise<void>;
  uploadBackup: (file: File) => Promise<BackupUpload>;
  importBackup: (id: string, projectName?: string) => Promise<void>;
  deleteBackup: (id: string) => Promise<void>;
  uploadToDrive: (id: string, folderId?: string) => Promise<void>;
  clearError: () => void;
  resetUploadProgress: () => void;
}

export const useBackupsStore = create<BackupsState>((set, get) => ({
  backups: [],
  currentBackup: null,
  isLoading: false,
  isUploading: false,
  uploadProgress: 0,
  error: null,

  fetchBackups: async (filters) => {
    set({ isLoading: true, error: null });

    try {
      const response = await backupsApi.getAll(filters);
      const backups = response.data.data;

      set({
        backups,
        isLoading: false,
      });
    } catch (error: any) {
      set({
        error: error.message,
        isLoading: false,
      });
    }
  },

  fetchBackup: async (id) => {
    set({ isLoading: true, error: null });

    try {
      const response = await backupsApi.getById(id);
      const backup = response.data.data;

      set({
        currentBackup: backup,
        isLoading: false,
      });
    } catch (error: any) {
      set({
        error: error.message,
        isLoading: false,
      });
    }
  },

  uploadBackup: async (file) => {
    set({ isUploading: true, uploadProgress: 0, error: null });

    try {
      const response = await backupsApi.upload(file);
      const backup = response.data.data;

      set((state) => ({
        backups: [backup, ...state.backups],
        isUploading: false,
        uploadProgress: 100,
      }));

      return backup;
    } catch (error: any) {
      set({
        error: error.message,
        isUploading: false,
        uploadProgress: 0,
      });
      throw error;
    }
  },

  importBackup: async (id, projectName) => {
    set({ isLoading: true, error: null });

    try {
      await backupsApi.importBackup(id, projectName);

      // Refresh backups list
      await get().fetchBackups();

      set({ isLoading: false });
    } catch (error: any) {
      set({
        error: error.message,
        isLoading: false,
      });
      throw error;
    }
  },

  deleteBackup: async (id) => {
    set({ isLoading: true, error: null });

    try {
      await backupsApi.delete(id);

      set((state) => ({
        backups: state.backups.filter((b) => b.id !== id),
        isLoading: false,
      }));
    } catch (error: any) {
      set({
        error: error.message,
        isLoading: false,
      });
      throw error;
    }
  },

  uploadToDrive: async (id, folderId) => {
    set({ isLoading: true, error: null });

    try {
      await backupsApi.uploadToDrive(id, folderId);

      // Refresh backups list to get updated status
      await get().fetchBackups();

      set({ isLoading: false });
    } catch (error: any) {
      set({
        error: error.message,
        isLoading: false,
      });
      throw error;
    }
  },

  clearError: () => set({ error: null }),

  resetUploadProgress: () => set({ uploadProgress: 0 }),
}));
