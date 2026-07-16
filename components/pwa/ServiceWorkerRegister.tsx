'use client';

import { useEffect } from 'react';

/**
 * Registers /sw.js once on the client (production + preview).
 * Dev: only when NEXT_PUBLIC_SW_DEV=1 to avoid HMR fights.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const allowDev = process.env.NEXT_PUBLIC_SW_DEV === '1';
    if (process.env.NODE_ENV === 'development' && !allowDev) return;

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        });
        // Check for updates periodically when tab is visible
        const onVis = () => {
          if (document.visibilityState === 'visible') {
            void reg.update();
          }
        };
        document.addEventListener('visibilitychange', onVis);
        return () => document.removeEventListener('visibilitychange', onVis);
      } catch (e) {
        console.warn('[sw] register failed', e);
      }
    };

    void register();
  }, []);

  return null;
}
