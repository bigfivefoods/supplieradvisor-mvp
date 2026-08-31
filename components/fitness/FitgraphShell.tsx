'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { CompanyRequired as BaseCompanyRequired } from '@/components/business/BusinessShell';
import { RelationshipPage } from '@/components/relationship/RelationshipChrome';
import { GymDeskPwaBrand } from '@/components/fitness/GymDeskPwaBrand';
import { useCompanyRole } from '@/lib/business/useCompanyRole';
import { canOpenCompanyWorkspace } from '@/lib/business/permissions';

/**
 * Owner-only gate for the GymAdvisor company OS (/dashboard/fitgraph/**).
 *
 * Craig's rule: only the gym OWNER may open this workspace. Coaches use
 * /coach/fitgraph/[token]; members use /member/fitgraph/[token].
 * If a non-owner lands here, redirect them to the right PWA or company home.
 */
export function FitgraphRequired({ children }: { children: ReactNode }) {
  const { role, loading, selectedCompanyId, ready } = useCompanyRole();
  const router = useRouter();
  const redirected = useRef(false);

  useEffect(() => {
    if (!ready || redirected.current) return;
    if (canOpenCompanyWorkspace(role)) return; // owner — allow through

    redirected.current = true;

    if (!selectedCompanyId) {
      router.replace('/dashboard');
      return;
    }

    // Ask the server where to send this non-owner (coach PWA / member PWA / home)
    fetch(
      `/api/fitness/fitgraph/portal-redirect?companyId=${selectedCompanyId}`,
      { credentials: 'include' }
    )
      .then((r) => r.json())
      .then((data: { redirect?: string }) => {
        router.replace(data.redirect || '/dashboard');
      })
      .catch(() => {
        router.replace('/dashboard');
      });
  }, [ready, role, selectedCompanyId, router]);

  // While checking owner status, render nothing to avoid flash
  if (loading || !canOpenCompanyWorkspace(role)) {
    return null;
  }

  return (
    <BaseCompanyRequired>
      <GymDeskPwaBrand />
      {children}
    </BaseCompanyRequired>
  );
}

export function FitgraphPage({ children }: { children: ReactNode }) {
  return <RelationshipPage>{children}</RelationshipPage>;
}
