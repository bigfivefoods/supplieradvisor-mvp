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
  openClaims: number;
  starAvgGiven: number | null;
  customersStarRated: number;
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
        `/api/customers/report?companyId=${companyId}&from=${fromS}&to=${toS}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load report');
      setKpis(data.kpis || null);
      setRows(data.customers || []);
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
        (b.order_revenue || b.billed || 0) - (a.order_revenue || a.billed || 0)
    )
    .slice(0, 5);

  const topStars = [...rows]
    .filter((r) => r.star_avg != null && (r.star_count || 0) > 0)
    .sort((a, b) => (b.star_avg || 0) - (a.star_avg || 0))
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
        description={`Rolling 12 months (${period.from || '…'} → ${period.to || '…'}). Pipeline, orders, AR, claims, and peer star ratings of buyers.`}
        action={
          <div className="flex flex-wrap gap-2">
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
              label="AR open"
              value={formatMoney(k?.arOpen ?? 0)}
              sub={`Billed ${formatMoney(k?.billed ?? 0)}`}
              tone="amber"
            />
            <Card
              icon={Star}
              label="Avg customer stars"
              value={k?.starAvgGiven != null ? k.starAvgGiven.toFixed(1) : '—'}
              sub={
                k?.starAvgGiven != null
                  ? `${starGuide(k.starAvgGiven).label} · ${k.customersStarRated} rated`
                  : 'No ratings yet'
              }
            />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-8">
            <Mini label="Customers" value={k?.customersTotal ?? 0} />
            <Mini label="Active" value={k?.customersActive ?? 0} />
            <Mini label="Invited" value={k?.invitePending ?? 0} />
            <Mini label="Open leads" value={k?.openLeads ?? 0} />
            <Mini label="Won value" value={formatMoney(k?.wonValue ?? 0)} money />
            <Mini label="Open claims" value={k?.openClaims ?? 0} />
          </div>

          <div className="grid lg:grid-cols-3 gap-4 mb-8">
            <TopList
              title="Top by revenue"
              empty="No order revenue in period"
              items={topRevenue.map((r) => ({
                name: r.name,
                primary: formatMoney(r.order_revenue || r.billed || 0),
                secondary: `${r.order_count || 0} orders`,
              }))}
            />
            <TopList
              title="Top by stars given"
              empty="No customer ratings yet"
              items={topStars.map((r) => ({
                name: r.name,
                primary: `${(r.star_avg ?? 0).toFixed(1)} ★`,
                secondary: starGuide(r.star_avg || 0).label,
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

          <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-5 py-3 border-b text-xs font-semibold uppercase text-slate-500">
              Customer scorecard
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-3 py-3 text-right">Orders</th>
                    <th className="px-3 py-3 text-right">Revenue</th>
                    <th className="px-3 py-3 text-right">AR open</th>
                    <th className="px-3 py-3">Stars</th>
                    <th className="px-3 py-3">Pay / Comms / Reliab.</th>
                    <th className="px-3 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
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
                          {formatMoney(r.ar_open ?? 0)}
                        </td>
                        <td className="px-3 py-3">
                          {r.star_avg != null ? (
                            <div>
                              <div className="font-bold text-amber-800">
                                {r.star_avg.toFixed(1)}
                              </div>
                              <StarRating
                                value={r.star_avg}
                                readOnly
                                size="sm"
                              />
                            </div>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-3 py-3 text-[11px] text-slate-600">
                          {r.star_payment?.toFixed(1) ?? '—'} /{' '}
                          {r.star_communication?.toFixed(1) ?? '—'} /{' '}
                          {r.star_reliability?.toFixed(1) ?? '—'}
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
      <div className="text-xl font-black text-slate-900 tabular-nums">{value}</div>
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
      <div className="text-base font-black tabular-nums">
        {money && typeof value === 'number' ? formatMoney(value) : value}
      </div>
      <div className="text-[10px] font-semibold uppercase text-slate-400">
        {label}
      </div>
    </div>
  );
}

function TopList({
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
        <Users className="w-4 h-4 text-[#00b4d8]" />
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">{empty}</p>
      ) : (
        <ol className="space-y-2">
          {items.map((it, i) => (
            <li
              key={it.name + i}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span className="min-w-0 truncate">
                <span className="text-slate-400 font-bold mr-2">{i + 1}.</span>
                <span className="font-semibold text-slate-800">{it.name}</span>
              </span>
              <span className="shrink-0 text-right">
                <div className="font-black">{it.primary}</div>
                <div className="text-[10px] text-slate-500">{it.secondary}</div>
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
