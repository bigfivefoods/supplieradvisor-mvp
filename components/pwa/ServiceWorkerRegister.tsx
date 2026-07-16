'use client';

import { useEffect } from 'react';

/**
 * Registers minimal /sw.js (offline fallback + installability only).
 * Does not cache Next.js bundles (that broke Safari/Chrome after deploys).
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const allowDev = process.env.NEXT_PUBLIC_SW_DEV === '1';
    if (process.env.NODE_ENV === 'development' && !allowDev) return;

    const run = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        });
        // Force activate latest SW (clears old bad caches in activate handler)
        await reg.update();
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      } catch (e) {
        console.warn('[sw] register failed', e);
      }
    };

    void run();
  }, []);

  return null;
}
