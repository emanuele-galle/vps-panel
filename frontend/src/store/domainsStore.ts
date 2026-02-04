import { create } from 'zustand';
import { domainsApi } from '@/lib/api';
import { Domain } from '@/types';

interface DomainsState {
  domains: Domain[];
  currentDomain: Domain | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchDomains: (filters?: { projectId?: string; isActive?: boolean }) => Promise<void>;
  fetchDomain: (id: string) => Promise<void>;
  createDomain: (data: {
    domain: string;
    projectId: string;
    sslEnabled?: boolean;
  }) => Promise<Domain>;
  updateDomain: (
    id: string,
    data: {
      sslEnabled?: boolean;
      isActive?: boolean;
    }
  ) => Promise<void>;
  deleteDomain: (id: string) => Promise<void>;
  verifyDomain: (domain: string) => Promise<{
    isValid: boolean;
    records: any[];
    message: string;
  }>;
}

export const useDomainsStore = create<DomainsState>((set, get) => ({
  domains: [],
  currentDomain: null,
  isLoading: false,
  error: null,

  fetchDomains: async (filters) => {
    set({ isLoading: true, error: null });

    try {
      const response = await domainsApi.getAll(filters);
      const domains = response.data?.data || [];

      set({
        domains,
        isLoading: false,
      });
    } catch (error: any) {
      set({
        error: error.message,
        isLoading: false,
      });
    }
  },

  fetchDomain: async (id) => {
    set({ isLoading: true, error: null });

    try {
      const response = await domainsApi.getById(id);
      const domain = response.data?.data || [];

      set({
        currentDomain: domain,
        isLoading: false,
      });
    } catch (error: any) {
      set({
        error: error.message,
        isLoading: false,
      });
    }
  },

  createDomain: async (data) => {
    set({ isLoading: true, error: null });

    try {
      const response = await domainsApi.create(data);
      const domain = response.data?.data || [];

      set((state) => ({
        domains: [domain, ...state.domains],
        isLoading: false,
      }));

      return domain;
    } catch (error: any) {
      set({
        error: error.message,
        isLoading: false,
      });
      throw error;
    }
  },

  updateDomain: async (id, data) => {
    set({ isLoading: true, error: null });

    try {
      const response = await domainsApi.update(id, data);
      const updatedDomain = response.data?.data || [];

      set((state) => ({
        domains: state.domains.map((d) => (d.id === id ? updatedDomain : d)),
        currentDomain:
          state.currentDomain?.id === id ? updatedDomain : state.currentDomain,
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

  deleteDomain: async (id) => {
    set({ isLoading: true, error: null });

    try {
      await domainsApi.delete(id);

      set((state) => ({
        domains: state.domains.filter((d) => d.id !== id),
        currentDomain: state.currentDomain?.id === id ? null : state.currentDomain,
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

  verifyDomain: async (domain) => {
    set({ error: null });

    try {
      const response = await domainsApi.verify(domain);
      return response.data?.data || [];
    } catch (error: any) {
      set({
        error: error.message,
      });
      throw error;
    }
  },
}));
