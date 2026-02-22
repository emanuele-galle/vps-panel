import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore } from '@/store/authStore';
import { authApi } from '@/lib/api';

// Mock api
vi.mock('@/lib/api', () => ({
  authApi: {
    login: vi.fn(),
    logout: vi.fn(),
    me: vi.fn(),
  },
}));

describe('authStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      isInitialized: false,
    });
  });

  it('should have correct initial state', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isLoading).toBe(false);
    expect(state.isInitialized).toBe(false);
  });

  it('should login successfully', async () => {
    const mockUser = { id: '1', email: 'test@test.com', name: 'Test', role: 'ADMIN' };
    vi.mocked(authApi.login).mockResolvedValue({
      data: { data: { user: mockUser, token: 'jwt' } },
    } as any);

    await useAuthStore.getState().login('test@test.com', 'password');

    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockUser);
    expect(state.isAuthenticated).toBe(true);
    expect(state.isLoading).toBe(false);
    expect(state.isInitialized).toBe(true);
  });

  it('should handle 2FA requirement on login', async () => {
    vi.mocked(authApi.login).mockResolvedValue({
      data: { data: { requiresTwoFactor: true } },
    } as any);

    const result = await useAuthStore.getState().login('test@test.com', 'password');

    expect(result).toEqual({ requiresTwoFactor: true });
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it('should throw and reset loading on login failure', async () => {
    vi.mocked(authApi.login).mockRejectedValue(new Error('Invalid credentials'));

    await expect(useAuthStore.getState().login('test@test.com', 'wrong'))
      .rejects.toThrow('Invalid credentials');

    expect(useAuthStore.getState().isLoading).toBe(false);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('should logout and clear state', async () => {
    // Set authenticated state first
    useAuthStore.setState({
      user: { id: '1', email: 'test@test.com', name: 'Test', role: 'ADMIN' } as any,
      isAuthenticated: true,
    });

    vi.mocked(authApi.logout).mockResolvedValue({} as any);

    await useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isInitialized).toBe(true);
  });

  it('should logout even if API call fails', async () => {
    useAuthStore.setState({
      user: { id: '1' } as any,
      isAuthenticated: true,
    });

    vi.mocked(authApi.logout).mockRejectedValue(new Error('Network error'));

    await useAuthStore.getState().logout();

    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('should fetch user successfully', async () => {
    const mockUser = { id: '1', email: 'test@test.com', name: 'Test', role: 'ADMIN' };
    vi.mocked(authApi.me).mockResolvedValue({
      data: { data: { user: mockUser } },
    } as any);

    await useAuthStore.getState().fetchUser();

    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockUser);
    expect(state.isAuthenticated).toBe(true);
    expect(state.isInitialized).toBe(true);
  });

  it('should clear auth on fetchUser failure', async () => {
    vi.mocked(authApi.me).mockRejectedValue(new Error('Unauthorized'));

    await useAuthStore.getState().fetchUser();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isInitialized).toBe(true);
  });

  it('should setUser correctly', () => {
    const mockUser = { id: '1', email: 'test@test.com', name: 'Test', role: 'ADMIN' } as any;
    useAuthStore.getState().setUser(mockUser);

    expect(useAuthStore.getState().user).toEqual(mockUser);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('should setUser to null and clear auth', () => {
    useAuthStore.setState({ user: { id: '1' } as any, isAuthenticated: true });
    useAuthStore.getState().setUser(null);

    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('should clearAuth correctly', () => {
    useAuthStore.setState({
      user: { id: '1' } as any,
      isAuthenticated: true,
      isInitialized: false,
    });

    useAuthStore.getState().clearAuth();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isInitialized).toBe(true);
  });
});
