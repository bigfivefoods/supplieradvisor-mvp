'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Loader2,
  RefreshCw,
  Star,
  TrendingUp,
  ShoppingCart,
  Wallet,
  MessageSquare,
  FileText,
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
import { starGuide } from '@/lib/ratings/company-rating';

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
  starAvgGiven: number | null;
  customersStarRated: number;
  feedbackAvgStars?: number | null;
  feedbackCount?: number;
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
  feedback_latest_rating?: number | null;
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
  latest_rating: number | null;
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

type FeedbackRow = {
  id: number;
  invoice_number: string | null;
  customer_name: string | null;
  order_number: string | null;
  rating: number | null;
  otifef_score: number | null;
  title: string | null;
  body: string | null;
  contact_name: string | null;
  created_at: string | null;
};

export default function CustomerReportPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [recentFeedback, setRecentFeedback] = useState<FeedbackRow[]>([]);
  const [period, setPeriod] = useState({ from: '', to: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const to = new Date();
      const from = new Date();
      from.setFullYear(from.getFullYear() - 1);
      const fromS = from.toISOString().slice(0, 10);
      const toS = to.toISOString().slice(0, 10);
      setPeriod({ from: fromS, to: toS });

      const res = await fetch(
        `/api/customers/report?companyId=${companyId}&from=${fromS}&to=${toS}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load report');
      setKpis(data.kpis || null);
      setRows(data.customers || []);
      setOrders(data.orders || []);
      setInvoices(data.invoices || []);
      setRecentFeedback(data.recentFeedback || []);
      if (data.warnings?.length) toast.message(String(data.warnings[0]));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const k = kpis;

  const topRevenue = [...rows]
    .filter((r) => (r.order_revenue || 0) > 0 || (r.billed || 0) > 0)
    .sort(
      (a, b) =>
        (b.billed || b.order_revenue || 0) -
        (a.billed || a.order_revenue || 0)
    )
    .slice(0, 5);

  const topStars = [...rows]
    .filter((r) => r.star_avg != null && (r.star_count || 0) > 0)
    .sort((a, b) => (b.star_avg || 0) - (a.star_avg || 0))
    .slice(0, 5);

  const topFeedback = [...rows]
    .filter((r) => r.feedback_star_avg != null && (r.feedback_count || 0) > 0)
    .sort((a, b) => (b.feedback_star_avg || 0) - (a.feedback_star_avg || 0))
    .slice(0, 5);

  const topAr = [...rows]
    .filter((r) => (r.ar_open || 0) > 0)
    .sort((a, b) => (b.ar_open || 0) - (a.ar_open || 0))
    .slice(0, 5);

  return (
    <CustomersPage>
      <CustomersHeader
        title="Customer report"
        titleAccent="KPIs"
        description={`Rolling 12 months (${period.from || '…'} → ${period.to || '…'}). Orders, CRM invoices, AR, peer ratings, and customer invoice feedback (stars / OTIFEF).`}
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/customers/invoices"
              className="btn-secondary !py-2.5 !px-4 text-sm inline-flex items-center gap-2"
            >
              <FileText className="w-4 h-4" /> Invoices
            </Link>
            <Link
              href="/dashboard/customers/ratings"
              className="btn-secondary !py-2.5 !px-4 text-sm inline-flex items-center gap-2"
            >
              <Star className="w-4 h-4" /> Rate customers
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

      {loading ? (
        <div className="py-20 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
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
              sub={`${k?.ordersCount ?? 0} orders`}
              tone="emerald"
            />
            <Card
              icon={Wallet}
              label="Billed (invoices)"
              value={formatMoney(k?.billed ?? 0)}
              sub={`AR open ${formatMoney(k?.arOpen ?? 0)} · ${k?.invoicesCount ?? 0} invoices`}
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
                  ? `${k.feedbackCount} ratings from invoice QR`
                  : 'No invoice feedback yet'
              }
            />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-8">
            <Mini label="Customers" value={k?.customersTotal ?? 0} />
            <Mini label="Active" value={k?.customersActive ?? 0} />
            <Mini label="Open leads" value={k?.openLeads ?? 0} />
            <Mini
              label="Won value"
              value={formatMoney(k?.wonValue ?? 0)}
              money
            />
            <Mini
              label="Peer stars (you→them)"
              value={
                k?.starAvgGiven != null ? k.starAvgGiven.toFixed(1) : '—'
              }
            />
            <Mini label="Open claims" value={k?.openClaims ?? 0} />
          </div>

          {(k?.unassignedBilled || 0) > 0 && (
            <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <strong>{formatMoney(k!.unassignedBilled!)}</strong> of billed
              revenue is not linked to a customer record (invoice missing{' '}
              <code className="text-xs">customer_id</code>). Assign a customer
              on the invoice to show it under scorecard rows.
            </div>
          )}

          <div className="grid lg:grid-cols-3 gap-4 mb-8">
            <TopList
              title="Top by billed / revenue"
              empty="No invoices or orders in period"
              items={topRevenue.map((r) => ({
                name: r.name,
                primary: formatMoney(r.billed || r.order_revenue || 0),
                secondary: `${r.invoice_count || 0} inv · ${r.order_count || 0} orders`,
              }))}
            />
            <TopList
              title="Customer feedback (invoice stars)"
              empty="No QR / invoice feedback yet"
              items={topFeedback.map((r) => ({
                name: r.name,
                primary: `${(r.feedback_star_avg ?? 0).toFixed(1)} ★`,
                secondary: `${r.feedback_count} ratings${
                  r.feedback_otifef_avg != null
                    ? ` · OTIFEF ${r.feedback_otifef_avg}`
                    : ''
                }`,
              }))}
            />
            <TopList
              title="Highest AR open"
              empty="No open AR"
              items={topAr.map((r) => ({
                name: r.name,
                primary: formatMoney(r.ar_open || 0),
                secondary: `${r.invoice_count || 0} invoices`,
              }))}
            />
          </div>

          {/* Invoices in period — catch missing R20k etc. */}
          <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden mb-8">
            <div className="px-5 py-3 border-b text-xs font-semibold uppercase text-slate-500 flex items-center justify-between">
              <span>Invoices in period (CRM + AR)</span>
              <span className="font-normal normal-case text-slate-400">
                {invoices.length} shown · billed {formatMoney(k?.billed ?? 0)}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[720px]">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
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
                  {invoices.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-10 text-center text-slate-500"
                      >
                        No invoices in this period.
                      </td>
                    </tr>
                  ) : (
                    invoices.map((inv) => (
                      <tr
                        key={`${inv.source}-${inv.id}`}
                        className="border-b border-slate-50 hover:bg-sky-50/40"
                      >
                        <td className="px-4 py-3 font-mono text-xs font-semibold">
                          {inv.number || `#${inv.id}`}
                          <span className="block text-[10px] text-slate-400 font-normal">
                            {inv.source}
                          </span>
                        </td>
                        <td className="px-3 py-3 font-semibold text-slate-800">
                          {inv.customer_name || (
                            <span className="text-amber-700 font-medium">
                              Unassigned
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-600">
                          {inv.date || '—'}
                        </td>
                        <td className="px-3 py-3 text-right font-bold tabular-nums">
                          {formatMoney(inv.total)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {formatMoney(inv.open)}
                        </td>
                        <td className="px-3 py-3 text-xs capitalize">
                          {inv.status}
                        </td>
                        <td className="px-3 py-3">
                          {inv.feedback_star_avg != null ? (
                            <span className="font-bold text-amber-800">
                              {inv.feedback_star_avg.toFixed(1)} ★
                              <span className="text-[10px] text-slate-500 font-normal">
                                {' '}
                                ({inv.feedback_count})
                              </span>
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Per-order feedback */}
          <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden mb-8">
            <div className="px-5 py-3 border-b text-xs font-semibold uppercase text-slate-500">
              Orders · customer feedback (stars / OTIFEF from invoice QR)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[760px]">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="px-4 py-3">Order</th>
                    <th className="px-3 py-3">Customer</th>
                    <th className="px-3 py-3 text-right">Amount</th>
                    <th className="px-3 py-3">Invoice</th>
                    <th className="px-3 py-3">Stars</th>
                    <th className="px-3 py-3">OTIFEF</th>
                    <th className="px-3 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-10 text-center text-slate-500"
                      >
                        No orders in this period.
                      </td>
                    </tr>
                  ) : (
                    orders.map((o) => (
                      <tr
                        key={o.order_id}
                        className="border-b border-slate-50 hover:bg-sky-50/40"
                      >
                        <td className="px-4 py-3 font-mono text-xs font-semibold">
                          {o.order_number}
                        </td>
                        <td className="px-3 py-3 font-semibold">
                          {o.customer_name}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {formatMoney(o.total_amount)}
                        </td>
                        <td className="px-3 py-3 text-xs font-mono text-slate-600">
                          {o.invoice_number || '—'}
                        </td>
                        <td className="px-3 py-3">
                          {o.star_avg != null ? (
                            <div>
                              <span className="font-bold text-amber-800">
                                {o.star_avg.toFixed(1)}
                              </span>
                              <StarRating
                                value={o.star_avg}
                                readOnly
                                size="sm"
                              />
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs">
                              No feedback
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 tabular-nums text-sm">
                          {o.otifef_avg != null ? `${o.otifef_avg}` : '—'}
                        </td>
                        <td className="px-3 py-3 text-xs capitalize text-slate-600">
                          {o.status || '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent feedback feed */}
          {recentFeedback.length > 0 && (
            <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden mb-8">
              <div className="px-5 py-3 border-b text-xs font-semibold uppercase text-slate-500">
                Recent customer feedback
              </div>
              <ul className="divide-y max-h-80 overflow-y-auto">
                {recentFeedback.map((f) => (
                  <li
                    key={f.id}
                    className="px-5 py-3 flex flex-wrap gap-3 justify-between"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 text-sm">
                        {f.customer_name || 'Customer'}
                        {f.invoice_number && (
                          <span className="ml-2 font-mono text-[11px] text-slate-500">
                            {f.invoice_number}
                          </span>
                        )}
                        {f.order_number && (
                          <span className="ml-1 font-mono text-[11px] text-slate-400">
                            · {f.order_number}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-600 mt-0.5">
                        {f.title || f.body || 'Rating submitted'}
                        {f.contact_name ? ` — ${f.contact_name}` : ''}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {f.rating != null && (
                        <div className="font-black text-amber-800">
                          {Number(f.rating).toFixed(1)} ★
                        </div>
                      )}
                      {f.otifef_score != null && (
                        <div className="text-[11px] text-slate-500">
                          OTIFEF {f.otifef_score}
                        </div>
                      )}
                      <div className="text-[10px] text-slate-400">
                        {f.created_at
                          ? new Date(f.created_at).toLocaleDateString('en-ZA')
                          : ''}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-5 py-3 border-b text-xs font-semibold uppercase text-slate-500">
              Customer scorecard
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[900px]">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-3 py-3 text-right">Orders</th>
                    <th className="px-3 py-3 text-right">Order R</th>
                    <th className="px-3 py-3 text-right">Invoices</th>
                    <th className="px-3 py-3 text-right">Billed</th>
                    <th className="px-3 py-3 text-right">AR open</th>
                    <th className="px-3 py-3">Their feedback ★</th>
                    <th className="px-3 py-3">Peer ★ (you)</th>
                    <th className="px-3 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-4 py-12 text-center text-slate-500"
                      >
                        No customers on the book yet.
                      </td>
                    </tr>
                  ) : (
                    rows.map((r) => (
                      <tr
                        key={r.customer_id}
                        className="border-b border-slate-50 hover:bg-sky-50/40"
                      >
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {r.name}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {r.order_count ?? 0}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums font-medium">
                          {formatMoney(r.order_revenue ?? 0)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {r.invoice_count ?? 0}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums font-bold text-slate-900">
                          {formatMoney(r.billed ?? 0)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {formatMoney(r.ar_open ?? 0)}
                        </td>
                        <td className="px-3 py-3">
                          {r.feedback_star_avg != null ? (
                            <div>
                              <div className="font-bold text-amber-800">
                                {r.feedback_star_avg.toFixed(1)}
                                <span className="text-[10px] font-normal text-slate-500">
                                  {' '}
                                  ({r.feedback_count})
                                </span>
                              </div>
                              <StarRating
                                value={r.feedback_star_avg}
                                readOnly
                                size="sm"
                              />
                              {r.feedback_otifef_avg != null && (
                                <div className="text-[10px] text-slate-500">
                                  OTIFEF {r.feedback_otifef_avg}
                                </div>
                              )}
                            </div>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-3 py-3">
                          {r.star_avg != null ? (
                            <div>
                              <div className="font-bold text-slate-800">
                                {r.star_avg.toFixed(1)}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                {starGuide(r.star_avg).label}
                              </div>
                            </div>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-3 py-3 text-xs capitalize text-slate-600">
                          {r.invite_status || r.status || '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {topStars.length === 0 && (
              <p className="px-5 py-3 text-[11px] text-slate-500 border-t">
                Peer stars = ratings you give buyers (Customers → Rate
                customers). Their feedback ★ = stars from invoice QR Rate links.
              </p>
            )}
          </div>
        </>
      )}
    </CustomersPage>
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
      <div className="text-xl font-black text-slate-900 tabular-nums">
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
    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </div>
      <div className="text-lg font-black text-slate-900 tabular-nums">
        {money && typeof value === 'number' ? formatMoney(value) : value}
      </div>
    </div>
  );
}

function TopList({
  title,
  items,
  empty,
}: {
  title: string;
  empty: string;
  items: Array<{ name: string; primary: string; secondary?: string }>;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b text-xs font-semibold uppercase text-slate-500">
        {title}
      </div>
      {items.length === 0 ? (
        <p className="p-4 text-sm text-slate-500">{empty}</p>
      ) : (
        <ul className="divide-y">
          {items.map((it) => (
            <li
              key={it.name + it.primary}
              className="px-4 py-2.5 flex justify-between gap-2"
            >
              <span className="font-semibold text-sm text-slate-800 truncate">
                {it.name}
              </span>
              <span className="text-right shrink-0">
                <span className="font-bold text-sm tabular-nums">
                  {it.primary}
                </span>
                {it.secondary && (
                  <span className="block text-[10px] text-slate-500">
                    {it.secondary}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
