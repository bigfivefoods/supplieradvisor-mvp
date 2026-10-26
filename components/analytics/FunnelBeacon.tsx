'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { trackFunnel } from '@/lib/analytics/track-funnel';

const LOCALES = new Set(['fr', 'ar', 'pt', 'sw', 'zu']);

function isLandingPath(pathname: string): boolean {
  if (pathname === '/') return true;
  const parts = pathname.split('/').filter(Boolean);
  return parts.length === 1 && LOCALES.has(parts[0]);
}

/** Landing and sign-up start. Other funnel steps fire at the action that completes them. */
export default function FunnelBeacon() {
  const pathname = usePathname() || '/';

  useEffect(() => {
    if (isLandingPath(pathname)) {
      trackFunnel('landing', { surface: 'marketing' });
      return;
    }
    if (pathname === '/onboarding' || pathname.startsWith('/onboarding/')) {
      let lane = 'b2b';
      try {
        const raw = new URLSearchParams(window.location.search).get('lane');
        if (raw === 'b2g') lane = 'b2g';
      } catch {
        lane = 'b2b';
      }
      trackFunnel('sign_up_start', { surface: 'onboarding', lane });
    }
  }, [pathname]);

  return null;
}
