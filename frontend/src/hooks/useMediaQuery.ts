'use client';

import { useState, useEffect } from 'react';

/**
 * Hook per rilevare media queries responsive
 * @param query - Media query string (es. '(max-width: 767px)')
 * @returns boolean - true se la query matcha
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);

    // Imposta valore iniziale
    setMatches(media.matches);

    // Listener per cambiamenti
    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    media.addEventListener('change', listener);

    return () => media.removeEventListener('change', listener);
  }, [query]);

  return matches;
}

// Hook predefiniti per breakpoints comuni
export const useIsMobile = () => useMediaQuery('(max-width: 767px)');
export const useIsTablet = () => useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)');
