'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, TrendingUp } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { formatZar, formatZarPrecise } from '@/lib/sales-contractor/commission';
import type { SalesPortalSummary } from '@/lib/sales-contractor/types';
import { ForecastBarChart } from '@/components/sales/SalesCharts';

export default function SalesForecastPage() {
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const companyId = getSelectedCompanyId();
  const [summary, setSummary] = useState<SalesPortalSummary | null>(null);
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

  const totalAmt = summary.forecastNext90.reduce((s, w) => s + w.amount, 0);
  const totalComm = summary.forecastNext90.reduce((s, w) => s + w.commission, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-2">
          <TrendingUp className="w-8 h-8 text-sky-400" />
          90-day forecast
        </h1>
        <p className="text-slate-400 mt-1 text-sm">
          Weighted pipeline by expected close week · commission at your sliding scale.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="rounded-3xl border border-sky-400/40 bg-gradient-to-br from-sky-500/25 to-slate-900 p-5 shadow-lg">
          <div className="text-xs uppercase text-sky-100 font-bold">Weighted revenue</div>
          <div className="text-2xl font-black text-white mt-1">{formatZar(totalAmt)}</div>
        </div>
        <div className="rounded-3xl border border-amber-400/50 bg-gradient-to-br from-amber-500/30 to-slate-900 p-5 shadow-lg">
          <div className="text-xs uppercase text-amber-100 font-bold">
            Est. commission (90 days)
          </div>
          <div className="text-2xl font-black text-amber-100 mt-1">
            {formatZarPrecise(totalComm)}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-white/15 bg-slate-900/70 p-5 sm:p-6">
        <p className="text-xs text-slate-300 mb-3">
          <span className="text-sky-300 font-semibold">Pipeline</span>
          {' · '}
          <span className="text-orange-300 font-semibold">Commission</span>
          {' · by expected close week'}
        </p>
        <div className="h-80 rounded-2xl bg-slate-950/60 border border-white/10 p-2 sm:p-3">
          <ForecastBarChart
            labels={summary.forecastNext90.map((w) => w.week)}
            amounts={summary.forecastNext90.map((w) => w.amount)}
            commissions={summary.forecastNext90.map((w) => w.commission)}
          />
        </div>
      </div>
    </div>
  );
}
