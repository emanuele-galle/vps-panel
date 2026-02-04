'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

const navigationMap: Record<string, string> = {
  'd': '/dashboard',
  'p': '/dashboard/projects',
  'c': '/dashboard/containers',
  'b': '/dashboard/databases',
  'm': '/dashboard/monitoring',
  's': '/dashboard/settings',
  'e': '/dashboard/email',
  'a': '/dashboard/activity',
  'k': '/dashboard/backups',
  'o': '/dashboard/domains',
};

export function useKeyboardNavigation() {
  const router = useRouter();
  const lastKeyRef = useRef<string | null>(null);
  const lastKeyTimeRef = useRef<number>(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if in input/textarea or if modifier keys are pressed
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey
      ) {
        return;
      }

      const now = Date.now();
      const key = e.key.toLowerCase();

      // Check for G + key pattern (within 500ms)
      if (lastKeyRef.current === 'g' && now - lastKeyTimeRef.current < 500) {
        const path = navigationMap[key];
        if (path) {
          e.preventDefault();
          router.push(path);
        }
        lastKeyRef.current = null;
        return;
      }

      // Store the current key
      if (key === 'g') {
        lastKeyRef.current = 'g';
        lastKeyTimeRef.current = now;
      } else {
        lastKeyRef.current = null;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [router]);
}
