'use client';

import { useEffect, useState } from 'react';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { hydrateAdvisorDesk } from '@/lib/client/advisor-desk-cache';
import {
  buildAdvisorPwaBrand,
  type AdvisorPwaBrand,
} from '@/lib/advisors/member-pwa';
import { applyAdvisorPwaDocumentHead } from '@/components/advisors/apply-advisor-pwa-head';
import { AdvisorPwaInstallPrompt } from '@/components/advisors/AdvisorPwaInstallPrompt';
import type { FitgraphStore } from '@/lib/fitness/fitgraph';

/**
 * Owner gym desk uses the same home-screen app as coaches and members
 * (VUKA, or whatever name/logo the gym set).
 */
export function GymDeskPwaBrand() {
  const companyId = getSelectedCompanyId();
  const [brand, setBrand] = useState<AdvisorPwaBrand | null>(null);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    void hydrateAdvisorDesk<{ store?: FitgraphStore }>(
      'fitgraph',
      companyId,
      `/api/fitness/fitgraph?companyId=${companyId}`,
      (data) => {
        if (cancelled) return;
        const settings = data.store?.settings as
          | Record<string, unknown>
          | undefined;
        const token = String(settings?.public_token || '').trim();
        if (!settings || token.length < 8) {
          setBrand(null);
          return;
        }
        setBrand(
          buildAdvisorPwaBrand({
            module: 'fitgraph',
            publicToken: token,
            companyId,
            settings,
          })
        );
      },
      () => undefined
    );
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  useEffect(() => {
    if (!brand || brand.enabled === false) return;
    applyAdvisorPwaDocumentHead(brand);
  }, [brand]);

  if (!brand || brand.enabled === false) return null;
  return <AdvisorPwaInstallPrompt brand={brand} mode="chip" autoOpen={false} />;
}
