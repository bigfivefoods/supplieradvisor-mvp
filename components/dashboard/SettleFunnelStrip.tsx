'use client';

/**
 * Settle funnel + network density — home / command strip.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, TrendingUp, Users } from 'lucide-react';
import { getSelectedCompanyId } from '@/lib/containers/company';

type Funnel = {
  claimsPending: number;
  claimsConfirmed30d: number;
  ledgerPayments30d: number;
  openAr: number;
  overdueInvoices: number;
  stages: Array<{ id: string; label: string; count: number }>;
};

type Density = {
  acceptedConnections?: number;
  pendingIncoming?: number;
  openToTradeSuggestions?: number;
};

export default function SettleFunnelStrip() {
  const companyId = getSelectedCompanyId();
  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [density, setDensity] = useState<Density | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [fRes, dRes] = await Promise.all([
        fetch(`/api/business/settle-funnel?companyId=${companyId}`, {
          cache: 'no-store',
        }),
        fetch(`/api/business/network-density?companyId=${companyId}`, {
          cache: 'no-store',
        }).catch(() => null),
      ]);
      if (fRes.ok) {
        const j = await fRes.json();
        setFunnel(j.funnel || null);
      }
      if (dRes && dRes.ok) {
        const j = await dRes.json();
        setDensity(j.density || null);
      }
    } catch {
      setFunnel(null);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!companyId || loading) {
    return loading && companyId ? (
      <div className="mb-4 flex items-center gap-2 text-xs text-neutral-400">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Loading settle funnel…
      </div>
    ) : null;
  }
  if (!funnel) return null;

  return (
    <div className="mb-4 rounded-2xl border border-neutral-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
          <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
          Settle funnel · 30d
        </p>
        <Link
          href="/dashboard/customers/money"
          className="text-[11px] font-bold text-[#0077b6] underline"
        >
          Money hub
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {(funnel.stages || []).map((s) => (
          <div
            key={s.id}
            className={`rounded-xl border px-2.5 py-2 ${
              s.id === 'claims_pending' && s.count > 0
                ? 'border-amber-300 bg-amber-50'
                : 'border-neutral-100 bg-slate-50'
            }`}
          >
            <p className="text-[10px] font-semibold text-neutral-500 leading-tight">
              {s.label}
            </p>
            <p className="text-lg font-black tabular-nums text-slate-900">
              {s.count}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-600">
        <span>
          Open AR{' '}
          <strong>
            {Number(funnel.openAr || 0).toLocaleString(undefined, {
              maximumFractionDigits: 0,
            })}
          </strong>
        </span>
        <span>
          Overdue inv <strong>{funnel.overdueInvoices}</strong>
        </span>
        {density ? (
          <span className="inline-flex items-center gap-1">
            <Users className="w-3 h-3" />
            Network{' '}
            <strong>{density.acceptedConnections ?? '—'}</strong> accepted
            {density.pendingIncoming
              ? ` · ${density.pendingIncoming} pending in`
              : ''}
          </span>
        ) : null}
      </div>
    </div>
  );
}
