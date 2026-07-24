'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { apiJson } from '@/lib/client/api-fetch';
import type { Insight, HealthScores, PulseInput } from '@/lib/intelligence/engine';

export type IntelligenceSummary = {
  success?: boolean;
  generatedAt?: string;
  company?: {
    id: number;
    trading_name: string;
    industry?: string | null;
    country?: string | null;
    city?: string | null;
    verification_status?: string | null;
    trust_score?: number | null;
    primary_currency?: string | null;
    wallet_address?: string | null;
    leadership_progress?: unknown;
  };
  health?: HealthScores;
  pulse?: Record<string, number | string[] | undefined | null>;
  pulseModel?: PulseInput;
  forecasts?: {
    poNext30: number;
    salesNext30: number;
    arCollectionRisk: number;
    poGrowth: number;
    salesGrowth: number;
    horizonDays: number;
    method: string;
  };
  scorecards?: Array<{
    id: string;
    label: string;
    score: number;
    detail: string;
    href: string;
  }>;
  insights?: Insight[];
  concentration?: { topSupplierShare: number; supplierCount: number };
  domains?: Record<string, boolean>;
  error?: string;
};

export function useIntelligence() {
  const { user, ready, authenticated, getAccessToken } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const [data, setData] = useState<IntelligenceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const companyId = getSelectedCompanyId();

  const load = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      setError('Select a company');
      setData(null);
      return;
    }
    // Wait for Privy to settle so we can attach token / legacy id when available
    if (ready === false) {
      setLoading(true);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      let accessToken: string | null = null;
      try {
        if (authenticated && typeof getAccessToken === 'function') {
          accessToken = await getAccessToken();
        }
      } catch {
        /* cookie fallback */
      }

      try {
        const json = await apiJson<IntelligenceSummary>(
          '/api/intelligence/summary',
          {
            method: 'GET',
            companyId,
            privyUserId,
            accessToken,
          }
        );
        setData(json);
      } catch {
        const json = await apiJson<IntelligenceSummary>(
          '/api/intelligence/summary',
          {
            method: 'POST',
            companyId,
            privyUserId,
            accessToken,
            jsonBody: {},
          }
        );
        setData(json);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId, ready, authenticated, getAccessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, error, reload: load, companyId, privyUserId };
}

export function money(n: number, currency = 'ZAR') {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency.length === 3 ? currency : 'ZAR',
      maximumFractionDigits: 0,
    }).format(Number(n || 0));
  } catch {
    return `${currency} ${Number(n || 0).toLocaleString()}`;
  }
}

export function healthTone(
  score: number
): 'emerald' | 'cyan' | 'amber' | 'neutral' {
  if (score >= 75) return 'emerald';
  if (score >= 55) return 'cyan';
  if (score >= 35) return 'amber';
  return 'neutral';
}
