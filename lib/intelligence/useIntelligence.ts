'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
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
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (privyUserId) params.set('privyUserId', privyUserId);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      try {
        if (authenticated && typeof getAccessToken === 'function') {
          const token = await getAccessToken();
          if (token) headers.Authorization = `Bearer ${token}`;
        }
      } catch {
        /* cookie auth may still work */
      }

      // Prefer GET (cache-friendly); fall back to POST with body for legacy
      let res = await fetch(`/api/intelligence/summary?${params}`, {
        method: 'GET',
        headers,
        credentials: 'include',
      });
      if (res.status === 405 || res.status === 404) {
        res = await fetch('/api/intelligence/summary', {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify({
            companyId: Number(companyId),
            privyUserId: privyUserId || undefined,
          }),
        });
      }
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || `Failed to load intelligence (${res.status})`);
      }
      setData(json);
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
