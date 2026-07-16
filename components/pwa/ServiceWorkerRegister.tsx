'use client';

import { useEffect } from 'react';

/**
 * Registers /sw.js — required for Android “Install app” / Add to Home Screen.
 * Production always; dev only when NEXT_PUBLIC_SW_DEV=1.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    const allowDev = process.env.NEXT_PUBLIC_SW_DEV === '1';
    const isProd = process.env.NODE_ENV === 'production';
    if (!isProd && !allowDev) return;

    let cancelled = false;

    const register = async () => {
      try {
        // Unregister ancient broken workers that may block install
        const existing = await navigator.serviceWorker.getRegistrations();
        for (const reg of existing) {
          const script = reg.active?.scriptURL || reg.installing?.scriptURL || '';
          if (script && !script.endsWith('/sw.js') && !script.includes('/sw.js')) {
            try {
              await reg.unregister();
            } catch {
              /* ignore */
            }
          }
        }

        const reg = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        });

        if (cancelled) return;

        // Force update check so install criteria see a controlling SW sooner
        try {
          await reg.update();
        } catch {
          /* ignore */
        }

        // Wait until SW is active (helps Chrome installability)
        if (reg.installing) {
          await new Promise<void>((resolve) => {
            const sw = reg.installing;
            if (!sw) {
              resolve();
              return;
            }
            sw.addEventListener('statechange', () => {
              if (sw.state === 'activated' || sw.state === 'redundant') resolve();
            });
          });
        }

        if (process.env.NODE_ENV !== 'production') {
          console.info('[sw] registered', reg.scope);
        }
      } catch (e) {
        console.warn('[sw] register failed', e);
      }
    };

    // Delay slightly so first paint isn’t blocked; still early enough for install
    const t = window.setTimeout(() => {
      void register();
    }, 800);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, []);

  return null;
}
