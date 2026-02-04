import { create } from 'zustand';
import { authApi } from '@/lib/api';
import { User } from '@/types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;

  // Actions
  login: (email: string, password: string, twoFactorCode?: string) => Promise<{ requiresTwoFactor?: boolean }>;
  logout: () => Promise<void>;
  fetchUser: () => Promise<void>;
  setUser: (user: User | null) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  isInitialized: false,

  login: async (email: string, password: string, twoFactorCode?: string) => {
    set({ isLoading: true });

    try {
      const response = await authApi.login({ email, password, twoFactorCode });

      if (response.data.data?.requiresTwoFactor) {
        set({ isLoading: false });
        return { requiresTwoFactor: true };
      }

      const { user } = response.data.data;
      // NOTE: Tokens are stored in HttpOnly cookies by the backend
      // No need to store them in localStorage

      set({
        user,
        isAuthenticated: true,
        isLoading: false,
        isInitialized: true,
      });

      return {};
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    try {
      // This will clear the HttpOnly cookies on the backend
      await authApi.logout();
    } catch (error) {
      // Ignore errors on logout - still clear local state
    }

    set({
      user: null,
      isAuthenticated: false,
      isInitialized: true,
    });
  },

  fetchUser: async () => {
    set({ isLoading: true });

    try {
      // This will use cookies automatically (withCredentials: true)
      const response = await authApi.me();
      const user = response.data.data.user;

      set({
        user,
        isAuthenticated: true,
        isLoading: false,
        isInitialized: true,
      });
    } catch (error) {
      // Not authenticated or token expired
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        isInitialized: true,
      });
    }
  },

  setUser: (user) => set({ user, isAuthenticated: !!user }),

  clearAuth: () => set({
    user: null,
    isAuthenticated: false,
    isInitialized: true,
  }),
}));
