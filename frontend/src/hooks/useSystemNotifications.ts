'use client';

import { useEffect, useRef } from 'react';

/**
 * Hook per notifiche di sistema frontend-only.
 * Le notifiche operative (deploy, resource alerts, container crashes) sono ora
 * gestite dal backend e inviate via WebSocket.
 * Questo hook gestisce solo eventi puramente frontend (es. welcome).
 */
export function useSystemNotifications() {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Welcome message on first visit (localStorage only, no backend)
    const hasSeenWelcome = localStorage.getItem('vps-welcome-seen');
    if (!hasSeenWelcome) {
      localStorage.setItem('vps-welcome-seen', 'true');
    }
  }, []);
}
