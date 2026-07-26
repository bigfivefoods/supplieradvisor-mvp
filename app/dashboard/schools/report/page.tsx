'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw, Download } from 'lucide-react';
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

const REPORTS = [
  { id: 'overview', label: 'Overview' },
  { id: 'learners', label: 'Learners' },
  { id: 'meals', label: 'Meals' },
  { id: 'stock', label: 'Stock' },
  { id: 'orders', label: 'Orders' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'district', label: 'District' },
] as const;

export default function SchoolsReportPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const [report, setReport] = useState<string>('overview');
  const [period, setPeriod] = useState<PeriodSlicerValue>(() =>
    initialPeriodSlicerValue('ytd', 3)
  );
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        companyId: String(companyId),
        from: period.from,
        to: period.to,
        report,
      });
      const res = await fetch(`/api/schools/report?${params}`, {
        cache: 'no-store',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      setData(json);
      if (json.warnings?.length) toast.message(String(json.warnings[0]));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId, period.from, period.to, report]);

  useEffect(() => {
    void load();
  }, [load]);

  const k = (data?.kpis || {}) as Record<string, number>;
  const byGrade = (data?.byGrade || []) as Array<{
    grade: string;
    count: number;
  }>;
  const trend = (data?.trend || []) as Array<{
    month: string;
    served: number;
    planned: number;
  }>;
  const district = (data?.districtSchools || []) as Array<
    Record<string, unknown>
  >;
  const stock = (data?.stock || []) as Array<Record<string, unknown>>;
  const orders = (data?.orders || []) as Array<Record<string, unknown>>;
  const feeding = (data?.feeding || []) as Array<Record<string, unknown>>;

  const exportCsv = () => {
    const lines = ['metric,value'];
    for (const [key, val] of Object.entries(k)) {
      lines.push(`${key},${val}`);
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nsnp-report-${period.from}_${period.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <SchoolsPage>
      <SchoolsHeader
        title="NSNP reports"
        titleAccent="Slice & dice"
        description={`${period.label} · learners, meals, stock, approved-brand %, district roll-up.`}
        action={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={exportCsv}
              className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
            <button
              type="button"
              onClick={() => void load()}
              className="btn-primary !py-2 !px-3 text-xs inline-flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>
        }
      />

      <PeriodSlicer
        value={period}
        onChange={setPeriod}
        showTrailing
        className="mb-4"
      />

      <div className="mb-4 flex flex-wrap gap-1.5">
        {REPORTS.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setReport(r.id)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${
              report === r.id
                ? 'border-[#00b4d8] bg-[#00b4d8] text-white'
                : 'border-neutral-200 bg-white text-neutral-600'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {(
              [
                {
                  label: 'Learners',
                  value: String(k.learnersEnrolled ?? '—'),
                },
                {
                  label: 'Verified %',
                  value: `${k.verifyPct ?? 0}%`,
                },
                {
                  label: 'Meals served',
                  value: String(k.mealsServed ?? '—'),
                },
                {
                  label: 'Approved brand %',
                  value: `${k.approvedBrandPct ?? 0}%`,
                },
                { label: 'Waste %', value: `${k.wastePct ?? 0}%` },
                {
                  label: 'PO spend',
                  value: formatMoney(k.poSpend || 0),
                },
                {
                  label: 'Stock lines',
                  value: String(k.stockLines ?? '—'),
                },
                {
                  label: 'Open compliance',
                  value: String(k.openCompliance ?? '—'),
                },
              ] satisfies Array<{ label: string; value: string }>
            ).map((tile) => (
              <div
                key={tile.label}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
              >
                <div className="text-[10px] font-bold uppercase text-slate-400">
                  {tile.label}
                </div>
                <div className="text-xl font-black tabular-nums">
                  {tile.value}
                </div>
              </div>
            ))}
          </div>

          {(report === 'overview' || report === 'learners') && (
            <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden mb-4">
              <div className="px-4 py-3 border-b text-xs font-bold uppercase text-slate-500">
                Learners by grade
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {byGrade.map((g) => (
                    <tr key={g.grade} className="border-b border-slate-50">
                      <td className="px-4 py-2 font-semibold">{g.grade}</td>
                      <td className="px-4 py-2 text-right tabular-nums font-bold">
                        {g.count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {(report === 'overview' || report === 'meals') && (
            <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden mb-4">
              <div className="px-4 py-3 border-b text-xs font-bold uppercase text-slate-500">
                Monthly meals trend
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-[10px] font-bold uppercase text-slate-400">
                    <th className="px-4 py-2 text-left">Month</th>
                    <th className="px-3 py-2 text-right">Planned</th>
                    <th className="px-3 py-2 text-right">Served</th>
                  </tr>
                </thead>
                <tbody>
                  {trend.map((t) => (
                    <tr key={t.month} className="border-b border-slate-50">
                      <td className="px-4 py-2 font-mono text-xs">{t.month}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {t.planned}
                      </td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums">
                        {t.served}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {feeding.length > 0 && report === 'meals' ? (
                <div className="px-4 py-2 text-xs text-slate-400">
                  {feeding.length} feeding day rows in period
                </div>
              ) : null}
            </div>
          )}

          {report === 'stock' && (
            <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-[10px] font-bold uppercase text-slate-400">
                    <th className="px-4 py-2 text-left">Product</th>
                    <th className="px-3 py-2 text-left">Brand</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {stock.map((s) => (
                    <tr key={String(s.id)} className="border-b border-slate-50">
                      <td className="px-4 py-2 font-semibold">
                        {String(s.product_name)}
                      </td>
                      <td className="px-3 py-2 text-emerald-800 font-bold text-xs">
                        {String(s.brand_name)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-bold">
                        {Number(s.qty_on_hand)} {String(s.uom || '')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {report === 'orders' && (
            <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-[10px] font-bold uppercase text-slate-400">
                    <th className="px-4 py-2 text-left">PO</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={String(o.id)} className="border-b border-slate-50">
                      <td className="px-4 py-2 font-mono text-xs font-bold">
                        {String(o.po_number)}
                      </td>
                      <td className="px-3 py-2 capitalize text-xs">
                        {String(o.status)}
                      </td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums">
                        {formatMoney(Number(o.total_amount || 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {report === 'district' && (
            <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-4 py-3 border-b text-xs font-bold uppercase text-slate-500">
                Schools in district ({district.length})
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-[10px] font-bold uppercase text-slate-400">
                    <th className="px-4 py-2 text-left">School</th>
                    <th className="px-3 py-2 text-right">Enrolled</th>
                    <th className="px-3 py-2 text-right">Verified</th>
                  </tr>
                </thead>
                <tbody>
                  {district.map((s) => (
                    <tr key={String(s.id)} className="border-b border-slate-50">
                      <td className="px-4 py-2 font-semibold">
                        {String(s.school_name)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {Number(s.learner_count_enrolled || 0)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {Number(s.learner_count_verified || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {report === 'compliance' && (
            <p className="text-sm text-slate-600">
              Open compliance items: <strong>{k.openCompliance ?? 0}</strong>.
              Non-approved receipts in period:{' '}
              <strong>{k.nonApprovedReceipts ?? 0}</strong>. See Compliance
              workspace for detail.
            </p>
          )}
        </>
      )}
    </SchoolsPage>
  );
}
