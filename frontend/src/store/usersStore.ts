import { create } from 'zustand';
import api from '@/lib/api';

export type UserRole = 'ADMIN' | 'STAFF';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  twoFactorEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserStats {
  total: number;
  admins: number;
  staff: number;
  active: number;
  inactive: number;
  with2FA: number;
}

interface CreateUserData {
  email: string;
  password: string;
  name: string;
  role?: UserRole;
}

interface UpdateUserData {
  email?: string;
  name?: string;
  role?: UserRole;
  isActive?: boolean;
  twoFactorEnabled?: boolean;
}

interface UsersState {
  users: User[];
  stats: UserStats | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchUsers: () => Promise<void>;
  fetchUserStats: () => Promise<void>;
  getUserById: (id: string) => Promise<User | null>;
  createUser: (data: CreateUserData) => Promise<User>;
  updateUser: (id: string, data: UpdateUserData) => Promise<User>;
  deleteUser: (id: string) => Promise<void>;
  changeUserPassword: (id: string, newPassword: string) => Promise<void>;
  toggleUserStatus: (id: string) => Promise<User>;
  searchUsers: (query: string) => Promise<void>;
}

export const useUsersStore = create<UsersState>((set, get) => ({
  users: [],
  stats: null,
  isLoading: false,
  error: null,

  fetchUsers: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get('/users');
      set({ users: response.data.data, isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.error || 'Failed to fetch users',
        isLoading: false,
      });
    }
  },

  fetchUserStats: async () => {
    try {
      const response = await api.get('/users/stats');
      set({ stats: response.data.data });
    } catch (error: any) {
      console.error('Failed to fetch user stats:', error);
    }
  },

  getUserById: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get(`/api/users/${id}`);
      set({ isLoading: false });
      return response.data.data;
    } catch (error: any) {
      set({
        error: error.response?.data?.error || 'Failed to fetch user',
        isLoading: false,
      });
      return null;
    }
  },

  createUser: async (data: CreateUserData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/users', data);
      const newUser = response.data.data;

      // Add to list
      const { users } = get();
      set({ users: [newUser, ...users], isLoading: false });

      return newUser;
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to create user';
      set({ error: errorMessage, isLoading: false });
      throw new Error(errorMessage);
    }
  },

  updateUser: async (id: string, data: UpdateUserData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.patch(`/api/users/${id}`, data);
      const updatedUser = response.data.data;

      // Update in list
      const { users } = get();
      const updatedUsers = users.map((user) =>
        user.id === id ? updatedUser : user
      );

      set({ users: updatedUsers, isLoading: false });
      return updatedUser;
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to update user';
      set({ error: errorMessage, isLoading: false });
      throw new Error(errorMessage);
    }
  },

  deleteUser: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.delete(`/api/users/${id}`);

      // Remove from list
      const { users } = get();
      const updatedUsers = users.filter((user) => user.id !== id);

      set({ users: updatedUsers, isLoading: false });
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to delete user';
      set({ error: errorMessage, isLoading: false });
      throw new Error(errorMessage);
    }
  },

  changeUserPassword: async (id: string, newPassword: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.post(`/api/users/${id}/password`, { newPassword });
      set({ isLoading: false });
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to change password';
      set({ error: errorMessage, isLoading: false });
      throw new Error(errorMessage);
    }
  },

  toggleUserStatus: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post(`/api/users/${id}/toggle-status`);
      const updatedUser = response.data.data;

      // Update in list
      const { users } = get();
      const updatedUsers = users.map((user) =>
        user.id === id ? updatedUser : user
      );

      set({ users: updatedUsers, isLoading: false });
      return updatedUser;
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to toggle user status';
      set({ error: errorMessage, isLoading: false });
      throw new Error(errorMessage);
    }
  },

  searchUsers: async (query: string) => {
    if (!query.trim()) {
      await get().fetchUsers();
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const response = await api.get('/users/search', {
        params: { q: query },
      });
      set({ users: response.data.data, isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.error || 'Failed to search users',
        isLoading: false,
      });
    }
  },
}));
