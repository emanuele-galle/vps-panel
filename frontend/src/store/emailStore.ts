import { create } from 'zustand';
import api from '@/lib/api';

export interface EmailAccount {
  id: string;
  email: string;
  hostingerId?: string;
  quota: number;
  usedSpace?: number;
  forwardTo?: string;
  autoReply: boolean;
  autoReplyMsg?: string;
  isActive: boolean;
  clientName?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmailStats {
  total: number;
  active: number;
  inactive: number;
  totalQuota: number;
  totalUsed: number;
}

interface CreateEmailData {
  email: string;
  password: string;
  quota?: number;
  clientName?: string;
  notes?: string;
}

interface UpdateEmailData {
  quota?: number;
  forwardTo?: string;
  autoReply?: boolean;
  autoReplyMsg?: string;
  isActive?: boolean;
  clientName?: string;
  notes?: string;
}

interface EmailState {
  emails: EmailAccount[];
  stats: EmailStats | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchEmails: () => Promise<void>;
  fetchEmailStats: () => Promise<void>;
  getEmailById: (id: string) => Promise<EmailAccount | null>;
  createEmail: (data: CreateEmailData) => Promise<EmailAccount>;
  updateEmail: (id: string, data: UpdateEmailData) => Promise<EmailAccount>;
  deleteEmail: (id: string) => Promise<void>;
  changePassword: (id: string, newPassword: string) => Promise<void>;
  syncFromHostinger: () => Promise<void>;
}

export const useEmailStore = create<EmailState>((set, get) => ({
  emails: [],
  stats: null,
  isLoading: false,
  error: null,

  fetchEmails: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get('/email');
      set({ emails: response.data.data, isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.error || 'Failed to fetch email accounts',
        isLoading: false,
      });
    }
  },

  fetchEmailStats: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get('/email/stats');
      set({ stats: response.data.data, isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.error || 'Failed to fetch email statistics',
        isLoading: false,
      });
    }
  },

  getEmailById: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get(`/api/email/${id}`);
      set({ isLoading: false });
      return response.data.data;
    } catch (error: any) {
      set({
        error: error.response?.data?.error || 'Failed to fetch email account',
        isLoading: false,
      });
      return null;
    }
  },

  createEmail: async (data: CreateEmailData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/email', data);
      const newEmail = response.data.data;

      // Add to list
      const { emails } = get();
      set({ emails: [newEmail, ...emails], isLoading: false });

      return newEmail;
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to create email account';
      set({ error: errorMessage, isLoading: false });
      throw new Error(errorMessage);
    }
  },

  updateEmail: async (id: string, data: UpdateEmailData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.patch(`/api/email/${id}`, data);
      const updatedEmail = response.data.data;

      // Update in list
      const { emails } = get();
      const updatedEmails = emails.map((email) =>
        email.id === id ? updatedEmail : email
      );

      set({ emails: updatedEmails, isLoading: false });
      return updatedEmail;
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to update email account';
      set({ error: errorMessage, isLoading: false });
      throw new Error(errorMessage);
    }
  },

  deleteEmail: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.delete(`/api/email/${id}`);

      // Remove from list
      const { emails } = get();
      const updatedEmails = emails.filter((email) => email.id !== id);

      set({ emails: updatedEmails, isLoading: false });
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to delete email account';
      set({ error: errorMessage, isLoading: false });
      throw new Error(errorMessage);
    }
  },

  changePassword: async (id: string, newPassword: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.post(`/api/email/${id}/password`, { newPassword });
      set({ isLoading: false });
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to change password';
      set({ error: errorMessage, isLoading: false });
      throw new Error(errorMessage);
    }
  },

  syncFromHostinger: async () => {
    set({ isLoading: true, error: null });
    try {
      await api.post('/email/sync');
      // Refresh email list after sync
      await get().fetchEmails();
      set({ isLoading: false });
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to sync from Hostinger';
      set({ error: errorMessage, isLoading: false });
      throw new Error(errorMessage);
    }
  },
}));
