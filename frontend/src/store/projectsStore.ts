import { create } from 'zustand';
import { projectsApi } from '@/lib/api';
import { Project, ProjectStatus } from '@/types';
import { getErrorMessage } from '@/lib/errors';
import { logStoreError, Logger } from '@/lib/logger';

const logger = Logger.create('ProjectsStore');

interface ProjectsState {
  projects: Project[];
  currentProject: Project | null;
  isLoading: boolean;
  error: string | null;
  lastUpdate: number; // Timestamp of last update for real-time sync

  // Actions
  fetchProjects: (filters?: { status?: string; template?: string }) => Promise<void>;
  fetchProject: (id: string) => Promise<void>;
  createProject: (data: {
    name: string;
    slug: string;
    description?: string;
    clientName?: string;
    clientEmail?: string;
    template: string;
  }) => Promise<Project>;
  updateProject: (
    id: string,
    data: {
      name?: string;
      description?: string;
      status?: string;
      clientName?: string;
      clientEmail?: string;
    }
  ) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  startProject: (id: string) => Promise<void>;
  stopProject: (id: string) => Promise<void>;
  restartProject: (id: string) => Promise<void>;
  syncCredentials: (id: string) => Promise<boolean>;
  
  // Real-time update handlers
  handleProjectCreated: (data: { projectId: string; project: Partial<Project> }) => void;
  handleProjectUpdated: (data: { projectId: string; changes: Partial<Project> }) => void;
  handleProjectDeleted: (data: { projectId: string }) => void;
  handleStatusChanged: (data: { projectId: string; status: ProjectStatus }) => void;
  handleCredentialsSynced: (data: { projectId: string; credentials: any }) => void;
}

export const useProjectsStore = create<ProjectsState>((set, get) => ({
  projects: [],
  currentProject: null,
  isLoading: false,
  error: null,
  lastUpdate: 0,

  fetchProjects: async (filters) => {
    set({ isLoading: true, error: null });

    try {
      const response = await projectsApi.getAll(filters);
      const projects = response.data?.data || [];

      set({
        projects,
        isLoading: false,
        lastUpdate: Date.now(),
      });
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      logStoreError(error, 'ProjectsStore', 'fetchProjects');
      set({
        error: message,
        isLoading: false,
      });
    }
  },

  fetchProject: async (id) => {
    set({ isLoading: true, error: null });

    try {
      // First sync credentials from vps-credentials.json if it exists
      try {
        const syncResponse = await projectsApi.syncCredentials(id);
        if (syncResponse.data?.data?.synced) {
          logger.debug('Credentials synced from vps-credentials.json');
        }
      } catch (syncError: unknown) {
        // Silently ignore sync errors - credentials will use existing values
        logger.debug('Credentials sync skipped', { error: getErrorMessage(syncError) });
      }

      // Then fetch the project with potentially updated credentials
      const response = await projectsApi.getById(id);
      const project = response.data.data;

      set({
        currentProject: project,
        isLoading: false,
        lastUpdate: Date.now(),
      });
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      logStoreError(error, 'ProjectsStore', 'fetchProject');
      set({
        error: message,
        isLoading: false,
      });
    }
  },

  createProject: async (data) => {
    set({ isLoading: true, error: null });

    try {
      const response = await projectsApi.create(data);
      const project = response.data.data;

      set((state) => ({
        projects: [project, ...state.projects],
        isLoading: false,
        lastUpdate: Date.now(),
      }));

      return project;
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      logStoreError(error, 'ProjectsStore', 'createProject');
      set({
        error: message,
        isLoading: false,
      });
      throw error;
    }
  },

  updateProject: async (id, data) => {
    set({ isLoading: true, error: null });

    try {
      const response = await projectsApi.update(id, data);
      const updatedProject = response.data.data;

      set((state) => ({
        projects: state.projects.map((p) =>
          p.id === id ? updatedProject : p
        ),
        currentProject:
          state.currentProject?.id === id ? updatedProject : state.currentProject,
        isLoading: false,
        lastUpdate: Date.now(),
      }));
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      logStoreError(error, 'ProjectsStore', 'updateProject');
      set({
        error: message,
        isLoading: false,
      });
      throw error;
    }
  },

  deleteProject: async (id) => {
    set({ isLoading: true, error: null });

    try {
      await projectsApi.delete(id);

      set((state) => ({
        projects: state.projects.filter((p) => p.id !== id),
        currentProject: state.currentProject?.id === id ? null : state.currentProject,
        isLoading: false,
        lastUpdate: Date.now(),
      }));
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      logStoreError(error, 'ProjectsStore', 'deleteProject');
      set({
        error: message,
        isLoading: false,
      });
      throw error;
    }
  },

  startProject: async (id) => {
    set({ isLoading: true, error: null });

    try {
      await projectsApi.start(id);

      set((state) => ({
        projects: state.projects.map((p) =>
          p.id === id ? { ...p, status: 'ACTIVE' as ProjectStatus } : p
        ),
        isLoading: false,
        lastUpdate: Date.now(),
      }));
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      logStoreError(error, 'ProjectsStore', 'startProject');
      set({
        error: message,
        isLoading: false,
      });
      throw error;
    }
  },

  stopProject: async (id) => {
    set({ isLoading: true, error: null });

    try {
      await projectsApi.stop(id);

      set((state) => ({
        projects: state.projects.map((p) =>
          p.id === id ? { ...p, status: 'INACTIVE' as ProjectStatus } : p
        ),
        isLoading: false,
        lastUpdate: Date.now(),
      }));
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      logStoreError(error, 'ProjectsStore', 'stopProject');
      set({
        error: message,
        isLoading: false,
      });
      throw error;
    }
  },

  restartProject: async (id) => {
    set({ isLoading: true, error: null });

    try {
      await projectsApi.restart(id);
      set({ isLoading: false, lastUpdate: Date.now() });
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      logStoreError(error, 'ProjectsStore', 'restartProject');
      set({
        error: message,
        isLoading: false,
      });
      throw error;
    }
  },

  syncCredentials: async (id) => {
    try {
      const response = await projectsApi.syncCredentials(id);
      const synced = response.data?.data?.synced || false;
      
      if (synced) {
        // Refresh project to get updated credentials
        await get().fetchProject(id);
      }
      
      return synced;
    } catch (error: unknown) {
      logger.warn('Failed to sync credentials', { error: getErrorMessage(error) });
      return false;
    }
  },

  // Real-time update handlers (called from WebSocket hook)
  handleProjectCreated: (data) => {
    logger.debug('Real-time: Project created', { projectId: data.projectId });
    // Fetch full project data
    get().fetchProjects();
  },

  handleProjectUpdated: (data) => {
    logger.debug('Real-time: Project updated', { projectId: data.projectId });
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === data.projectId ? { ...p, ...data.changes } : p
      ),
      currentProject:
        state.currentProject?.id === data.projectId
          ? { ...state.currentProject, ...data.changes }
          : state.currentProject,
      lastUpdate: Date.now(),
    }));
  },

  handleProjectDeleted: (data) => {
    logger.debug('Real-time: Project deleted', { projectId: data.projectId });
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== data.projectId),
      currentProject:
        state.currentProject?.id === data.projectId ? null : state.currentProject,
      lastUpdate: Date.now(),
    }));
  },

  handleStatusChanged: (data) => {
    logger.debug('Real-time: Status changed', { projectId: data.projectId, status: data.status });
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === data.projectId ? { ...p, status: data.status } : p
      ),
      currentProject:
        state.currentProject?.id === data.projectId
          ? { ...state.currentProject, status: data.status }
          : state.currentProject,
      lastUpdate: Date.now(),
    }));
  },

  handleCredentialsSynced: (data) => {
    logger.debug('Real-time: Credentials synced', { projectId: data.projectId });
    // Refresh the specific project to get updated credentials
    if (get().currentProject?.id === data.projectId) {
      get().fetchProject(data.projectId);
    }
  },
}));
