'use client';

import { useCallback, useEffect, useState } from 'react';
import { getSelectedCompanyId } from '@/lib/containers/company';

export type IntelligenceSummary = {
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
  health?: {
    overall: number;
    network: number;
    supply: number;
    demand: number;
    finance: number;
    ops: number;
  };
  pulse?: Record<string, number | string[] | undefined>;
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
  insights?: Array<{
    id: string;
    severity: 'critical' | 'warning' | 'positive' | 'info';
    title: string;
    detail: string;
    href: string;
    metric?: string;
  }>;
  concentration?: { topSupplierShare: number; supplierCount: number };
  error?: string;
};

export function useIntelligence() {
  const [data, setData] = useState<IntelligenceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const companyId = getSelectedCompanyId();

  const load = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      setError('Select a company');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/intelligence/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: Number(companyId) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load intelligence');
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, error, reload: load, companyId };
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

export function healthTone(score: number): 'emerald' | 'cyan' | 'amber' | 'neutral' {
  if (score >= 75) return 'emerald';
  if (score >= 55) return 'cyan';
  if (score >= 35) return 'amber';
  return 'neutral';
}
