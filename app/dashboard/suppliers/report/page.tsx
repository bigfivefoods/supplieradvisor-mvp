'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Loader2,
  RefreshCw,
  Star,
  TrendingUp,
  Truck,
  ShieldCheck,
  Award,
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

type Kpis = {
  suppliersOnBook: number;
  connected: number;
  preferred: number;
  verified: number;
  openPos: number;
  poCount: number;
  totalSpend: number;
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
  spend?: number;
  po_count?: number;
  po_open?: number;
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
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [rows, setRows] = useState<SupplierRow[]>([]);
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
        `/api/suppliers/report?companyId=${companyId}&from=${fromS}&to=${toS}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load report');
      setKpis(data.kpis || null);
      setRows(data.suppliers || []);
      if (data.warnings?.length) {
        toast.message(String(data.warnings[0]));
      }
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
  const otBand = otifefBand(k?.otifefOverall || 0);

  const topByOtifef = [...rows]
    .filter((r) => r.otifef_pct != null && (r.otifef_po_count || 0) > 0)
    .sort((a, b) => (b.otifef_pct || 0) - (a.otifef_pct || 0))
    .slice(0, 5);

  const topBySpend = [...rows]
    .filter((r) => (r.spend || 0) > 0)
    .sort((a, b) => (b.spend || 0) - (a.spend || 0))
    .slice(0, 5);

  const topByStars = [...rows]
    .filter((r) => r.star_avg != null && (r.star_count || 0) > 0)
    .sort((a, b) => (b.star_avg || 0) - (a.star_avg || 0))
    .slice(0, 5);

  return (
    <SuppliersPage>
      <SuppliersHeader
        title="Supplier report"
        titleAccent="KPIs"
        description={`Rolling 12 months (${period.from || '…'} → ${period.to || '…'}). Objective OTIFEF from POs · subjective stars from peer ratings · trust composite on your book.`}
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/suppliers/ratings"
              className="btn-secondary !py-2.5 !px-4 text-sm inline-flex items-center gap-2"
            >
              <Star className="w-4 h-4" /> Rate suppliers
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
              sub={`${k?.poCount ?? 0} POs · ${k?.openPos ?? 0} open`}
              icon={Award}
            />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-8">
            <Mini label="On book" value={k?.suppliersOnBook ?? 0} />
            <Mini label="Connected" value={k?.connected ?? 0} />
            <Mini label="Preferred" value={k?.preferred ?? 0} />
            <Mini label="Verified" value={k?.verified ?? 0} />
            <Mini label="Open RIAD" value={k?.openRiads ?? 0} />
          </div>

          <div className="grid lg:grid-cols-3 gap-4 mb-8">
            <TopList
              title="Top by OTIFEF"
              empty="No delivery scorecards yet"
              items={topByOtifef.map((r) => ({
                name: r.name,
                primary: `${(r.otifef_pct ?? 0).toFixed(1)}%`,
                secondary: `${r.otifef_po_count ?? 0} POs`,
              }))}
            />
            <TopList
              title="Top by spend"
              empty="No PO spend in period"
              items={topBySpend.map((r) => ({
                name: r.name,
                primary: formatMoney(r.spend ?? 0),
                secondary: `${r.po_count ?? 0} POs`,
              }))}
            />
            <TopList
              title="Top by stars"
              empty="No star ratings yet"
              items={topByStars.map((r) => ({
                name: r.name,
                primary: `${(r.star_avg ?? 0).toFixed(1)} ★`,
                secondary: starGuide(r.star_avg || 0).label,
              }))}
            />
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-5 py-3 border-b text-xs font-semibold uppercase text-slate-500 flex justify-between">
              <span>Supplier scorecard table</span>
              <span className="font-normal normal-case text-slate-400">
                OTIFEF = objective · Stars = peer feedback · Trust = composite
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[720px]">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="px-4 py-3">Supplier</th>
                    <th className="px-3 py-3">OTIFEF</th>
                    <th className="px-3 py-3">Stars</th>
                    <th className="px-3 py-3">Trust</th>
                    <th className="px-3 py-3 text-right">Spend</th>
                    <th className="px-3 py-3 text-right">POs</th>
                    <th className="px-3 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                        No supplier data for this period.
                      </td>
                    </tr>
                  ) : (
                    rows.map((r) => {
                      const tb = trustBand(Number(r.trust_score || 0));
                      return (
                        <tr
                          key={r.supplier_profile_id}
                          className="border-b border-slate-50 hover:bg-sky-50/40"
                        >
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-900">
                              {r.name}
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
        </>
      )}
    </SuppliersPage>
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

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-center">
      <div className="text-lg font-black">{value}</div>
      <div className="text-[10px] font-semibold uppercase text-slate-400">{label}</div>
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
      <h3 className="text-sm font-black text-slate-900 mb-3">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">{empty}</p>
      ) : (
        <ol className="space-y-2">
          {items.map((it, i) => (
            <li
              key={it.name + i}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span className="min-w-0">
                <span className="text-slate-400 font-bold mr-2">{i + 1}.</span>
                <span className="font-semibold text-slate-800 truncate">
                  {it.name}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <div className="font-black text-slate-900">{it.primary}</div>
                <div className="text-[10px] text-slate-500">{it.secondary}</div>
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
