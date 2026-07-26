'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { formatMoney } from '@/lib/accounting/types';
import PeriodSlicer, {
  initialPeriodSlicerValue,
  type PeriodSlicerValue,
} from '@/components/accounting/PeriodSlicer';
import {
  CompanyRequired,
  SchoolsHeader,
  SchoolsPage,
} from '@/components/schools/SchoolsShell';

export default function IspSlaPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const [period, setPeriod] = useState<PeriodSlicerValue>(() =>
    initialPeriodSlicerValue('ytd', 3)
  );
  const [loading, setLoading] = useState(true);
  const [isps, setIsps] = useState<Array<Record<string, unknown>>>([]);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        companyId: String(companyId),
        from: period.from,
        to: period.to,
      });
      const res = await fetch(`/api/schools/isp-sla?${params}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setIsps(data.isps || []);
      setSummary(data.summary || null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId, period.from, period.to]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <SchoolsPage>
      <SchoolsHeader
        title="ISP SLA"
        titleAccent="Delivery quality"
        description="On-brand deliveries, wrong-brand flags, spend, and probation status for Independent Service Providers."
        action={
          <button type="button" onClick={() => void load()} className="btn-secondary !py-2 !px-3 text-xs">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        }
      />
      <PeriodSlicer value={period} onChange={setPeriod} className="mb-4" />

      {summary ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-[10px] font-bold uppercase text-slate-400">Deliveries</div>
            <div className="text-2xl font-black">{Number(summary.deliveries || 0)}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-[10px] font-bold uppercase text-slate-400">Compliance %</div>
            <div className="text-2xl font-black">{summary.otifef_pct != null ? `${summary.otifef_pct}%` : '—'}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-[10px] font-bold uppercase text-slate-400">ISPs</div>
            <div className="text-2xl font-black">{Number(summary.isp_count || 0)}</div>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4">
            <div className="text-[10px] font-bold uppercase text-amber-800/70">Probation</div>
            <div className="text-2xl font-black">{Number(summary.probation || 0)}</div>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="border-b text-left text-[10px] font-bold uppercase text-slate-400">
                <th className="px-4 py-3">ISP</th>
                <th className="px-3 py-3 text-right">Deliveries</th>
                <th className="px-3 py-3 text-right">On-brand</th>
                <th className="px-3 py-3 text-right">Wrong brand</th>
                <th className="px-3 py-3 text-right">Spend</th>
                <th className="px-3 py-3 text-right">Compliance</th>
                <th className="px-3 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {isps.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    No ISP deliveries in period.
                  </td>
                </tr>
              ) : (
                isps.map((i) => (
                  <tr key={String(i.isp_profile_id)} className="border-b border-slate-50">
                    <td className="px-4 py-2.5 font-semibold inline-flex items-center gap-1">
                      <Truck className="w-3.5 h-3.5 text-[#00b4d8]" />
                      {String(i.name)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{Number(i.deliveries || 0)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{Number(i.approved_ok || 0)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-rose-700">{Number(i.wrong_brand || 0)}</td>
                    <td className="px-3 py-2.5 text-right font-bold tabular-nums">{formatMoney(Number(i.spend || 0))}</td>
                    <td className="px-3 py-2.5 text-right font-black tabular-nums">{Number(i.compliance_pct || 0)}%</td>
                    <td className="px-3 py-2.5 text-xs font-bold uppercase">{String(i.status)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </SchoolsPage>
  );
}
