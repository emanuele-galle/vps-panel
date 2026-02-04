'use client';

import { useAuth } from '@/hooks/useAuth';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { KeyboardShortcutsModal } from '@/components/ui/keyboard-shortcuts-modal';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { useKeyboardNavigation } from '@/hooks/useKeyboardNavigation';
import { useSystemNotifications } from '@/hooks/useSystemNotifications';
import { ErrorBoundary } from '@/components/error-boundary';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoading } = useAuth(true);

  // Enable keyboard navigation (G+key shortcuts)
  useKeyboardNavigation();

  // Enable system notifications
  useSystemNotifications();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Caricamento...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-muted/50">
      {/* Sidebar - nascosta su mobile/tablet, visibile da lg in su */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <Header />

        {/* Breadcrumb - visible below header */}
        <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="px-4 sm:px-6 py-2">
            <Breadcrumb />
          </div>
        </div>

        {/* Page Content - padding responsive */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
      </div>

      {/* Keyboard Shortcuts Help Modal (press ? to open) */}
      <KeyboardShortcutsModal />
    </div>
  );
}
