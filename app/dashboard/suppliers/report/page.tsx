'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Loader2,
  RefreshCw,
  Star,
  TrendingUp,
  Truck,
  ShieldCheck,
  Award,
  FileText,
  AlertTriangle,
  PieChart,
  BarChart3,
  BookOpen,
  Download,
  ExternalLink,
  Filter,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { formatMoney } from '@/lib/accounting/types';
import { otifefBand, trustBand } from '@/lib/suppliers/types';
import {
  CompanyRequired,
  SuppliersHeader,
  SuppliersPage,
} from '@/components/suppliers/SuppliersShell';
import { StarRating } from '@/components/ratings';
import { starGuide } from '@/lib/ratings/company-rating';
import PeriodSlicer, {
  initialPeriodSlicerValue,
  type PeriodSlicerValue,
} from '@/components/accounting/PeriodSlicer';
import { ChartCard, MixDoughnut, PnlTrendChart } from '@/components/accounting/AccountingCharts';

const REPORTS = [
  { id: 'overview', label: 'Overview', desc: 'Executive KPIs' },
  { id: 'scorecard', label: 'Scorecard', desc: 'Supplier rank table' },
  { id: 'spend', label: 'Spend & Pareto', desc: 'Concentration' },
  { id: 'po_ledger', label: 'PO ledger', desc: 'All purchase orders' },
  { id: 'otifef', label: 'OTIFEF', desc: 'On-time / in-full / error-free' },
  { id: 'ratings', label: 'Ratings', desc: 'Peer stars' },
  { id: 'risk', label: 'Risk', desc: 'Flags & alerts' },
  { id: 'status_mix', label: 'PO status', desc: 'Funnel & mix' },
  { id: 'trend', label: 'Trends', desc: 'Monthly spend' },
  { id: 'book', label: 'Book health', desc: 'Network coverage' },
] as const;

type ReportId = (typeof REPORTS)[number]['id'];

type Kpis = {
  suppliersOnBook: number;
  connected: number;
  preferred: number;
  verified: number;
  openPos: number;
  completedPos?: number;
  cancelledPos?: number;
  latePos?: number;
  poCount: number;
  totalSpend: number;
  avgPoValue?: number;
  top3Share?: number;
  openRiads: number;
  otifefOverall: number;
  otifefOnTime: number;
  otifefInFull: number;
  otifefErrorFree: number;
  starAvgGiven: number | null;
  companiesStarRated: number;
};

type SupplierRow = {
  supplier_profile_id: number;
  name: string;
  status?: string | null;
  verified?: boolean;
  trust_score?: number | null;
  otifef_pct?: number | null;
  otifef_on_time?: number | null;
  otifef_in_full?: number | null;
  otifef_error_free?: number | null;
  otifef_po_count?: number | null;
  star_avg?: number | null;
  star_count?: number;
  star_quality?: number | null;
  star_delivery?: number | null;
  star_communication?: number | null;
  star_value?: number | null;
  spend?: number;
  spend_share_pct?: number;
  po_count?: number;
  po_open?: number;
  po_completed?: number;
  po_late?: number;
  city?: string | null;
  country?: string | null;
};

type PoRow = {
  id: number;
  po_number: string;
  supplier_profile_id: number | null;
  supplier_name: string;
  status: string;
  total_amount: number;
  currency: string;
  promised_date: string | null;
  actual_delivery_date: string | null;
  created_at: string | null;
  is_hub_order?: boolean;
};

export default function SupplierReportPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const [report, setReport] = useState<ReportId>('overview');
  const [period, setPeriod] = useState<PeriodSlicerValue>(() =>
    initialPeriodSlicerValue('ytd', 3)
  );
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [rows, setRows] = useState<SupplierRow[]>([]);
  const [poLedger, setPoLedger] = useState<PoRow[]>([]);
  const [concentration, setConcentration] = useState<
    Array<{
      rank: number;
      name: string;
      spend: number;
      share_pct: number;
      cumulative_pct: number;
    }>
  >([]);
  const [statusMix, setStatusMix] = useState<
    Array<{ status: string; count: number; spend: number; share_pct: number }>
  >([]);
  const [trend, setTrend] = useState<
    Array<{ month: string; spend: number; count: number; open: number; completed: number }>
  >([]);
  const [risk, setRisk] = useState<{
    lowOtifef: SupplierRow[];
    highOpenSpend: SupplierRow[];
    lateDeliveries: SupplierRow[];
    lowStars: SupplierRow[];
    singleSourceRisk: { message: string; top3Share: number } | null;
  } | null>(null);
  const [bookHealth, setBookHealth] = useState<{
    onBook: number;
    connected: number;
    preferred: number;
    verified: number;
    withSpend: number;
    withOtifef: number;
    withStars: number;
    inactive: number;
    byStatus: Array<{ status: string; count: number }>;
  } | null>(null);

  // Slice filters
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [minSpend, setMinSpend] = useState('');
  const [sortKey, setSortKey] = useState<'spend' | 'otifef' | 'stars' | 'name' | 'open'>(
    'spend'
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        companyId: String(companyId),
        from: period.from,
        to: period.to,
        report: 'all',
      });
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/suppliers/report?${params}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load report');
      setKpis(data.kpis || null);
      setRows(data.suppliers || []);
      setPoLedger(data.poLedger || []);
      setConcentration(data.concentration || []);
      setStatusMix(data.statusMix || []);
      setTrend(data.trend || []);
      setRisk(data.risk || null);
      setBookHealth(data.bookHealth || null);
      if (data.warnings?.length) toast.message(String(data.warnings[0]));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId, period.from, period.to, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredRows = useMemo(() => {
    let list = [...rows];
    const qq = q.trim().toLowerCase();
    if (qq) {
      list = list.filter((r) => r.name.toLowerCase().includes(qq));
    }
    if (verifiedOnly) list = list.filter((r) => r.verified);
    const min = Number(minSpend);
    if (Number.isFinite(min) && min > 0) {
      list = list.filter((r) => (r.spend || 0) >= min);
    }
    list.sort((a, b) => {
      if (sortKey === 'name') return a.name.localeCompare(b.name);
      if (sortKey === 'otifef')
        return (b.otifef_pct || 0) - (a.otifef_pct || 0);
      if (sortKey === 'stars') return (b.star_avg || 0) - (a.star_avg || 0);
      if (sortKey === 'open') return (b.po_open || 0) - (a.po_open || 0);
      return (b.spend || 0) - (a.spend || 0);
    });
    return list;
  }, [rows, q, verifiedOnly, minSpend, sortKey]);

  const filteredPos = useMemo(() => {
    let list = [...poLedger];
    const qq = q.trim().toLowerCase();
    if (qq) {
      list = list.filter(
        (p) =>
          p.supplier_name.toLowerCase().includes(qq) ||
          p.po_number.toLowerCase().includes(qq) ||
          p.status.includes(qq)
      );
    }
    if (statusFilter) {
      list = list.filter((p) => p.status === statusFilter);
    }
    return list;
  }, [poLedger, q, statusFilter]);

  const k = kpis;
  const otBand = otifefBand(k?.otifefOverall || 0);

  const exportCsv = (kind: 'suppliers' | 'pos') => {
    const lines: string[] = [];
    if (kind === 'suppliers') {
      lines.push(
        'Supplier,Verified,OTIFEF%,Stars,Trust,Spend,SpendShare%,POs,Open,Status'
      );
      for (const r of filteredRows) {
        lines.push(
          [
            csv(r.name),
            r.verified ? 'Y' : 'N',
            r.otifef_pct ?? '',
            r.star_avg ?? '',
            r.trust_score ?? '',
            r.spend ?? 0,
            r.spend_share_pct ?? '',
            r.po_count ?? 0,
            r.po_open ?? 0,
            r.status || '',
          ].join(',')
        );
      }
    } else {
      lines.push(
        'PO,Supplier,Status,Amount,Currency,Promised,Delivered,Created'
      );
      for (const p of filteredPos) {
        lines.push(
          [
            csv(p.po_number),
            csv(p.supplier_name),
            p.status,
            p.total_amount,
            p.currency,
            p.promised_date || '',
            p.actual_delivery_date || '',
            p.created_at ? p.created_at.slice(0, 10) : '',
          ].join(',')
        );
      }
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `supplier-${kind}-${period.from}_${period.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const trendLabels = trend.map((t) => t.month);
  const statusSegments = statusMix.map((s) => ({
    label: s.status,
    value: s.count,
  }));

  return (
    <SuppliersPage>
      <SuppliersHeader
        title="Supplier reports"
        titleAccent="Slice & dice"
        description={`Decision pack for your supply base · ${period.label} (${period.from} → ${period.to}). All POs live under Order.`}
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/suppliers/po"
              className="btn-primary !py-2.5 !px-4 text-sm inline-flex items-center gap-2"
            >
              <FileText className="w-4 h-4" /> All purchase orders
            </Link>
            <button
              type="button"
              onClick={() => void load()}
              className="btn-secondary !py-2.5 !px-4 text-sm inline-flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
          </div>
        }
      />

      {/* Where are POs? */}
      <div className="mb-4 rounded-2xl border border-sky-200 bg-sky-50/80 px-4 py-3 text-sm text-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-bold text-slate-900">
            All purchase orders with suppliers
          </p>
          <p className="text-xs text-slate-600 mt-0.5">
            Navigate{' '}
            <strong>Suppliers → Order</strong> to raise, receive, and manage
            POs. Use the <strong>PO ledger</strong> report tab below for
            period-filtered analytics on every PO.
          </p>
        </div>
        <Link
          href="/dashboard/suppliers/po"
          className="btn-primary !py-2 !px-3 text-xs inline-flex items-center gap-1.5 shrink-0"
        >
          Open PO workspace <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>

      <PeriodSlicer
        value={period}
        onChange={setPeriod}
        showTrailing
        defaultOpen={false}
        className="mb-4"
      />

      {/* Report tabs */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {REPORTS.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setReport(r.id)}
            title={r.desc}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
              report === r.id
                ? 'border-[#00b4d8] bg-[#00b4d8] text-white'
                : 'border-neutral-200 bg-white text-neutral-600 hover:border-[#00b4d8]/50'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white px-4 py-3 flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          <Filter className="w-3.5 h-3.5" /> Filters
        </div>
        <label className="text-xs">
          <span className="block text-[10px] font-semibold text-slate-400 mb-0.5">
            Search
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Supplier or PO…"
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm w-40 sm:w-52"
          />
        </label>
        <label className="text-xs">
          <span className="block text-[10px] font-semibold text-slate-400 mb-0.5">
            PO status
          </span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm"
          >
            <option value="">All</option>
            {statusMix.map((s) => (
              <option key={s.status} value={s.status}>
                {s.status} ({s.count})
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          <span className="block text-[10px] font-semibold text-slate-400 mb-0.5">
            Sort scorecard
          </span>
          <select
            value={sortKey}
            onChange={(e) =>
              setSortKey(e.target.value as typeof sortKey)
            }
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm"
          >
            <option value="spend">Spend</option>
            <option value="otifef">OTIFEF</option>
            <option value="stars">Stars</option>
            <option value="open">Open POs</option>
            <option value="name">Name</option>
          </select>
        </label>
        <label className="text-xs">
          <span className="block text-[10px] font-semibold text-slate-400 mb-0.5">
            Min spend
          </span>
          <input
            value={minSpend}
            onChange={(e) => setMinSpend(e.target.value)}
            placeholder="0"
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm w-24"
          />
        </label>
        <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 pb-1.5">
          <input
            type="checkbox"
            checked={verifiedOnly}
            onChange={(e) => setVerifiedOnly(e.target.checked)}
            className="rounded border-slate-300"
          />
          Verified only
        </label>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => exportCsv(report === 'po_ledger' ? 'pos' : 'suppliers')}
          className="btn-secondary !py-1.5 !px-3 text-xs inline-flex items-center gap-1.5"
        >
          <Download className="w-3.5 h-3.5" /> Export CSV
        </button>
      </div>

      {loading ? (
        <div className="py-20 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <>
          {(report === 'overview' || report === 'scorecard') && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                <Card
                  label="OTIFEF overall"
                  value={`${(k?.otifefOverall ?? 0).toFixed(1)}%`}
                  sub={otBand.label}
                  tone="emerald"
                  icon={Truck}
                />
                <Card
                  label="On-time / In-full / Error-free"
                  value={`${(k?.otifefOnTime ?? 0).toFixed(0)} / ${(k?.otifefInFull ?? 0).toFixed(0)} / ${(k?.otifefErrorFree ?? 0).toFixed(0)}`}
                  sub="Objective PO metrics"
                  icon={TrendingUp}
                />
                <Card
                  label="Avg star rating given"
                  value={
                    k?.starAvgGiven != null ? k.starAvgGiven.toFixed(1) : '—'
                  }
                  sub={
                    k?.starAvgGiven != null
                      ? `${starGuide(k.starAvgGiven).label} · ${k.companiesStarRated} rated`
                      : 'No peer ratings yet'
                  }
                  tone="amber"
                  icon={Star}
                />
                <Card
                  label="Spend (period)"
                  value={formatMoney(k?.totalSpend ?? 0)}
                  sub={`${k?.poCount ?? 0} POs · ${k?.openPos ?? 0} open · avg ${formatMoney(k?.avgPoValue ?? 0)}`}
                  icon={Award}
                />
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-8">
                <Mini label="On book" value={k?.suppliersOnBook ?? 0} />
                <Mini label="Connected" value={k?.connected ?? 0} />
                <Mini label="Preferred" value={k?.preferred ?? 0} />
                <Mini label="Verified" value={k?.verified ?? 0} />
                <Mini label="Open RIAD" value={k?.openRiads ?? 0} />
                <Mini
                  label="Top-3 share"
                  value={`${k?.top3Share ?? 0}%`}
                  money={false}
                />
              </div>
            </>
          )}

          {report === 'overview' && (
            <div className="grid lg:grid-cols-2 gap-4 mb-8">
              <ChartCard title="Spend trend" subtitle="Monthly PO spend">
                <PnlTrendChart
                  labels={trendLabels}
                  revenue={trend.map((t) => t.spend)}
                  expenses={trend.map((t) => 0)}
                  netIncome={trend.map((t) => t.spend)}
                />
              </ChartCard>
              <ChartCard title="PO status mix" subtitle="Count by status">
                {statusSegments.length ? (
                  <MixDoughnut
                    segments={statusSegments}
                    centerLabel="POs"
                    centerValue={String(k?.poCount ?? 0)}
                  />
                ) : (
                  <p className="text-sm text-slate-500 p-6">No POs in period</p>
                )}
              </ChartCard>
            </div>
          )}

          {(report === 'overview' || report === 'scorecard') && (
            <ScorecardTable rows={filteredRows} />
          )}

          {report === 'spend' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Card
                  label="Total spend"
                  value={formatMoney(k?.totalSpend ?? 0)}
                  sub={`${k?.poCount ?? 0} POs`}
                  icon={Award}
                />
                <Card
                  label="Top-3 concentration"
                  value={`${k?.top3Share ?? 0}%`}
                  sub={
                    (k?.top3Share || 0) >= 60
                      ? 'High concentration risk'
                      : 'Diversification OK'
                  }
                  tone={(k?.top3Share || 0) >= 60 ? 'amber' : 'emerald'}
                  icon={PieChart}
                />
                <Card
                  label="Suppliers with spend"
                  value={String(
                    concentration.length ||
                      rows.filter((r) => (r.spend || 0) > 0).length
                  )}
                  icon={BarChart3}
                />
                <Card
                  label="Avg PO value"
                  value={formatMoney(k?.avgPoValue ?? 0)}
                  icon={FileText}
                />
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
                <div className="px-5 py-3 border-b text-xs font-semibold uppercase text-slate-500">
                  Pareto — cumulative spend share
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[640px]">
                    <thead>
                      <tr className="border-b text-left text-[10px] font-bold uppercase text-slate-400">
                        <th className="px-4 py-3">#</th>
                        <th className="px-3 py-3">Supplier</th>
                        <th className="px-3 py-3 text-right">Spend</th>
                        <th className="px-3 py-3 text-right">Share</th>
                        <th className="px-3 py-3 text-right">Cumulative</th>
                      </tr>
                    </thead>
                    <tbody>
                      {concentration.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                            No spend in period
                          </td>
                        </tr>
                      ) : (
                        concentration.map((r) => (
                          <tr
                            key={r.rank}
                            className="border-b border-slate-50 hover:bg-sky-50/40"
                          >
                            <td className="px-4 py-2.5 tabular-nums text-slate-400">
                              {r.rank}
                            </td>
                            <td className="px-3 py-2.5 font-semibold">{r.name}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums font-bold">
                              {formatMoney(r.spend)}
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums">
                              {r.share_pct}%
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <div className="inline-flex items-center gap-2 justify-end w-full">
                                <span className="tabular-nums font-semibold">
                                  {r.cumulative_pct}%
                                </span>
                                <span
                                  className="h-1.5 rounded-full bg-sky-400"
                                  style={{
                                    width: `${Math.min(100, r.cumulative_pct)}px`,
                                    maxWidth: '100px',
                                  }}
                                />
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {report === 'po_ledger' && (
            <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-5 py-3 border-b flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">
                    Purchase order ledger
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {filteredPos.length} POs in period · manage in{' '}
                    <Link
                      href="/dashboard/suppliers/po"
                      className="font-bold text-[#0077b6] hover:underline"
                    >
                      Suppliers → Order
                    </Link>
                  </p>
                </div>
                <Link
                  href="/dashboard/suppliers/po"
                  className="btn-primary !py-1.5 !px-3 text-xs"
                >
                  Raise / manage POs
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[800px]">
                  <thead>
                    <tr className="border-b text-left text-[10px] font-bold uppercase text-slate-400">
                      <th className="px-4 py-3">PO #</th>
                      <th className="px-3 py-3">Supplier</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3 text-right">Amount</th>
                      <th className="px-3 py-3">Promised</th>
                      <th className="px-3 py-3">Delivered</th>
                      <th className="px-3 py-3">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPos.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-4 py-12 text-center text-slate-500"
                        >
                          No purchase orders in this period.{' '}
                          <Link
                            href="/dashboard/suppliers/po"
                            className="font-bold text-[#0077b6] hover:underline"
                          >
                            Raise a PO →
                          </Link>
                        </td>
                      </tr>
                    ) : (
                      filteredPos.map((p) => (
                        <tr
                          key={p.id}
                          className="border-b border-slate-50 hover:bg-sky-50/40"
                        >
                          <td className="px-4 py-2.5 font-mono text-xs font-bold">
                            {p.po_number}
                            {p.is_hub_order ? (
                              <span className="ml-1 text-[9px] uppercase text-violet-700 bg-violet-50 border border-violet-100 rounded-full px-1.5 py-0.5">
                                Hub
                              </span>
                            ) : null}
                          </td>
                          <td className="px-3 py-2.5 font-semibold">
                            {p.supplier_name}
                          </td>
                          <td className="px-3 py-2.5 capitalize text-xs">
                            <span className="rounded-full bg-slate-50 border border-slate-200 px-2 py-0.5">
                              {p.status}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right font-bold tabular-nums">
                            {formatMoney(p.total_amount)}{' '}
                            <span className="text-[10px] text-slate-400 font-normal">
                              {p.currency}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-xs text-slate-600">
                            {p.promised_date || '—'}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-slate-600">
                            {p.actual_delivery_date || '—'}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-slate-500">
                            {p.created_at
                              ? String(p.created_at).slice(0, 10)
                              : '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {report === 'otifef' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Card
                  label="Overall"
                  value={`${(k?.otifefOverall ?? 0).toFixed(1)}%`}
                  sub={otBand.label}
                  tone="emerald"
                  icon={Truck}
                />
                <Card
                  label="On-time"
                  value={`${(k?.otifefOnTime ?? 0).toFixed(1)}%`}
                  icon={TrendingUp}
                />
                <Card
                  label="In-full"
                  value={`${(k?.otifefInFull ?? 0).toFixed(1)}%`}
                  icon={Award}
                />
                <Card
                  label="Error-free"
                  value={`${(k?.otifefErrorFree ?? 0).toFixed(1)}%`}
                  icon={ShieldCheck}
                />
              </div>
              <ScorecardTable
                rows={[...filteredRows]
                  .filter((r) => r.otifef_pct != null)
                  .sort((a, b) => (b.otifef_pct || 0) - (a.otifef_pct || 0))}
                highlight="otifef"
              />
            </div>
          )}

          {report === 'ratings' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                <Card
                  label="Avg stars given"
                  value={
                    k?.starAvgGiven != null ? k.starAvgGiven.toFixed(1) : '—'
                  }
                  sub={`${k?.companiesStarRated ?? 0} suppliers rated`}
                  tone="amber"
                  icon={Star}
                />
                <Card
                  label="Link"
                  value="Rate suppliers"
                  sub="After trade closes"
                  icon={Star}
                />
                <Link
                  href="/dashboard/suppliers/ratings"
                  className="rounded-3xl border border-amber-100 bg-amber-50/40 p-4 flex flex-col justify-center"
                >
                  <span className="text-sm font-black text-amber-950">
                    Open ratings workspace →
                  </span>
                  <span className="text-[11px] text-amber-800/80 mt-1">
                    Peer stars for quality, delivery, communication, value
                  </span>
                </Link>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[720px]">
                    <thead>
                      <tr className="border-b text-left text-[10px] font-bold uppercase text-slate-400">
                        <th className="px-4 py-3">Supplier</th>
                        <th className="px-3 py-3">Overall</th>
                        <th className="px-3 py-3">Quality</th>
                        <th className="px-3 py-3">Delivery</th>
                        <th className="px-3 py-3">Comm</th>
                        <th className="px-3 py-3">Value</th>
                        <th className="px-3 py-3">#</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows
                        .filter((r) => r.star_avg != null)
                        .sort((a, b) => (b.star_avg || 0) - (a.star_avg || 0))
                        .map((r) => (
                          <tr
                            key={r.supplier_profile_id}
                            className="border-b border-slate-50"
                          >
                            <td className="px-4 py-2.5 font-semibold">
                              {r.name}
                            </td>
                            <td className="px-3 py-2.5 font-bold text-amber-800">
                              {r.star_avg?.toFixed(1)}
                            </td>
                            <td className="px-3 py-2.5 tabular-nums">
                              {r.star_quality?.toFixed(1) ?? '—'}
                            </td>
                            <td className="px-3 py-2.5 tabular-nums">
                              {r.star_delivery?.toFixed(1) ?? '—'}
                            </td>
                            <td className="px-3 py-2.5 tabular-nums">
                              {r.star_communication?.toFixed(1) ?? '—'}
                            </td>
                            <td className="px-3 py-2.5 tabular-nums">
                              {r.star_value?.toFixed(1) ?? '—'}
                            </td>
                            <td className="px-3 py-2.5 tabular-nums">
                              {r.star_count ?? 0}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {report === 'risk' && (
            <div className="space-y-4">
              {risk?.singleSourceRisk ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 flex gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  {risk.singleSourceRisk.message}
                </div>
              ) : null}
              <div className="grid lg:grid-cols-2 gap-4">
                <RiskList
                  title="Low OTIFEF (need attention)"
                  empty="No underperforming suppliers"
                  items={(risk?.lowOtifef || []).map((r) => ({
                    name: r.name,
                    primary: `${(r.otifef_pct ?? 0).toFixed(1)}%`,
                    secondary: `${r.otifef_po_count ?? 0} scored POs`,
                  }))}
                />
                <RiskList
                  title="Late deliveries"
                  empty="No late flags"
                  items={(risk?.lateDeliveries || []).map((r) => ({
                    name: r.name,
                    primary: `${r.po_late ?? 0} late`,
                    secondary: `${r.po_count ?? 0} POs`,
                  }))}
                />
                <RiskList
                  title="Open POs (exposure)"
                  empty="No open POs"
                  items={(risk?.highOpenSpend || []).map((r) => ({
                    name: r.name,
                    primary: `${r.po_open ?? 0} open`,
                    secondary: formatMoney(r.spend || 0),
                  }))}
                />
                <RiskList
                  title="Low peer stars"
                  empty="No low ratings"
                  items={(risk?.lowStars || []).map((r) => ({
                    name: r.name,
                    primary: `${(r.star_avg ?? 0).toFixed(1)} ★`,
                    secondary: `${r.star_count} ratings`,
                  }))}
                />
              </div>
            </div>
          )}

          {report === 'status_mix' && (
            <div className="grid lg:grid-cols-2 gap-4">
              <ChartCard title="PO status" subtitle="Count">
                {statusSegments.length ? (
                  <MixDoughnut
                    segments={statusSegments}
                    centerLabel="POs"
                    centerValue={String(k?.poCount ?? 0)}
                  />
                ) : (
                  <p className="text-sm text-slate-500 p-6">No data</p>
                )}
              </ChartCard>
              <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
                <div className="px-5 py-3 border-b text-xs font-semibold uppercase text-slate-500">
                  Status breakdown
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-[10px] font-bold uppercase text-slate-400">
                      <th className="px-4 py-3">Status</th>
                      <th className="px-3 py-3 text-right">Count</th>
                      <th className="px-3 py-3 text-right">Spend</th>
                      <th className="px-3 py-3 text-right">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statusMix.map((s) => (
                      <tr key={s.status} className="border-b border-slate-50">
                        <td className="px-4 py-2.5 capitalize font-semibold">
                          {s.status}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {s.count}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-bold">
                          {formatMoney(s.spend)}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {s.share_pct}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {report === 'trend' && (
            <div className="space-y-4">
              <ChartCard title="Monthly PO spend" subtitle={period.label}>
                <PnlTrendChart
                  labels={trendLabels}
                  revenue={trend.map((t) => t.spend)}
                  expenses={trend.map(() => 0)}
                  netIncome={trend.map((t) => t.spend)}
                />
              </ChartCard>
              <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-[10px] font-bold uppercase text-slate-400">
                      <th className="px-4 py-3">Month</th>
                      <th className="px-3 py-3 text-right">POs</th>
                      <th className="px-3 py-3 text-right">Spend</th>
                      <th className="px-3 py-3 text-right">Open</th>
                      <th className="px-3 py-3 text-right">Completed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trend.map((t) => (
                      <tr key={t.month} className="border-b border-slate-50">
                        <td className="px-4 py-2.5 font-mono text-xs font-bold">
                          {t.month}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {t.count}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-bold">
                          {formatMoney(t.spend)}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {t.open}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {t.completed}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {report === 'book' && bookHealth && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Card
                  label="On book"
                  value={String(bookHealth.onBook)}
                  icon={BookOpen}
                />
                <Card
                  label="Connected"
                  value={String(bookHealth.connected)}
                  tone="emerald"
                  icon={ShieldCheck}
                />
                <Card
                  label="With spend (period)"
                  value={String(bookHealth.withSpend)}
                  icon={Award}
                />
                <Card
                  label="Inactive (no PO)"
                  value={String(Math.max(0, bookHealth.inactive))}
                  tone="amber"
                  icon={AlertTriangle}
                />
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Mini label="Preferred" value={bookHealth.preferred} />
                <Mini label="Verified" value={bookHealth.verified} />
                <Mini label="With OTIFEF" value={bookHealth.withOtifef} />
                <Mini label="With stars" value={bookHealth.withStars} />
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-5">
                <h3 className="text-sm font-black mb-3">Book by status</h3>
                <div className="flex flex-wrap gap-2">
                  {bookHealth.byStatus.map((s) => (
                    <span
                      key={s.status}
                      className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold capitalize"
                    >
                      {s.status}: {s.count}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </SuppliersPage>
  );
}

function ScorecardTable({
  rows,
  highlight,
}: {
  rows: SupplierRow[];
  highlight?: 'otifef';
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-5 py-3 border-b text-xs font-semibold uppercase text-slate-500 flex justify-between">
        <span>Supplier scorecard · {rows.length} rows</span>
        <span className="font-normal normal-case text-slate-400">
          OTIFEF = objective · Stars = peer · Trust = composite
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead>
            <tr className="border-b border-slate-100 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <th className="px-4 py-3">Supplier</th>
              <th className="px-3 py-3">OTIFEF</th>
              <th className="px-3 py-3">Stars</th>
              <th className="px-3 py-3">Trust</th>
              <th className="px-3 py-3 text-right">Spend</th>
              <th className="px-3 py-3 text-right">Share</th>
              <th className="px-3 py-3 text-right">POs</th>
              <th className="px-3 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                  No supplier data for this filter / period.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const tb = trustBand(Number(r.trust_score || 0));
                return (
                  <tr
                    key={r.supplier_profile_id}
                    className={`border-b border-slate-50 hover:bg-sky-50/40 ${
                      highlight === 'otifef' &&
                      r.otifef_pct != null &&
                      r.otifef_pct < 80
                        ? 'bg-amber-50/30'
                        : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">
                        {r.name}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {[r.city, r.country].filter(Boolean).join(', ')}
                      </div>
                      {r.verified && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700">
                          <ShieldCheck className="w-3 h-3" /> Verified
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {r.otifef_pct != null ? (
                        <div>
                          <div className="font-bold tabular-nums">
                            {r.otifef_pct.toFixed(1)}%
                          </div>
                          <div className="text-[10px] text-slate-500">
                            OT {(r.otifef_on_time ?? 0).toFixed(0)} · IF{' '}
                            {(r.otifef_in_full ?? 0).toFixed(0)} · EF{' '}
                            {(r.otifef_error_free ?? 0).toFixed(0)}
                          </div>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {r.star_avg != null ? (
                        <div>
                          <div className="font-bold text-amber-800">
                            {r.star_avg.toFixed(1)}
                          </div>
                          <StarRating value={r.star_avg} readOnly size="sm" />
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {r.trust_score != null ? (
                        <span className="font-semibold">
                          {Number(r.trust_score).toFixed(0)}{' '}
                          <span className="text-[10px] text-slate-500">
                            {tb.label}
                          </span>
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums font-medium">
                      {formatMoney(r.spend ?? 0)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-600">
                      {r.spend_share_pct != null ? `${r.spend_share_pct}%` : '—'}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {r.po_count ?? 0}
                      {(r.po_open || 0) > 0 && (
                        <span className="text-[10px] text-amber-700 block">
                          {r.po_open} open
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 capitalize text-xs text-slate-600">
                      {r.status || '—'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card({
  label,
  value,
  sub,
  tone = 'neutral',
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'neutral' | 'emerald' | 'amber';
  icon: React.ComponentType<{ className?: string }>;
}) {
  const bg =
    tone === 'emerald'
      ? 'border-emerald-100 bg-emerald-50/40'
      : tone === 'amber'
        ? 'border-amber-100 bg-amber-50/40'
        : 'border-slate-200 bg-white';
  return (
    <div className={`rounded-3xl border p-4 ${bg}`}>
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
        <Icon className="w-3.5 h-3.5 text-[#00b4d8]" />
        {label}
      </div>
      <div className="text-xl font-black text-slate-900 tabular-nums break-all">
        {value}
      </div>
      {sub && <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function Mini({
  label,
  value,
  money,
}: {
  label: string;
  value: number | string;
  money?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-center">
      <div className="text-lg font-black tabular-nums">
        {typeof value === 'number' && money ? formatMoney(value) : value}
      </div>
      <div className="text-[10px] font-semibold uppercase text-slate-400">
        {label}
      </div>
    </div>
  );
}

function RiskList({
  title,
  empty,
  items,
}: {
  title: string;
  empty: string;
  items: Array<{ name: string; primary: string; secondary: string }>;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-black text-slate-900 mb-3 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-500" />
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">{empty}</p>
      ) : (
        <ol className="space-y-2">
          {items.map((it, i) => (
            <li
              key={`${it.name}-${i}`}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span className="font-semibold text-slate-800 truncate">
                {i + 1}. {it.name}
              </span>
              <span className="text-right shrink-0">
                <span className="font-bold tabular-nums">{it.primary}</span>
                <span className="block text-[10px] text-slate-400">
                  {it.secondary}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function csv(s: string) {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
