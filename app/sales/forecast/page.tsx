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
        <div className="rounded-3xl border border-white/10 bg-sky-500/10 p-5">
          <div className="text-xs uppercase text-slate-400 font-semibold">Weighted revenue</div>
          <div className="text-2xl font-black text-white mt-1">{formatZar(totalAmt)}</div>
        </div>
        <div className="rounded-3xl border border-amber-400/30 bg-amber-500/10 p-5">
          <div className="text-xs uppercase text-slate-400 font-semibold">
            Est. commission (90 days)
          </div>
          <div className="text-2xl font-black text-amber-200 mt-1">
            {formatZarPrecise(totalComm)}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
        <div className="h-80">
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
