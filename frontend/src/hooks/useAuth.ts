import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

export function useAuth(requireAuth: boolean = false) {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, isInitialized, fetchUser } = useAuthStore();

  useEffect(() => {
    // Fetch user on mount only if not already initialized
    // This prevents infinite loops when fetchUser fails
    if (!isInitialized && !isLoading) {
      fetchUser();
    }
  }, [isInitialized, isLoading, fetchUser]);

  useEffect(() => {
    // Redirect if authentication is required but user is not authenticated
    if (requireAuth && !isLoading && !isAuthenticated) {
      router.push('/login');
    }

    // Redirect to dashboard if user is authenticated but on auth pages
    if (!requireAuth && !isLoading && isAuthenticated) {
      const currentPath = window.location.pathname;
      if (currentPath === '/login' || currentPath === '/register') {
        router.push('/dashboard');
      }
    }
  }, [requireAuth, isLoading, isAuthenticated, router]);

  return {
    user,
    isAuthenticated,
    isLoading,
  };
}
