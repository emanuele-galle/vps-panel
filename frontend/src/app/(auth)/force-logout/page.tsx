'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

export default function ForceLogoutPage() {
  const router = useRouter();
  const clearAuth = useAuthStore((state) => state.clearAuth);

  useEffect(() => {
    const forceLogout = async () => {
      try {
        // Call logout API to clear HttpOnly cookies on backend
        await authApi.logout();
      } catch (error) {
        // Ignore errors - we're force logging out anyway
      }

      // Clear local state
      clearAuth();

      // Clear session storage
      sessionStorage.clear();

      // Redirect to login after a brief delay
      setTimeout(() => {
        router.push('/login');
      }, 500);
    };

    forceLogout();
  }, [router, clearAuth]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Disconnessione in corso...</p>
      </div>
    </div>
  );
}
