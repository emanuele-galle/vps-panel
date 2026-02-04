import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAuthStore } from '@/store/authStore'
import { authApi } from '@/lib/api'

// Mock the API
vi.mock('@/lib/api', () => ({
  authApi: {
    login: vi.fn(),
    logout: vi.fn(),
    me: vi.fn(),
  },
}))

describe('authStore', () => {
  beforeEach(() => {
    // Reset store state
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      isInitialized: false,
    })

    // Reset mocks
    vi.clearAllMocks()
  })

  describe('Initial State', () => {
    it('has correct initial state', () => {
      const state = useAuthStore.getState()
      
      expect(state.user).toBeNull()
      expect(state.isAuthenticated).toBe(false)
      expect(state.isLoading).toBe(false)
      expect(state.isInitialized).toBe(false)
    })
  })

  describe('login', () => {
    it('successfully logs in user', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'ADMIN' as const,
        isActive: true,
        twoFactorEnabled: false,
        createdAt: new Date().toISOString(),
      }

      vi.mocked(authApi.login).mockResolvedValue({
        data: {
          success: true,
          data: { user: mockUser },
        },
      } as any)

      const { login } = useAuthStore.getState()
      const result = await login('test@example.com', 'password')

      expect(authApi.login).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password',
        twoFactorCode: undefined,
      })

      const state = useAuthStore.getState()
      expect(state.user).toEqual(mockUser)
      expect(state.isAuthenticated).toBe(true)
      expect(state.isLoading).toBe(false)
      expect(state.isInitialized).toBe(true)
      expect(result).toEqual({})
    })

    it('returns requiresTwoFactor when 2FA is needed', async () => {
      vi.mocked(authApi.login).mockResolvedValue({
        data: {
          success: true,
          data: { requiresTwoFactor: true },
        },
      } as any)

      const { login } = useAuthStore.getState()
      const result = await login('test@example.com', 'password')

      expect(result).toEqual({ requiresTwoFactor: true })

      const state = useAuthStore.getState()
      expect(state.user).toBeNull()
      expect(state.isAuthenticated).toBe(false)
      expect(state.isLoading).toBe(false)
    })

    it('handles login error', async () => {
      const error = new Error('Invalid credentials')
      vi.mocked(authApi.login).mockRejectedValue(error)

      const { login } = useAuthStore.getState()

      await expect(login('test@example.com', 'wrong'))
        .rejects.toThrow('Invalid credentials')

      const state = useAuthStore.getState()
      expect(state.user).toBeNull()
      expect(state.isAuthenticated).toBe(false)
      expect(state.isLoading).toBe(false)
    })

    it('supports two-factor authentication code', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'ADMIN' as const,
        isActive: true,
        twoFactorEnabled: true,
        createdAt: new Date().toISOString(),
      }

      vi.mocked(authApi.login).mockResolvedValue({
        data: {
          success: true,
          data: { user: mockUser },
        },
      } as any)

      const { login } = useAuthStore.getState()
      await login('test@example.com', 'password', '123456')

      expect(authApi.login).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password',
        twoFactorCode: '123456',
      })
    })
  })

  describe('logout', () => {
    it('successfully logs out user', async () => {
      // Setup authenticated state
      useAuthStore.setState({
        user: {
          id: '1',
          email: 'test@example.com',
          name: 'Test User',
          role: 'ADMIN',
          isActive: true,
          twoFactorEnabled: false,
          createdAt: new Date().toISOString(),
        },
        isAuthenticated: true,
        isInitialized: true,
      })

      vi.mocked(authApi.logout).mockResolvedValue({ data: { success: true } } as any)

      const { logout } = useAuthStore.getState()
      await logout()

      expect(authApi.logout).toHaveBeenCalled()

      const state = useAuthStore.getState()
      expect(state.user).toBeNull()
      expect(state.isAuthenticated).toBe(false)
      expect(state.isInitialized).toBe(true)
    })

    it('clears state even if API call fails', async () => {
      // Setup authenticated state
      useAuthStore.setState({
        user: {
          id: '1',
          email: 'test@example.com',
          name: 'Test User',
          role: 'ADMIN',
          isActive: true,
          twoFactorEnabled: false,
          createdAt: new Date().toISOString(),
        },
        isAuthenticated: true,
      })

      vi.mocked(authApi.logout).mockRejectedValue(new Error('Network error'))

      const { logout } = useAuthStore.getState()
      await logout()

      const state = useAuthStore.getState()
      expect(state.user).toBeNull()
      expect(state.isAuthenticated).toBe(false)
    })
  })

  describe('fetchUser', () => {
    it('successfully fetches user', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'ADMIN' as const,
        isActive: true,
        twoFactorEnabled: false,
        createdAt: new Date().toISOString(),
      }

      vi.mocked(authApi.me).mockResolvedValue({
        data: {
          success: true,
          data: { user: mockUser },
        },
      } as any)

      const { fetchUser } = useAuthStore.getState()
      await fetchUser()

      const state = useAuthStore.getState()
      expect(state.user).toEqual(mockUser)
      expect(state.isAuthenticated).toBe(true)
      expect(state.isLoading).toBe(false)
      expect(state.isInitialized).toBe(true)
    })

    it('clears state when user is not authenticated', async () => {
      vi.mocked(authApi.me).mockRejectedValue(new Error('Unauthorized'))

      const { fetchUser } = useAuthStore.getState()
      await fetchUser()

      const state = useAuthStore.getState()
      expect(state.user).toBeNull()
      expect(state.isAuthenticated).toBe(false)
      expect(state.isLoading).toBe(false)
      expect(state.isInitialized).toBe(true)
    })
  })

  describe('setUser', () => {
    it('sets user and authenticated state', () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'ADMIN' as const,
        isActive: true,
        twoFactorEnabled: false,
        createdAt: new Date().toISOString(),
      }

      const { setUser } = useAuthStore.getState()
      setUser(mockUser)

      const state = useAuthStore.getState()
      expect(state.user).toEqual(mockUser)
      expect(state.isAuthenticated).toBe(true)
    })

    it('clears authenticated state when user is null', () => {
      // Setup authenticated state
      useAuthStore.setState({
        user: {
          id: '1',
          email: 'test@example.com',
          name: 'Test User',
          role: 'ADMIN',
          isActive: true,
          twoFactorEnabled: false,
          createdAt: new Date().toISOString(),
        },
        isAuthenticated: true,
      })

      const { setUser } = useAuthStore.getState()
      setUser(null)

      const state = useAuthStore.getState()
      expect(state.user).toBeNull()
      expect(state.isAuthenticated).toBe(false)
    })
  })

  describe('clearAuth', () => {
    it('clears all auth state', () => {
      // Setup authenticated state
      useAuthStore.setState({
        user: {
          id: '1',
          email: 'test@example.com',
          name: 'Test User',
          role: 'ADMIN',
          isActive: true,
          twoFactorEnabled: false,
          createdAt: new Date().toISOString(),
        },
        isAuthenticated: true,
        isInitialized: false,
      })

      const { clearAuth } = useAuthStore.getState()
      clearAuth()

      const state = useAuthStore.getState()
      expect(state.user).toBeNull()
      expect(state.isAuthenticated).toBe(false)
      expect(state.isInitialized).toBe(true)
    })
  })
})
