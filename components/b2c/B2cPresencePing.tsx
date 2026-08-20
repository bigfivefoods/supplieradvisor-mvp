'use client';

/**
 * Quiet heartbeat so the platform console can report last login,
 * which PWA/site was open, and time in session.
 */
import { useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { getCanonicalUserId } from '@/lib/auth/identity';

function isStandalonePwa() {
  if (typeof window === 'undefined') return false;
  try {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      Boolean(
        (window.navigator as Navigator & { standalone?: boolean }).standalone
      )
    );
  } catch {
    return false;
  }
}

export function B2cPresencePing({
  surface,
  brand,
}: {
  surface?: string;
  brand?: string;
}) {
  const { ready, authenticated, user } = usePrivy();

  useEffect(() => {
    if (!ready || !authenticated) return;
    const ping = () => {
      const standalone = isStandalonePwa();
      const path =
        typeof window !== 'undefined' ? window.location.pathname : '';
      void fetch('/api/b2c/me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          action: 'presence',
          surface,
          path,
          display: standalone ? 'standalone' : 'browser',
          source: standalone ? 'pwa' : 'web',
          brand,
          privyUserId: getCanonicalUserId(user?.id),
        }),
      }).catch(() => {});
    };
    ping();
    const t = window.setInterval(ping, 120_000);
    const onVis = () => {
      if (document.visibilityState === 'visible') ping();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [ready, authenticated, surface, brand, user?.id]);

  return null;
}
