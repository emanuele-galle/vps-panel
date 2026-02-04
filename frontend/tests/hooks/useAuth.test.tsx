import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useAuth } from '@/hooks/useAuth'
import { useAuthStore } from '@/store/authStore'
import { useRouter } from 'next/navigation'

vi.mock('@/store/authStore')
vi.mock('next/navigation')

describe('useAuth Hook', () => {
  const mockPush = vi.fn()
  const mockFetchUser = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup router mock
    vi.mocked(useRouter).mockReturnValue({
      push: mockPush,
      replace: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
      prefetch: vi.fn(),
    } as any)

    // Setup authStore mock with default values
    vi.mocked(useAuthStore).mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      isInitialized: false,
      fetchUser: mockFetchUser,
      login: vi.fn(),
      logout: vi.fn(),
      setUser: vi.fn(),
      clearAuth: vi.fn(),
    })
  })

  describe('Initialization', () => {
    it('fetches user on mount when not initialized', () => {
      renderHook(() => useAuth(false))

      expect(mockFetchUser).toHaveBeenCalledTimes(1)
    })

    it('does not fetch user when already initialized', () => {
      vi.mocked(useAuthStore).mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        isInitialized: true,
        fetchUser: mockFetchUser,
      } as any)

      renderHook(() => useAuth(false))

      expect(mockFetchUser).not.toHaveBeenCalled()
    })

    it('does not fetch user when loading', () => {
      vi.mocked(useAuthStore).mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: true,
        isInitialized: false,
        fetchUser: mockFetchUser,
      } as any)

      renderHook(() => useAuth(false))

      expect(mockFetchUser).not.toHaveBeenCalled()
    })
  })

  describe('Authentication Required', () => {
    it('redirects to login when auth required and not authenticated', async () => {
      vi.mocked(useAuthStore).mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        isInitialized: true,
        fetchUser: mockFetchUser,
      } as any)

      renderHook(() => useAuth(true))

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/login')
      })
    })

    it('does not redirect when loading', () => {
      vi.mocked(useAuthStore).mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: true,
        isInitialized: true,
        fetchUser: mockFetchUser,
      } as any)

      renderHook(() => useAuth(true))

      expect(mockPush).not.toHaveBeenCalled()
    })

    it('does not redirect when authenticated', () => {
      vi.mocked(useAuthStore).mockReturnValue({
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
        isLoading: false,
        isInitialized: true,
        fetchUser: mockFetchUser,
      } as any)

      renderHook(() => useAuth(true))

      expect(mockPush).not.toHaveBeenCalled()
    })
  })

  describe('Authentication Not Required', () => {
    beforeEach(() => {
      // Mock window.location.pathname
      Object.defineProperty(window, 'location', {
        value: {
          pathname: '/login',
        },
        writable: true,
      })
    })

    it('redirects to dashboard from login when authenticated', async () => {
      vi.mocked(useAuthStore).mockReturnValue({
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
        isLoading: false,
        isInitialized: true,
        fetchUser: mockFetchUser,
      } as any)

      renderHook(() => useAuth(false))

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard')
      })
    })

    it('redirects to dashboard from register when authenticated', async () => {
      Object.defineProperty(window, 'location', {
        value: {
          pathname: '/register',
        },
        writable: true,
      })

      vi.mocked(useAuthStore).mockReturnValue({
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
        isLoading: false,
        isInitialized: true,
        fetchUser: mockFetchUser,
      } as any)

      renderHook(() => useAuth(false))

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard')
      })
    })

    it('does not redirect from other pages when authenticated', () => {
      Object.defineProperty(window, 'location', {
        value: {
          pathname: '/about',
        },
        writable: true,
      })

      vi.mocked(useAuthStore).mockReturnValue({
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
        isLoading: false,
        isInitialized: true,
        fetchUser: mockFetchUser,
      } as any)

      renderHook(() => useAuth(false))

      expect(mockPush).not.toHaveBeenCalled()
    })

    it('does not redirect when not authenticated', () => {
      vi.mocked(useAuthStore).mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        isInitialized: true,
        fetchUser: mockFetchUser,
      } as any)

      renderHook(() => useAuth(false))

      expect(mockPush).not.toHaveBeenCalled()
    })
  })

  describe('Return Values', () => {
    it('returns user, isAuthenticated and isLoading', () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'ADMIN' as const,
        isActive: true,
        twoFactorEnabled: false,
        createdAt: new Date().toISOString(),
      }

      vi.mocked(useAuthStore).mockReturnValue({
        user: mockUser,
        isAuthenticated: true,
        isLoading: false,
        isInitialized: true,
        fetchUser: mockFetchUser,
      } as any)

      const { result } = renderHook(() => useAuth(false))

      expect(result.current.user).toEqual(mockUser)
      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.isLoading).toBe(false)
    })

    it('returns null user when not authenticated', () => {
      vi.mocked(useAuthStore).mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        isInitialized: true,
        fetchUser: mockFetchUser,
      } as any)

      const { result } = renderHook(() => useAuth(false))

      expect(result.current.user).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
    })
  })
})
