'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Wallet } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { formatZarPrecise } from '@/lib/sales-contractor/commission';
import type { SalesPortalSummary } from '@/lib/sales-contractor/types';
import { EarningsTrendChart } from '@/components/sales/SalesCharts';
import CommissionBadge from '@/components/sales/CommissionBadge';

export default function SalesEarningsPage() {
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const companyId = getSelectedCompanyId();
  const [summary, setSummary] = useState<SalesPortalSummary | null>(null);
  const [demoAmount, setDemoAmount] = useState(150000);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!companyId || !privyUserId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        companyId: String(companyId),
        privyUserId,
      });
      const res = await fetch(`/api/sales/summary?${params}`);
      const data = await res.json();
      if (res.ok) setSummary(data.summary);
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading || !summary) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
      </div>
    );
  }

  const k = summary.kpis;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <Wallet className="w-8 h-8 text-[#00b4d8]" />
          Earnings
        </h1>
        <p className="text-neutral-500 mt-1 text-sm">
          Projected, earned, and paid commission for deals you work under{' '}
          {summary.companyName}.
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <Stat label="Projected" value={formatZarPrecise(k.projectedCommission)} />
        <Stat label="Earned" value={formatZarPrecise(k.earnedCommission)} highlight />
        <Stat label="Paid" value={formatZarPrecise(k.paidCommission)} />
      </div>

      <div className="rounded-3xl border border-neutral-200 bg-white p-5 sm:p-6">
        <h2 className="font-bold text-slate-900 mb-1">Trend</h2>
        <p className="text-xs text-neutral-600 mb-4">
          <span className="text-amber-600 font-semibold">Projected</span>
          {' · '}
          <span className="text-emerald-600 font-semibold">Earned</span>
          {' · commission 3.5% → 5.5%'}
        </p>
        <div className="h-72 rounded-2xl bg-slate-50 border border-neutral-100 p-2 sm:p-3">
          <EarningsTrendChart
            labels={summary.pipelineByMonth.map((m) => m.month)}
            projected={summary.pipelineByMonth.map((m) => m.projected)}
            earned={summary.pipelineByMonth.map((m) => m.earned)}
          />
        </div>
      </div>

      <div className="rounded-3xl border border-neutral-200 bg-white p-5 sm:p-6">
        <h2 className="font-bold text-slate-900 mb-2">Deal calculator</h2>
        <p className="text-xs text-neutral-600 mb-4">
          Drag to simulate commission on a quote or invoice total
        </p>
        <input
          type="range"
          min={5000}
          max={2000000}
          step={5000}
          value={demoAmount}
          onChange={(e) => setDemoAmount(Number(e.target.value))}
          className="w-full accent-amber-500"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <span className="text-neutral-600 text-sm">
            Deal size:{' '}
            <strong className="text-slate-900">
              R{demoAmount.toLocaleString('en-ZA')}
            </strong>
          </span>
          <CommissionBadge amount={demoAmount} />
        </div>
      </div>

      <div className="rounded-3xl border border-neutral-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-200 font-bold text-slate-900">
          Recent activity
        </div>
        <ul className="divide-y divide-neutral-100">
          {summary.recentActivity.length === 0 ? (
            <li className="p-6 text-sm text-neutral-500 text-center">No activity yet</li>
          ) : (
            summary.recentActivity.map((a) => (
              <li key={a.id} className="px-5 py-3 flex justify-between gap-3 text-sm">
                <div>
                  <div className="text-slate-700">{a.label}</div>
                  <div className="text-[11px] text-neutral-500">
                    {new Date(a.at).toLocaleString('en-ZA')}
                  </div>
                </div>
                {a.commission != null && (
                  <div className="text-amber-600 font-semibold whitespace-nowrap">
                    {formatZarPrecise(a.commission)}
                  </div>
                )}
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-3xl border p-5 shadow-sm ${
        highlight
          ? 'border-amber-300 bg-gradient-to-br from-amber-50 to-white'
          : 'border-neutral-200 bg-white'
      }`}
    >
      <div className="text-[11px] uppercase tracking-wide text-slate-700 font-bold">
        {label}
      </div>
      <div className="text-2xl font-black text-slate-900 mt-1 drop-shadow-sm">{value}</div>
    </div>
  );
}
