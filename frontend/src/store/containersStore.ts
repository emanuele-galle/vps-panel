import { create } from 'zustand';
import { dockerApi, monitoringApi } from '@/lib/api';
import { DockerContainer, ContainerStats } from '@/types';
import { getErrorMessage } from '@/lib/errors';
import { logStoreError } from '@/lib/logger';

interface ContainerStorageInfo {
  id: string;
  name: string;
  size: number;
  sizeFormatted: string;
  virtualSize: number;
  virtualSizeFormatted: string;
}

// State object from docker inspect
interface ContainerState {
  Status?: string;
  Running?: boolean;
  Paused?: boolean;
  Restarting?: boolean;
  OOMKilled?: boolean;
  Dead?: boolean;
  Pid?: number;
  ExitCode?: number;
  Error?: string;
  StartedAt?: string;
  FinishedAt?: string;
}

// Detailed container info from Docker API (docker inspect format)
// Uses Omit to override State type from DockerContainer
interface ContainerDetail extends Omit<DockerContainer, 'State'> {
  Name?: string; // Docker inspect returns Name (single string with leading /)
  State?: ContainerState | string; // Can be string (from list) or object (from inspect)
  Config?: {
    Env?: string[];
    Cmd?: string[];
    Image?: string;
    Hostname?: string;
  };
  NetworkSettings?: {
    Networks: Record<string, {
      IPAddress: string;
      Gateway: string;
      MacAddress: string;
    }>;
    Ports?: Record<string, Array<{ HostIp: string; HostPort: string }> | null>;
  };
  HostConfig?: {
    Memory?: number;
    CpuShares?: number;
    RestartPolicy?: {
      Name: string;
      MaximumRetryCount: number;
    };
  };
}

// Type guard to check if State is an object
function isContainerStateObject(state: ContainerState | string | undefined): state is ContainerState {
  return typeof state === 'object' && state !== null;
}

// Helper to get status from State (handles both string and object)
function getContainerStatus(state: ContainerState | string | undefined): string {
  if (!state) return 'unknown';
  if (typeof state === 'string') return state;
  return state.Status || 'unknown';
}

// Helper to get StartedAt from State
function getContainerStartedAt(state: ContainerState | string | undefined): string | undefined {
  if (!state || typeof state === 'string') return undefined;
  return state.StartedAt;
}

interface ContainersState {
  containers: DockerContainer[];
  currentContainer: ContainerDetail | null;
  containerStats: ContainerStats | null;
  containerSizes: Record<string, ContainerStorageInfo>;
  isLoading: boolean;
  isLoadingSizes: boolean;
  error: string | null;

  // Actions
  fetchContainers: (all?: boolean) => Promise<void>;
  fetchContainer: (id: string) => Promise<void>;
  fetchContainerStats: (id: string) => Promise<void>;
  fetchContainerSizes: () => Promise<void>;
  startContainer: (id: string) => Promise<void>;
  stopContainer: (id: string) => Promise<void>;
  restartContainer: (id: string) => Promise<void>;
  removeContainer: (id: string, force?: boolean) => Promise<void>;
}

export const useContainersStore = create<ContainersState>((set) => ({
  containers: [],
  currentContainer: null,
  containerStats: null,
  containerSizes: {},
  isLoading: false,
  isLoadingSizes: false,
  error: null,

  fetchContainers: async (all = true) => {
    set({ isLoading: true, error: null });

    try {
      const response = await dockerApi.listContainers(all);
      const containers = response.data?.data || [];

      set({
        containers,
        isLoading: false,
      });
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      logStoreError(error, 'ContainersStore', 'fetchContainers');
      set({
        error: message,
        isLoading: false,
      });
    }
  },

  fetchContainer: async (id) => {
    set({ isLoading: true, error: null });

    try {
      const response = await dockerApi.getContainer(id);
      const container = response.data?.data || null;

      set({
        currentContainer: container as ContainerDetail,
        isLoading: false,
      });
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      logStoreError(error, 'ContainersStore', 'fetchContainer');
      set({
        error: message,
        isLoading: false,
      });
    }
  },

  fetchContainerStats: async (id) => {
    set({ error: null });

    try {
      const response = await dockerApi.getContainerStats(id);
      const stats = response.data?.data || null;

      set({
        containerStats: stats as ContainerStats,
      });
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      logStoreError(error, 'ContainersStore', 'fetchContainerStats');
      set({
        error: message,
      });
    }
  },

  fetchContainerSizes: async () => {
    set({ isLoadingSizes: true });

    try {
      const response = await monitoringApi.getContainersStorage();
      const containers = response.data?.data?.containers || [];

      // Create a map by container ID (first 12 chars) and name
      const sizesMap: Record<string, ContainerStorageInfo> = {};
      containers.forEach((c: ContainerStorageInfo) => {
        if (c.id) {
          sizesMap[c.id] = c;
        }
        if (c.name) {
          sizesMap[c.name] = c;
        }
      });

      set({
        containerSizes: sizesMap,
        isLoadingSizes: false,
      });
    } catch (error: unknown) {
      logStoreError(error, 'ContainersStore', 'fetchContainerSizes');
      set({
        isLoadingSizes: false,
      });
    }
  },

  startContainer: async (id) => {
    set({ isLoading: true, error: null });

    try {
      await dockerApi.startContainer(id);

      // Update container state in list
      set((state) => ({
        containers: state.containers.map((c) =>
          c.Id === id ? { ...c, State: 'running', Status: 'Up' } : c
        ),
        isLoading: false,
      }));
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      logStoreError(error, 'ContainersStore', 'startContainer');
      set({
        error: message,
        isLoading: false,
      });
      throw error;
    }
  },

  stopContainer: async (id) => {
    set({ isLoading: true, error: null });

    try {
      await dockerApi.stopContainer(id);

      // Update container state in list
      set((state) => ({
        containers: state.containers.map((c) =>
          c.Id === id ? { ...c, State: 'exited', Status: 'Exited' } : c
        ),
        isLoading: false,
      }));
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      logStoreError(error, 'ContainersStore', 'stopContainer');
      set({
        error: message,
        isLoading: false,
      });
      throw error;
    }
  },

  restartContainer: async (id) => {
    set({ isLoading: true, error: null });

    try {
      await dockerApi.restartContainer(id);

      // Update container state in list
      set((state) => ({
        containers: state.containers.map((c) =>
          c.Id === id ? { ...c, State: 'running', Status: 'Up' } : c
        ),
        isLoading: false,
      }));
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      logStoreError(error, 'ContainersStore', 'restartContainer');
      set({
        error: message,
        isLoading: false,
      });
      throw error;
    }
  },

  removeContainer: async (id, force = false) => {
    set({ isLoading: true, error: null });

    try {
      await dockerApi.removeContainer(id, force);

      // Remove container from list
      set((state) => ({
        containers: state.containers.filter((c) => c.Id !== id),
        currentContainer:
          state.currentContainer?.Id === id ? null : state.currentContainer,
        isLoading: false,
      }));
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      logStoreError(error, 'ContainersStore', 'removeContainer');
      set({
        error: message,
        isLoading: false,
      });
      throw error;
    }
  },
}));

// Export types and helpers for use in components
export type { ContainerDetail, ContainerState };
export { isContainerStateObject, getContainerStatus, getContainerStartedAt };
