'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Loader2,
  RefreshCw,
  Star,
  TrendingUp,
  ShoppingCart,
  Wallet,
  MessageSquare,
  FileText,
  AlertTriangle,
  PieChart,
  BarChart3,
  Download,
  Filter,
  ExternalLink,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { formatMoney } from '@/lib/accounting/types';
import {
  CompanyRequired,
  CustomersHeader,
  CustomersPage,
} from '@/components/customers/CustomersShell';
import { StarRating } from '@/components/ratings';
import { OtifefKpiCard } from '@/components/portals/OtifefKpiCard';
import type { OtifefMetrics } from '@/lib/suppliers/types';
import PeriodSlicer, {
  initialPeriodSlicerValue,
  type PeriodSlicerValue,
} from '@/components/accounting/PeriodSlicer';
import {
  ChartCard,
  MixDoughnut,
  PnlTrendChart,
} from '@/components/accounting/AccountingCharts';

const REPORTS = [
  { id: 'overview', label: 'Overview', desc: 'Executive KPIs' },
  { id: 'scorecard', label: 'Scorecard', desc: 'Customer rank table' },
  { id: 'revenue', label: 'Revenue & Pareto', desc: 'Concentration' },
  { id: 'orders', label: 'Order ledger', desc: 'All sales orders' },
  { id: 'invoices', label: 'Invoice ledger', desc: 'Billed & open' },
  { id: 'ar_aging', label: 'AR aging', desc: 'Collections risk' },
  { id: 'pipeline', label: 'Pipeline', desc: 'Leads & opportunities' },
  { id: 'otifef', label: 'OTIFEF', desc: 'On-time / in-full / error-free' },
  { id: 'ratings', label: 'Ratings', desc: 'Peer + feedback' },
  { id: 'claims', label: 'Claims', desc: 'Disputes & claims' },
  { id: 'trend', label: 'Trends', desc: 'Monthly revenue' },
  { id: 'risk', label: 'Risk', desc: 'Flags & alerts' },
] as const;

type ReportId = (typeof REPORTS)[number]['id'];

type Kpis = {
  customersTotal: number;
  customersActive: number;
  invitePending: number;
  inviteAccepted: number;
  openLeads: number;
  openOpportunities: number;
  pipelineValue: number;
  weightedPipeline: number;
  wonValue: number;
  ordersCount: number;
  orderRevenue: number;
  invoicesCount: number;
  billed: number;
  arOpen: number;
  unassignedBilled?: number;
  openClaims: number;
  claimsTotal?: number;
  top3Share?: number;
  avgOrderValue?: number;
  starAvgGiven: number | null;
  customersStarRated: number;
  feedbackAvgStars?: number | null;
  feedbackCount?: number;
  agingOver60?: number;
};

type CustomerRow = {
  customer_id: number;
  name: string;
  status?: string | null;
  invite_status?: string | null;
  order_count?: number;
  order_revenue?: number;
  invoice_count?: number;
  billed?: number;
  ar_open?: number;
  star_avg?: number | null;
  star_count?: number;
  star_payment?: number | null;
  star_communication?: number | null;
  star_reliability?: number | null;
  feedback_count?: number;
  feedback_star_avg?: number | null;
  feedback_otifef_avg?: number | null;
  city?: string | null;
  country?: string | null;
};

type OrderRow = {
  order_id: number;
  order_number: string;
  customer_id: number | null;
  customer_name: string;
  total_amount: number;
  status?: string | null;
  created_at?: string | null;
  invoice_number?: string | null;
  feedback_count: number;
  star_avg: number | null;
  otifef_avg: number | null;
};

type InvoiceRow = {
  id: number;
  source: string;
  number: string | null;
  customer_id: number | null;
  customer_name: string | null;
  total: number;
  open: number;
  status: string;
  date: string | null;
  feedback_star_avg: number | null;
  feedback_count: number;
};

export default function CustomerReportPage() {
  return (
    <CompanyRequired>
      <Suspense
        fallback={
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-[#00b4d8]" />
          </div>
        }
      >
        <Inner />
      </Suspense>
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const searchParams = useSearchParams();
  const [report, setReport] = useState<ReportId>('overview');
  const [period, setPeriod] = useState<PeriodSlicerValue>(() =>
    initialPeriodSlicerValue('ytd', 3)
  );
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [recentFeedback, setRecentFeedback] = useState<
    Array<{
      id: number;
      invoice_number: string | null;
      customer_name: string | null;
      rating: number | null;
      otifef_score: number | null;
      title: string | null;
      created_at: string | null;
    }>
  >([]);
  const [concentration, setConcentration] = useState<
    Array<{
      rank: number;
      name: string;
      revenue: number;
      share_pct: number;
      cumulative_pct: number;
    }>
  >([]);
  const [trend, setTrend] = useState<
    Array<{
      month: string;
      orders: number;
      orderRevenue: number;
      invoices: number;
      billed: number;
    }>
  >([]);
  const [aging, setAging] = useState<{
    buckets: {
      current: number;
      d1_30: number;
      d31_60: number;
      d61_90: number;
      d90_plus: number;
      total: number;
    };
    rows: Array<{
      id: number;
      number: string | null;
      customer_name: string | null;
      open: number;
      days: number;
      bucket: string;
      due_date: string | null;
    }>;
  } | null>(null);
  const [pipelineStages, setPipelineStages] = useState<
    Array<{ stage: string; count: number; amount: number; weighted: number }>
  >([]);
  const [orderStatusMix, setOrderStatusMix] = useState<
    Array<{ status: string; count: number; revenue: number }>
  >([]);
  const [claimsByStatus, setClaimsByStatus] = useState<
    Array<{ status: string; count: number }>
  >([]);
  const [risk, setRisk] = useState<{
    highAr: CustomerRow[];
    lowFeedback: CustomerRow[];
    lowPeerStars: CustomerRow[];
    concentration: { message: string; top3Share: number } | null;
    agingOver60: number;
  } | null>(null);

  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortKey, setSortKey] = useState<
    'billed' | 'revenue' | 'ar' | 'stars' | 'name'
  >('billed');
  const [minBilled, setMinBilled] = useState('');
  const [otifefSummary, setOtifefSummary] = useState<OtifefMetrics | null>(null);
  const [otifefRows, setOtifefRows] = useState<
    Array<{
      customer_id: number;
      name: string;
      overall: number;
      ot_percent: number;
      if_percent: number;
      ef_percent: number;
      total_orders: number;
    }>
  >([]);

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t === 'otifef') setReport('otifef');
  }, [searchParams]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        companyId: String(companyId),
        from: period.from,
        to: period.to,
      });
      const res = await fetch(`/api/customers/report?${params}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load report');
      setKpis(data.kpis || null);
      setRows(data.customers || []);
      setOrders(data.orders || []);
      setInvoices(data.invoices || []);
      setRecentFeedback(data.recentFeedback || []);
      setConcentration(data.concentration || []);
      setTrend(data.trend || []);
      setAging(data.aging || null);
      setPipelineStages(data.pipelineStages || []);
      setOrderStatusMix(data.orderStatusMix || []);
      setClaimsByStatus(data.claimsByStatus || []);
      setRisk(data.risk || null);
      if (data.warnings?.length) toast.message(String(data.warnings[0]));
      const ot = await fetch(
        `/api/customers/otifef?companyId=${companyId}&from=${period.from}&to=${period.to}`,
        { cache: 'no-store' }
      );
      const otData = await ot.json();
      setOtifefSummary(otData.summary || null);
      setOtifefRows(otData.rows || []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId, period.from, period.to]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredRows = useMemo(() => {
    let list = [...rows];
    const qq = q.trim().toLowerCase();
    if (qq) list = list.filter((r) => r.name.toLowerCase().includes(qq));
    if (statusFilter) {
      list = list.filter(
        (r) =>
          String(r.status || '').toLowerCase() === statusFilter ||
          String(r.invite_status || '').toLowerCase() === statusFilter
      );
    }
    const min = Number(minBilled);
    if (Number.isFinite(min) && min > 0) {
      list = list.filter(
        (r) => (r.billed || r.order_revenue || 0) >= min
      );
    }
    list.sort((a, b) => {
      if (sortKey === 'name') return a.name.localeCompare(b.name);
      if (sortKey === 'ar') return (b.ar_open || 0) - (a.ar_open || 0);
      if (sortKey === 'stars')
        return (b.feedback_star_avg || b.star_avg || 0) -
          (a.feedback_star_avg || a.star_avg || 0);
      if (sortKey === 'revenue')
        return (b.order_revenue || 0) - (a.order_revenue || 0);
      return (b.billed || b.order_revenue || 0) -
        (a.billed || a.order_revenue || 0);
    });
    return list;
  }, [rows, q, statusFilter, minBilled, sortKey]);

  const filteredOrders = useMemo(() => {
    let list = [...orders];
    const qq = q.trim().toLowerCase();
    if (qq) {
      list = list.filter(
        (o) =>
          o.customer_name.toLowerCase().includes(qq) ||
          o.order_number.toLowerCase().includes(qq)
      );
    }
    if (statusFilter) {
      list = list.filter(
        (o) => String(o.status || '').toLowerCase() === statusFilter
      );
    }
    return list;
  }, [orders, q, statusFilter]);

  const filteredInvoices = useMemo(() => {
    let list = [...invoices];
    const qq = q.trim().toLowerCase();
    if (qq) {
      list = list.filter(
        (i) =>
          (i.customer_name || '').toLowerCase().includes(qq) ||
          (i.number || '').toLowerCase().includes(qq)
      );
    }
    return list;
  }, [invoices, q]);

  const k = kpis;
  const trendLabels = trend.map((t) => t.month);

  const exportCsv = (kind: 'customers' | 'orders' | 'invoices') => {
    const lines: string[] = [];
    if (kind === 'customers') {
      lines.push(
        'Customer,Billed,OrderRevenue,AROpen,Orders,Invoices,FeedbackStars,PeerStars,Status'
      );
      for (const r of filteredRows) {
        lines.push(
          [
            csv(r.name),
            r.billed ?? 0,
            r.order_revenue ?? 0,
            r.ar_open ?? 0,
            r.order_count ?? 0,
            r.invoice_count ?? 0,
            r.feedback_star_avg ?? '',
            r.star_avg ?? '',
            r.status || '',
          ].join(',')
        );
      }
    } else if (kind === 'orders') {
      lines.push('Order,Customer,Amount,Status,Stars,OTIFEF,Created');
      for (const o of filteredOrders) {
        lines.push(
          [
            csv(o.order_number),
            csv(o.customer_name),
            o.total_amount,
            o.status || '',
            o.star_avg ?? '',
            o.otifef_avg ?? '',
            o.created_at ? String(o.created_at).slice(0, 10) : '',
          ].join(',')
        );
      }
    } else {
      lines.push('Invoice,Customer,Date,Total,Open,Status,Source');
      for (const i of filteredInvoices) {
        lines.push(
          [
            csv(i.number || `#${i.id}`),
            csv(i.customer_name || 'Unassigned'),
            i.date || '',
            i.total,
            i.open,
            i.status,
            i.source,
          ].join(',')
        );
      }
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customer-${kind}-${period.from}_${period.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportKind =
    report === 'orders'
      ? 'orders'
      : report === 'invoices' || report === 'ar_aging'
        ? 'invoices'
        : 'customers';

  return (
    <CustomersPage>
      <CustomersHeader
        title="Customer reports"
        titleAccent="Insights · A4 landscape"
        description={`CRM decision pack · ${period.label} (${period.from} → ${period.to}). Orders, invoices, AR, pipeline, ratings & risk.`}
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/customers/orders"
              className="btn-secondary !py-2.5 !px-4 text-sm inline-flex items-center gap-2"
            >
              <ShoppingCart className="w-4 h-4" /> Orders
            </Link>
            <Link
              href="/dashboard/customers/invoices"
              className="btn-secondary !py-2.5 !px-4 text-sm inline-flex items-center gap-2"
            >
              <FileText className="w-4 h-4" /> Invoices
            </Link>
            <button
              type="button"
              onClick={() => void load()}
              className="btn-primary !py-2.5 !px-4 text-sm inline-flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
          </div>
        }
      />

      <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm text-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-bold text-slate-900">Sales orders & invoices</p>
          <p className="text-xs text-slate-600 mt-0.5">
            <strong>Customers → Order</strong> for sales orders / inbound POs ·{' '}
            <strong>Invoice</strong> to bill · use ledger tabs below for
            period analytics.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/customers/orders"
            className="btn-primary !py-2 !px-3 text-xs inline-flex items-center gap-1.5"
          >
            Orders <ExternalLink className="w-3.5 h-3.5" />
          </Link>
          <Link
            href="/dashboard/customers/invoices"
            className="btn-secondary !py-2 !px-3 text-xs"
          >
            Invoices
          </Link>
        </div>
      </div>

      <PeriodSlicer
        value={period}
        onChange={setPeriod}
        showTrailing
        defaultOpen={false}
        className="mb-4"
      />

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
            placeholder="Customer / order / inv…"
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm w-40 sm:w-52"
          />
        </label>
        <label className="text-xs">
          <span className="block text-[10px] font-semibold text-slate-400 mb-0.5">
            Status
          </span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm"
          >
            <option value="">All</option>
            {orderStatusMix.map((s) => (
              <option key={s.status} value={s.status}>
                Order: {s.status} ({s.count})
              </option>
            ))}
            <option value="active">Customer: active</option>
            <option value="pending">Invite: pending</option>
          </select>
        </label>
        <label className="text-xs">
          <span className="block text-[10px] font-semibold text-slate-400 mb-0.5">
            Sort
          </span>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as typeof sortKey)}
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm"
          >
            <option value="billed">Billed</option>
            <option value="revenue">Order revenue</option>
            <option value="ar">AR open</option>
            <option value="stars">Stars</option>
            <option value="name">Name</option>
          </select>
        </label>
        <label className="text-xs">
          <span className="block text-[10px] font-semibold text-slate-400 mb-0.5">
            Min billed
          </span>
          <input
            value={minBilled}
            onChange={(e) => setMinBilled(e.target.value)}
            placeholder="0"
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm w-24"
          />
        </label>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => exportCsv(exportKind)}
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
                  icon={TrendingUp}
                  label="Pipeline (open)"
                  value={formatMoney(k?.pipelineValue ?? 0)}
                  sub={`Weighted ${formatMoney(k?.weightedPipeline ?? 0)} · ${k?.openOpportunities ?? 0} opps`}
                />
                <Card
                  icon={ShoppingCart}
                  label="Order revenue"
                  value={formatMoney(k?.orderRevenue ?? 0)}
                  sub={`${k?.ordersCount ?? 0} orders · avg ${formatMoney(k?.avgOrderValue ?? 0)}`}
                  tone="emerald"
                />
                <Card
                  icon={Wallet}
                  label="Billed (invoices)"
                  value={formatMoney(k?.billed ?? 0)}
                  sub={`AR open ${formatMoney(k?.arOpen ?? 0)} · ${k?.invoicesCount ?? 0} inv`}
                  tone="amber"
                />
                <Card
                  icon={MessageSquare}
                  label="Customer feedback"
                  value={
                    k?.feedbackAvgStars != null
                      ? `${k.feedbackAvgStars.toFixed(1)} ★`
                      : '—'
                  }
                  sub={
                    k?.feedbackCount
                      ? `${k.feedbackCount} invoice QR ratings`
                      : 'No feedback yet'
                  }
                />
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-8">
                <Mini label="Customers" value={k?.customersTotal ?? 0} />
                <Mini label="Active" value={k?.customersActive ?? 0} />
                <Mini label="Open leads" value={k?.openLeads ?? 0} />
                <Mini label="Won value" value={formatMoney(k?.wonValue ?? 0)} />
                <Mini
                  label="Top-3 share"
                  value={`${k?.top3Share ?? 0}%`}
                />
                <Mini label="Open claims" value={k?.openClaims ?? 0} />
              </div>
              {(k?.unassignedBilled || 0) > 0 && (
                <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                  <strong>{formatMoney(k!.unassignedBilled!)}</strong> billed
                  is not linked to a customer record.
                </div>
              )}
            </>
          )}

          {report === 'overview' && (
            <div className="grid lg:grid-cols-2 gap-4 mb-8">
              <ChartCard title="Revenue trend" subtitle="Orders vs billed">
                <PnlTrendChart
                  labels={trendLabels}
                  revenue={trend.map((t) => t.billed)}
                  expenses={trend.map((t) => t.orderRevenue)}
                  netIncome={trend.map((t) => t.billed)}
                />
              </ChartCard>
              <ChartCard title="Order status mix" subtitle="Count">
                {orderStatusMix.length ? (
                  <MixDoughnut
                    segments={orderStatusMix.map((s) => ({
                      label: s.status,
                      value: s.count,
                    }))}
                    centerLabel="Orders"
                    centerValue={String(k?.ordersCount ?? 0)}
                  />
                ) : (
                  <p className="text-sm text-slate-500 p-6">No orders</p>
                )}
              </ChartCard>
            </div>
          )}

          {(report === 'overview' || report === 'scorecard') && (
            <CustomerScorecard rows={filteredRows} />
          )}

          {report === 'revenue' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Card
                  icon={Wallet}
                  label="Billed"
                  value={formatMoney(k?.billed ?? 0)}
                />
                <Card
                  icon={ShoppingCart}
                  label="Order revenue"
                  value={formatMoney(k?.orderRevenue ?? 0)}
                  tone="emerald"
                />
                <Card
                  icon={PieChart}
                  label="Top-3 share"
                  value={`${k?.top3Share ?? 0}%`}
                  tone={(k?.top3Share || 0) >= 50 ? 'amber' : 'neutral'}
                  sub={
                    (k?.top3Share || 0) >= 50
                      ? 'Concentration risk'
                      : 'Diversified'
                  }
                />
                <Card
                  icon={Users}
                  label="Customers with volume"
                  value={String(concentration.length)}
                />
              </div>
              <ParetoTable rows={concentration} />
            </div>
          )}

          {report === 'orders' && (
            <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-5 py-3 border-b flex justify-between items-center gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">
                    Order ledger
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {filteredOrders.length} orders · manage in{' '}
                    <Link
                      href="/dashboard/customers/orders"
                      className="font-bold text-[#0077b6] hover:underline"
                    >
                      Customers → Order
                    </Link>
                  </p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[760px]">
                  <thead>
                    <tr className="border-b text-left text-[10px] font-bold uppercase text-slate-400">
                      <th className="px-4 py-3">Order</th>
                      <th className="px-3 py-3">Customer</th>
                      <th className="px-3 py-3 text-right">Amount</th>
                      <th className="px-3 py-3">Invoice</th>
                      <th className="px-3 py-3">Stars</th>
                      <th className="px-3 py-3">OTIFEF</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-4 py-12 text-center text-slate-500"
                        >
                          No orders in this period.
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map((o) => (
                        <tr
                          key={o.order_id}
                          className="border-b border-slate-50 hover:bg-sky-50/40"
                        >
                          <td className="px-4 py-2.5 font-mono text-xs font-bold">
                            {o.order_number}
                          </td>
                          <td className="px-3 py-2.5 font-semibold">
                            {o.customer_name}
                          </td>
                          <td className="px-3 py-2.5 text-right font-bold tabular-nums">
                            {formatMoney(o.total_amount)}
                          </td>
                          <td className="px-3 py-2.5 text-xs font-mono">
                            {o.invoice_number || '—'}
                          </td>
                          <td className="px-3 py-2.5">
                            {o.star_avg != null ? (
                              <span className="font-bold text-amber-800">
                                {o.star_avg.toFixed(1)} ★
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-3 py-2.5 tabular-nums">
                            {o.otifef_avg != null ? o.otifef_avg : '—'}
                          </td>
                          <td className="px-3 py-2.5 capitalize text-xs">
                            {o.status || '—'}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-slate-500">
                            {o.created_at
                              ? String(o.created_at).slice(0, 10)
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

          {report === 'invoices' && (
            <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-5 py-3 border-b flex justify-between">
                <span className="text-xs font-semibold uppercase text-slate-500">
                  Invoice ledger · {filteredInvoices.length} · billed{' '}
                  {formatMoney(k?.billed ?? 0)}
                </span>
                <Link
                  href="/dashboard/customers/invoices"
                  className="text-xs font-bold text-[#0077b6] hover:underline"
                >
                  Invoice workspace →
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[720px]">
                  <thead>
                    <tr className="border-b text-left text-[10px] font-bold uppercase text-slate-400">
                      <th className="px-4 py-3">Invoice</th>
                      <th className="px-3 py-3">Customer</th>
                      <th className="px-3 py-3">Date</th>
                      <th className="px-3 py-3 text-right">Total</th>
                      <th className="px-3 py-3 text-right">Open</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3">Feedback</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInvoices.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-4 py-12 text-center text-slate-500"
                        >
                          No invoices in period.
                        </td>
                      </tr>
                    ) : (
                      filteredInvoices.map((inv) => (
                        <tr
                          key={`${inv.source}-${inv.id}`}
                          className="border-b border-slate-50 hover:bg-sky-50/40"
                        >
                          <td className="px-4 py-2.5 font-mono text-xs font-bold">
                            {inv.number || `#${inv.id}`}
                            <span className="block text-[10px] text-slate-400 font-normal">
                              {inv.source}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 font-semibold">
                            {inv.customer_name || (
                              <span className="text-amber-700">Unassigned</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-xs">{inv.date || '—'}</td>
                          <td className="px-3 py-2.5 text-right font-bold tabular-nums">
                            {formatMoney(inv.total)}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            {formatMoney(inv.open)}
                          </td>
                          <td className="px-3 py-2.5 capitalize text-xs">
                            {inv.status}
                          </td>
                          <td className="px-3 py-2.5">
                            {inv.feedback_star_avg != null
                              ? `${inv.feedback_star_avg.toFixed(1)} ★`
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

          {report === 'ar_aging' && aging && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                <Mini label="Current" value={formatMoney(aging.buckets.current)} />
                <Mini label="1–30d" value={formatMoney(aging.buckets.d1_30)} />
                <Mini label="31–60d" value={formatMoney(aging.buckets.d31_60)} />
                <Mini label="61–90d" value={formatMoney(aging.buckets.d61_90)} />
                <Mini label="90d+" value={formatMoney(aging.buckets.d90_plus)} />
                <Mini label="Total AR" value={formatMoney(aging.buckets.total)} />
              </div>
              <ChartCard title="AR aging buckets" subtitle="Open balance">
                <MixDoughnut
                  segments={[
                    { label: 'Current', value: aging.buckets.current },
                    { label: '1-30', value: aging.buckets.d1_30 },
                    { label: '31-60', value: aging.buckets.d31_60 },
                    { label: '61-90', value: aging.buckets.d61_90 },
                    { label: '90+', value: aging.buckets.d90_plus },
                  ]}
                  centerLabel="AR"
                  centerValue={formatMoney(aging.buckets.total)}
                />
              </ChartCard>
              <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
                <div className="px-5 py-3 border-b text-xs font-semibold uppercase text-slate-500">
                  Aged invoices (oldest first)
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[640px]">
                    <thead>
                      <tr className="border-b text-left text-[10px] font-bold uppercase text-slate-400">
                        <th className="px-4 py-3">Invoice</th>
                        <th className="px-3 py-3">Customer</th>
                        <th className="px-3 py-3 text-right">Open</th>
                        <th className="px-3 py-3 text-right">Days</th>
                        <th className="px-3 py-3">Bucket</th>
                        <th className="px-3 py-3">Due / date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aging.rows.map((r) => (
                        <tr
                          key={r.id}
                          className={`border-b border-slate-50 ${
                            r.days > 60 ? 'bg-amber-50/40' : ''
                          }`}
                        >
                          <td className="px-4 py-2.5 font-mono text-xs font-bold">
                            {r.number || `#${r.id}`}
                          </td>
                          <td className="px-3 py-2.5 font-semibold">
                            {r.customer_name || '—'}
                          </td>
                          <td className="px-3 py-2.5 text-right font-bold tabular-nums">
                            {formatMoney(r.open)}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            {r.days}
                          </td>
                          <td className="px-3 py-2.5 text-xs font-semibold">
                            {r.bucket}
                          </td>
                          <td className="px-3 py-2.5 text-xs">{r.due_date || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {report === 'pipeline' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Card
                  icon={TrendingUp}
                  label="Open pipeline"
                  value={formatMoney(k?.pipelineValue ?? 0)}
                  sub={`${k?.openOpportunities ?? 0} opportunities`}
                />
                <Card
                  icon={BarChart3}
                  label="Weighted"
                  value={formatMoney(k?.weightedPipeline ?? 0)}
                  tone="emerald"
                />
                <Card
                  icon={Users}
                  label="Open leads"
                  value={String(k?.openLeads ?? 0)}
                />
                <Card
                  icon={TrendingUp}
                  label="Won value"
                  value={formatMoney(k?.wonValue ?? 0)}
                />
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
                <div className="px-5 py-3 border-b text-xs font-semibold uppercase text-slate-500">
                  Pipeline by stage
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-[10px] font-bold uppercase text-slate-400">
                      <th className="px-4 py-3">Stage</th>
                      <th className="px-3 py-3 text-right">#</th>
                      <th className="px-3 py-3 text-right">Amount</th>
                      <th className="px-3 py-3 text-right">Weighted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pipelineStages.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-4 py-10 text-center text-slate-500"
                        >
                          No open opportunities.
                        </td>
                      </tr>
                    ) : (
                      pipelineStages.map((s) => (
                        <tr key={s.stage} className="border-b border-slate-50">
                          <td className="px-4 py-2.5 font-semibold capitalize">
                            {s.stage.replace(/_/g, ' ')}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            {s.count}
                          </td>
                          <td className="px-3 py-2.5 text-right font-bold tabular-nums">
                            {formatMoney(s.amount)}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            {formatMoney(s.weighted)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <Link
                href="/dashboard/customers/leads"
                className="text-sm font-bold text-[#0077b6] hover:underline"
              >
                Open leads & pipeline →
              </Link>
            </div>
          )}

          {report === 'otifef' && (
            <div className="space-y-4">
              <OtifefKpiCard metrics={otifefSummary} kind="customer" />
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="border-b text-left text-[10px] font-bold uppercase text-slate-400">
                        <th className="px-4 py-3">Customer</th>
                        <th className="px-3 py-3 text-right">OTIFEF</th>
                        <th className="px-3 py-3 text-right">On time</th>
                        <th className="px-3 py-3 text-right">In full</th>
                        <th className="px-3 py-3 text-right">Error-free</th>
                        <th className="px-3 py-3 text-right">Orders</th>
                      </tr>
                    </thead>
                    <tbody>
                      {otifefRows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-4 py-12 text-center text-slate-500"
                          >
                            No delivered sales orders in this period.
                          </td>
                        </tr>
                      ) : (
                        otifefRows.map((r) => (
                          <tr
                            key={r.customer_id}
                            className="border-b border-slate-50"
                          >
                            <td className="px-4 py-2.5 font-semibold">
                              {r.name}
                            </td>
                            <td className="px-3 py-2.5 text-right font-black tabular-nums">
                              {r.overall.toFixed(1)}%
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums">
                              {r.ot_percent.toFixed(1)}%
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums">
                              {r.if_percent.toFixed(1)}%
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums">
                              {r.ef_percent.toFixed(1)}%
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums">
                              {r.total_orders}
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

          {report === 'ratings' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                <Card
                  icon={Star}
                  label="Peer stars (you→them)"
                  value={
                    k?.starAvgGiven != null
                      ? k.starAvgGiven.toFixed(1)
                      : '—'
                  }
                  sub={`${k?.customersStarRated ?? 0} rated`}
                  tone="amber"
                />
                <Card
                  icon={MessageSquare}
                  label="Invoice feedback"
                  value={
                    k?.feedbackAvgStars != null
                      ? `${k.feedbackAvgStars.toFixed(1)} ★`
                      : '—'
                  }
                  sub={`${k?.feedbackCount ?? 0} ratings`}
                />
                <Link
                  href="/dashboard/customers/ratings"
                  className="rounded-3xl border border-amber-100 bg-amber-50/40 p-4 flex flex-col justify-center"
                >
                  <span className="text-sm font-black text-amber-950">
                    Rate customers →
                  </span>
                </Link>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
                <div className="px-5 py-3 border-b text-xs font-semibold uppercase text-slate-500">
                  Recent invoice feedback
                </div>
                <div className="divide-y">
                  {recentFeedback.length === 0 ? (
                    <p className="px-5 py-8 text-sm text-slate-500 text-center">
                      No feedback yet
                    </p>
                  ) : (
                    recentFeedback.slice(0, 30).map((fb) => (
                      <div
                        key={fb.id}
                        className="px-5 py-3 flex flex-wrap items-center justify-between gap-2 text-sm"
                      >
                        <div>
                          <span className="font-semibold">
                            {fb.customer_name || 'Customer'}
                          </span>
                          <span className="text-xs text-slate-400 ml-2 font-mono">
                            {fb.invoice_number}
                          </span>
                          {fb.title ? (
                            <p className="text-xs text-slate-600 mt-0.5">
                              {fb.title}
                            </p>
                          ) : null}
                        </div>
                        <div className="text-right">
                          {fb.rating != null ? (
                            <span className="font-bold text-amber-800">
                              {fb.rating} ★
                            </span>
                          ) : null}
                          {fb.otifef_score != null ? (
                            <span className="block text-[10px] text-slate-400">
                              OTIFEF {fb.otifef_score}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {report === 'claims' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                <Card
                  icon={AlertTriangle}
                  label="Open claims"
                  value={String(k?.openClaims ?? 0)}
                  tone="amber"
                />
                <Card
                  icon={FileText}
                  label="Total claims"
                  value={String(k?.claimsTotal ?? 0)}
                />
                <Link
                  href="/dashboard/customers/claims"
                  className="rounded-3xl border border-slate-200 bg-white p-4 flex flex-col justify-center"
                >
                  <span className="text-sm font-black">Claims workspace →</span>
                </Link>
              </div>
              <div className="flex flex-wrap gap-2">
                {claimsByStatus.map((c) => (
                  <span
                    key={c.status}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold capitalize"
                  >
                    {c.status}: {c.count}
                  </span>
                ))}
                {claimsByStatus.length === 0 ? (
                  <p className="text-sm text-slate-500">No claims recorded</p>
                ) : null}
              </div>
            </div>
          )}

          {report === 'trend' && (
            <div className="space-y-4">
              <ChartCard title="Monthly billed vs order revenue" subtitle={period.label}>
                <PnlTrendChart
                  labels={trendLabels}
                  revenue={trend.map((t) => t.billed)}
                  expenses={trend.map((t) => t.orderRevenue)}
                  netIncome={trend.map((t) => t.billed)}
                />
              </ChartCard>
              <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-[10px] font-bold uppercase text-slate-400">
                      <th className="px-4 py-3">Month</th>
                      <th className="px-3 py-3 text-right">Orders</th>
                      <th className="px-3 py-3 text-right">Order $</th>
                      <th className="px-3 py-3 text-right">Invoices</th>
                      <th className="px-3 py-3 text-right">Billed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trend.map((t) => (
                      <tr key={t.month} className="border-b border-slate-50">
                        <td className="px-4 py-2.5 font-mono text-xs font-bold">
                          {t.month}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {t.orders}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-bold">
                          {formatMoney(t.orderRevenue)}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {t.invoices}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-bold">
                          {formatMoney(t.billed)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {report === 'risk' && (
            <div className="space-y-4">
              {risk?.concentration ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 flex gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  {risk.concentration.message}
                </div>
              ) : null}
              {(risk?.agingOver60 || 0) > 0 ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-950">
                  <strong>{formatMoney(risk!.agingOver60)}</strong> AR is over
                  60 days — prioritise collections.
                </div>
              ) : null}
              <div className="grid lg:grid-cols-2 gap-4">
                <RiskList
                  title="Highest AR open"
                  empty="No open AR"
                  items={(risk?.highAr || []).map((r) => ({
                    name: r.name,
                    primary: formatMoney(r.ar_open || 0),
                    secondary: `${r.invoice_count || 0} invoices`,
                  }))}
                />
                <RiskList
                  title="Low invoice feedback"
                  empty="No low feedback"
                  items={(risk?.lowFeedback || []).map((r) => ({
                    name: r.name,
                    primary: `${(r.feedback_star_avg ?? 0).toFixed(1)} ★`,
                    secondary: `${r.feedback_count} ratings`,
                  }))}
                />
                <RiskList
                  title="Low peer stars"
                  empty="No low peer ratings"
                  items={(risk?.lowPeerStars || []).map((r) => ({
                    name: r.name,
                    primary: `${(r.star_avg ?? 0).toFixed(1)} ★`,
                    secondary: `${r.star_count} ratings`,
                  }))}
                />
              </div>
            </div>
          )}
        </>
      )}
    </CustomersPage>
  );
}

function CustomerScorecard({ rows }: { rows: CustomerRow[] }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden mb-8">
      <div className="px-5 py-3 border-b text-xs font-semibold uppercase text-slate-500 flex justify-between">
        <span>Customer scorecard · {rows.length}</span>
        <span className="font-normal normal-case text-slate-400">
          Billed · AR · orders · feedback stars
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead>
            <tr className="border-b text-left text-[10px] font-bold uppercase text-slate-400">
              <th className="px-4 py-3">Customer</th>
              <th className="px-3 py-3 text-right">Billed</th>
              <th className="px-3 py-3 text-right">Orders $</th>
              <th className="px-3 py-3 text-right">AR open</th>
              <th className="px-3 py-3 text-right"># Ord</th>
              <th className="px-3 py-3">Feedback</th>
              <th className="px-3 py-3">Peer ★</th>
              <th className="px-3 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                  No customers match filters.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={r.customer_id}
                  className="border-b border-slate-50 hover:bg-sky-50/40"
                >
                  <td className="px-4 py-3">
                    <div className="font-semibold">{r.name}</div>
                    <div className="text-[10px] text-slate-400">
                      {[r.city, r.country].filter(Boolean).join(', ')}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right font-bold tabular-nums">
                    {formatMoney(r.billed || 0)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {formatMoney(r.order_revenue || 0)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-amber-800 font-semibold">
                    {formatMoney(r.ar_open || 0)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {r.order_count || 0}
                  </td>
                  <td className="px-3 py-3">
                    {r.feedback_star_avg != null ? (
                      <span className="font-bold text-amber-800">
                        {r.feedback_star_avg.toFixed(1)} ★
                        <span className="text-[10px] text-slate-400 font-normal">
                          {' '}
                          ({r.feedback_count})
                        </span>
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {r.star_avg != null ? (
                      <div>
                        <span className="font-bold">{r.star_avg.toFixed(1)}</span>
                        <StarRating value={r.star_avg} readOnly size="sm" />
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3 py-3 capitalize text-xs">
                    {r.status || r.invite_status || '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ParetoTable({
  rows,
}: {
  rows: Array<{
    rank: number;
    name: string;
    revenue: number;
    share_pct: number;
    cumulative_pct: number;
  }>;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-5 py-3 border-b text-xs font-semibold uppercase text-slate-500">
        Pareto — cumulative commercial volume
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="border-b text-left text-[10px] font-bold uppercase text-slate-400">
              <th className="px-4 py-3">#</th>
              <th className="px-3 py-3">Customer</th>
              <th className="px-3 py-3 text-right">Volume</th>
              <th className="px-3 py-3 text-right">Share</th>
              <th className="px-3 py-3 text-right">Cumulative</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                  No commercial volume in period
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.rank} className="border-b border-slate-50">
                  <td className="px-4 py-2.5 text-slate-400">{r.rank}</td>
                  <td className="px-3 py-2.5 font-semibold">{r.name}</td>
                  <td className="px-3 py-2.5 text-right font-bold tabular-nums">
                    {formatMoney(r.revenue)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {r.share_pct}%
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-semibold">
                    {r.cumulative_pct}%
                  </td>
                </tr>
              ))
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

function Mini({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-center">
      <div className="text-lg font-black tabular-nums">{value}</div>
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
              <span className="font-semibold truncate">
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
