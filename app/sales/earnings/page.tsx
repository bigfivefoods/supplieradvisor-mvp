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
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    );
  }

  const k = summary.kpis;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-2">
          <Wallet className="w-8 h-8 text-amber-400" />
          Earnings
        </h1>
        <p className="text-slate-400 mt-1 text-sm">
          Projected, earned, and paid commission for deals you work under{' '}
          {summary.companyName}.
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <Stat label="Projected" value={formatZarPrecise(k.projectedCommission)} />
        <Stat label="Earned" value={formatZarPrecise(k.earnedCommission)} highlight />
        <Stat label="Paid" value={formatZarPrecise(k.paidCommission)} />
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
        <h2 className="font-bold text-white mb-4">Trend</h2>
        <div className="h-72">
          <EarningsTrendChart
            labels={summary.pipelineByMonth.map((m) => m.month)}
            projected={summary.pipelineByMonth.map((m) => m.projected)}
            earned={summary.pipelineByMonth.map((m) => m.earned)}
          />
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
        <h2 className="font-bold text-white mb-2">Deal calculator</h2>
        <p className="text-xs text-slate-400 mb-4">
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
          <span className="text-slate-300 text-sm">
            Deal size:{' '}
            <strong className="text-white">
              R{demoAmount.toLocaleString('en-ZA')}
            </strong>
          </span>
          <CommissionBadge amount={demoAmount} />
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/[0.03] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10 font-bold text-white">
          Recent activity
        </div>
        <ul className="divide-y divide-white/5">
          {summary.recentActivity.length === 0 ? (
            <li className="p-6 text-sm text-slate-500 text-center">No activity yet</li>
          ) : (
            summary.recentActivity.map((a) => (
              <li key={a.id} className="px-5 py-3 flex justify-between gap-3 text-sm">
                <div>
                  <div className="text-slate-200">{a.label}</div>
                  <div className="text-[11px] text-slate-500">
                    {new Date(a.at).toLocaleString('en-ZA')}
                  </div>
                </div>
                {a.commission != null && (
                  <div className="text-amber-300 font-semibold whitespace-nowrap">
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
      className={`rounded-3xl border p-5 ${
        highlight
          ? 'border-amber-400/40 bg-amber-500/10'
          : 'border-white/10 bg-white/[0.03]'
      }`}
    >
      <div className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">
        {label}
      </div>
      <div className="text-2xl font-black text-white mt-1">{value}</div>
    </div>
  );
}
