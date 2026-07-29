'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, RefreshCw, Truck, Star } from 'lucide-react';
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
import { useProgrammeRole } from '@/lib/schools/useProgrammeRole';

export default function IspSlaPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const programme = useProgrammeRole();
  const isSchool = programme.role === 'school';
  const [period, setPeriod] = useState<PeriodSlicerValue>(() =>
    initialPeriodSlicerValue('ytd', 3)
  );
  const [loading, setLoading] = useState(true);
  const [isps, setIsps] = useState<Array<Record<string, unknown>>>([]);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [legend, setLegend] = useState<Record<string, string> | null>(null);

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
      setLegend(data.otifef_legend || null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId, period.from, period.to]);

  useEffect(() => {
    void load();
  }, [load]);

  const headerMode =
    programme.role === 'sp'
      ? 'isp'
      : programme.role === 'department'
        ? 'agency'
        : 'school';

  return (
    <SchoolsPage>
      <SchoolsHeader
        title="SP SLA · OTIFEF"
        titleAccent="On-Time · In-Full · Error-Free"
        mode={headerMode}
        description={
          isSchool
            ? 'Objective delivery metrics for service providers. Schools rate SPs and food under Rate SP & food. Preferred SPs stay on-catalogue and deliver on time.'
            : programme.role === 'sp'
              ? 'Your objective On-Time · In-Full · Error-Free delivery scores. Schools submit subjective ratings from their kitchen profile (not from this SP workspace).'
              : 'Objective delivery metrics for service providers on the programme. Subjective Rate SP & food is school-only.'
        }
        action={
          <div className="flex gap-2">
            {isSchool ? (
              <Link
                href="/dashboard/schools/ratings"
                className="btn-primary !py-2 !px-3 text-xs inline-flex items-center gap-1"
              >
                <Star className="w-3.5 h-3.5" /> Rate SP / food
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => void load()}
              className="btn-secondary !py-2 !px-3 text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        }
      />
      <PeriodSlicer value={period} onChange={setPeriod} className="mb-4" />

      <div className="mb-4 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-950">
        <strong>OTIFEF:</strong>{' '}
        {legend
          ? `On-time = ${legend.on_time}. In-full = ${legend.in_full}. Error-free = ${legend.error_free}. Score = ${legend.composite}.`
          : 'On-Time · In-Full · Error-Free delivery performance from POs, DNs and kitchen GRNs.'}
      </div>

      {summary ? (
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-[10px] font-bold uppercase text-slate-400">
              Deliveries
            </div>
            <div className="text-2xl font-black">
              {Number(summary.deliveries || 0)}
            </div>
          </div>
          <div className="rounded-2xl border border-sky-100 bg-sky-50/50 p-4">
            <div className="text-[10px] font-bold uppercase text-sky-800/70">
              OTIFEF
            </div>
            <div className="text-2xl font-black">
              {summary.otifef_pct != null ? `${summary.otifef_pct}%` : '—'}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-[10px] font-bold uppercase text-slate-400">
              On-catalogue
            </div>
            <div className="text-2xl font-black">
              {summary.compliance_pct != null
                ? `${summary.compliance_pct}%`
                : '—'}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-[10px] font-bold uppercase text-slate-400">
              SPs
            </div>
            <div className="text-2xl font-black">
              {Number(summary.isp_count || 0)}
            </div>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
            <div className="text-[10px] font-bold uppercase text-emerald-800/70">
              Preferred
            </div>
            <div className="text-2xl font-black">
              {Number(summary.preferred || 0)}
            </div>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4">
            <div className="text-[10px] font-bold uppercase text-amber-800/70">
              Probation
            </div>
            <div className="text-2xl font-black">
              {Number(summary.probation || 0)}
            </div>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm min-w-[960px]">
            <thead>
              <tr className="border-b text-left text-[10px] font-bold uppercase text-slate-400">
                <th className="px-4 py-3">SP</th>
                <th className="px-3 py-3 text-right">OTIFEF</th>
                <th className="px-3 py-3 text-right">On-time</th>
                <th className="px-3 py-3 text-right">In-full</th>
                <th className="px-3 py-3 text-right">Error-free</th>
                <th className="px-3 py-3 text-right">Deliveries</th>
                <th className="px-3 py-3 text-right">School ★</th>
                <th className="px-3 py-3 text-right">Spend</th>
                <th className="px-3 py-3">Badge</th>
              </tr>
            </thead>
            <tbody>
              {isps.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-12 text-center text-slate-500"
                  >
                    No SP delivery activity in this period. Link SPs and receive
                    GRNs to build OTIFEF.
                  </td>
                </tr>
              ) : (
                isps.map((i) => (
                  <tr
                    key={String(i.isp_profile_id)}
                    className={`border-b border-slate-50 ${
                      i.preferred ? 'bg-emerald-50/40' : ''
                    }`}
                  >
                    <td className="px-4 py-2.5 font-semibold">
                      <span className="inline-flex items-center gap-1">
                        <Truck className="w-3.5 h-3.5 text-[#00b4d8]" />
                        {String(i.name)}
                      </span>
                      {i.otifef_label ? (
                        <span className="block text-[10px] font-bold text-slate-400">
                          {String(i.otifef_label)}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 text-right font-black tabular-nums text-sky-900">
                      {i.otifef_pct != null ? `${i.otifef_pct}%` : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {i.on_time_pct != null ? `${i.on_time_pct}%` : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {i.in_full_pct != null ? `${i.in_full_pct}%` : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {i.error_free_pct != null ? `${i.error_free_pct}%` : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {Number(i.deliveries || 0)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-amber-700 font-bold">
                      {i.avg_school_rating != null
                        ? `${i.avg_school_rating}★`
                        : '—'}
                      {i.rating_count ? (
                        <span className="block text-[9px] font-normal text-slate-400">
                          {String(i.rating_count)} rating
                          {Number(i.rating_count) === 1 ? '' : 's'}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold tabular-nums">
                      {formatMoney(Number(i.spend || 0))}
                    </td>
                    <td className="px-3 py-2.5 text-[11px] font-bold">
                      <span
                        className={
                          i.preferred || i.status === 'excellent'
                            ? 'text-emerald-800'
                            : i.status === 'probation'
                              ? 'text-rose-700'
                              : 'text-slate-600'
                        }
                      >
                        {String(i.badge || i.status)}
                      </span>
                    </td>
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
