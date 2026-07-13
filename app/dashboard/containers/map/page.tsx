'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  MapPin,
  Package,
  Heart,
  Briefcase,
  BarChart3,
  Boxes,
  RefreshCw,
} from 'lucide-react';
import { getSelectedCompanyId } from '@/lib/containers/company';
import type { MapPin as Pin } from '@/components/LocationMap';
import type { ContainerImpactRow, ImpactTotals } from '@/lib/containers/impact';
import { formatQty } from '@/lib/containers/stock';
import {
  CompanyRequired,
  ContainersHeader,
  ContainersPage,
} from '@/components/containers/ContainersShell';

const LocationMap = dynamic(() => import('@/components/LocationMap'), {
  ssr: false,
});

type MapMode = 'location' | 'people' | 'jobs' | 'stock';

const POLL_MS = 30_000;

export default function ContainersMapPage() {
  return (
    <CompanyRequired>
      <MapInner />
    </CompanyRequired>
  );
}

function MapInner() {
  const companyId = getSelectedCompanyId()!;
  const [rows, setRows] = useState<ContainerImpactRow[]>([]);
  const [totals, setTotals] = useState<ImpactTotals | null>(null);
  const [loading, setLoading] = useState(true);
  const [liveAt, setLiveAt] = useState<string | null>(null);
  const [layer, setLayer] = useState<'street' | 'satellite'>('street');
  const [mode, setMode] = useState<MapMode>('stock');

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      try {
        const res = await fetch(
          `/api/containers/impact?companyId=${companyId}`,
          { cache: 'no-store' }
        );
        const data = await res.json();
        setRows(data.rows || []);
        setTotals(data.totals || null);
        setLiveAt(data.stockLiveAt || new Date().toISOString());
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [companyId]
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Live stock: poll while map is open
  useEffect(() => {
    const t = window.setInterval(() => {
      void load({ silent: true });
    }, POLL_MS);
    return () => window.clearInterval(t);
  }, [load]);

  const maxPeople = useMemo(
    () => Math.max(1, ...rows.map((r) => r.people_fed)),
    [rows]
  );
  const maxStock = useMemo(
    () => Math.max(1, ...rows.map((r) => r.stock_qty || 0)),
    [rows]
  );

  const pins: Pin[] = useMemo(() => {
    return rows
      .filter((c) => c.mapped && c.latitude != null && c.longitude != null)
      .map((c) => {
        let tone: Pin['tone'] = 'default';
        let detail = '';
        const qty = c.stock_qty || 0;
        const skus = c.stock_skus || 0;
        const low = c.stock_low || 0;
        const top = (c.stock_top || [])
          .slice(0, 3)
          .map(
            (l) =>
              `· ${l.product_name}: ${formatQty(l.qty)} ${l.unit}${l.low ? ' ⚠' : ''}`
          )
          .join('\n');

        if (mode === 'people') {
          const ratio = c.people_fed / maxPeople;
          tone =
            ratio >= 0.66
              ? 'impact-high'
              : ratio >= 0.33
                ? 'impact-mid'
                : 'impact-low';
          detail = `👥 ~${c.people_fed.toLocaleString('en-ZA')} people fed\n📦 ${formatQty(qty)} units on hand · 💼 ${c.jobs_total} jobs`;
        } else if (mode === 'jobs') {
          tone = 'jobs';
          detail = `💼 ${c.jobs_total} jobs (${c.jobs_direct} direct + ${c.jobs_support} support)\n📦 ${formatQty(qty)} units · 👥 ~${c.people_fed.toLocaleString('en-ZA')} fed`;
        } else if (mode === 'stock') {
          if (qty <= 0) {
            tone = 'stock-empty';
          } else if (low > 0) {
            tone = 'stock-low';
          } else {
            const ratio = qty / maxStock;
            tone = ratio >= 0.5 ? 'stock-high' : 'stock-mid';
          }
          detail = `📦 Live stock: ${formatQty(qty)} units (${skus} SKUs)${low ? `\n⚠ ${low} line(s) low` : ''}${top ? `\n${top}` : '\nNo inventory lines yet'}`;
        } else {
          detail = [
            c.staffed
              ? `Operator: ${c.contractor_name || 'Assigned'}`
              : 'No operator assigned',
            `Stock: ${formatQty(qty)} units`,
          ].join('\n');
        }
        return {
          id: c.container_id,
          position: [Number(c.latitude), Number(c.longitude)] as [
            number,
            number,
          ],
          label: c.name,
          subtitle: `${c.code} · ${c.city || '—'} · ${c.status || 'active'}`,
          detail,
          tone: mode === 'location' ? 'default' : tone,
        };
      });
  }, [rows, mode, maxPeople, maxStock]);

  const unmapped = rows.filter((c) => !c.mapped);
  const sortedSidebar = useMemo(() => {
    const list = [...rows];
    if (mode === 'jobs') {
      list.sort((a, b) => b.jobs_total - a.jobs_total);
    } else if (mode === 'people') {
      list.sort((a, b) => b.people_fed - a.people_fed);
    } else if (mode === 'stock') {
      list.sort((a, b) => (b.stock_qty || 0) - (a.stock_qty || 0));
    } else {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return list;
  }, [rows, mode]);

  return (
    <ContainersPage>
      <ContainersHeader
        title="Container"
        titleAccent="map"
        description={
          loading
            ? 'Loading live map…'
            : `${pins.length} mapped · ${formatQty(totals?.stock_qty ?? 0)} units on hand · ${totals?.people_fed?.toLocaleString('en-ZA') ?? 0} people fed · ${totals?.jobs_total ?? 0} jobs`
        }
        action={
          <>
            <button
              type="button"
              onClick={() => setLayer('street')}
              className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all cursor-pointer ${
                layer === 'street'
                  ? 'bg-[#00b4d8] text-white border-[#00b4d8]'
                  : 'bg-white border-neutral-200 text-neutral-600'
              }`}
            >
              Street
            </button>
            <button
              type="button"
              onClick={() => setLayer('satellite')}
              className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all cursor-pointer ${
                layer === 'satellite'
                  ? 'bg-[#00b4d8] text-white border-[#00b4d8]'
                  : 'bg-white border-neutral-200 text-neutral-600'
              }`}
            >
              Satellite
            </button>
            <button
              type="button"
              onClick={() => void load()}
              className="btn-secondary !py-2.5 !px-4 text-sm inline-flex items-center gap-1"
              title="Refresh live stock now"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <Link
              href="/dashboard/containers/impact"
              className="btn-secondary !py-2.5 !px-5 text-sm inline-flex items-center gap-1"
            >
              <BarChart3 className="w-4 h-4" /> Impact report
            </Link>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            {
              id: 'stock' as const,
              label: 'Stock on hand',
              icon: Boxes,
              hint: 'Live inventory',
            },
            {
              id: 'people' as const,
              label: 'People fed',
              icon: Heart,
              hint: 'Food security',
            },
            {
              id: 'jobs' as const,
              label: 'Jobs created',
              icon: Briefcase,
              hint: 'Direct + support',
            },
            {
              id: 'location' as const,
              label: 'Locations',
              icon: MapPin,
              hint: 'Outlet pins',
            },
          ] as const
        ).map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMode(m.id)}
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition-all ${
              mode === m.id
                ? 'border-[#00b4d8] bg-[#00b4d8] text-white shadow-sm'
                : 'border-slate-200 bg-white text-slate-700 hover:border-sky-300'
            }`}
          >
            <m.icon className="w-4 h-4" />
            {m.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
        <ImpactKpi
          label="Units on hand"
          value={formatQty(totals?.stock_qty ?? 0)}
          sub={`${totals?.containers_with_stock ?? 0} outlets with stock · live`}
          tone="teal"
        />
        <ImpactKpi
          label="SKU lines"
          value={String(totals?.stock_skus ?? 0)}
          sub={
            (totals?.stock_low ?? 0) > 0
              ? `${totals?.stock_low} low stock`
              : 'All above reorder'
          }
          tone={(totals?.stock_low ?? 0) > 0 ? 'amber' : 'neutral'}
        />
        <ImpactKpi
          label="People fed"
          value={totals?.people_fed?.toLocaleString('en-ZA') ?? '—'}
          sub="From food sales (period)"
          tone="emerald"
        />
        <ImpactKpi
          label="Jobs created"
          value={String(totals?.jobs_total ?? '—')}
          sub={`${totals?.jobs_direct ?? 0} direct · ${totals?.jobs_support ?? 0} support`}
          tone="violet"
        />
        <ImpactKpi
          label="Mapped outlets"
          value={String(totals?.mapped ?? 0)}
          sub={
            liveAt
              ? `Updated ${new Date(liveAt).toLocaleTimeString('en-ZA')}`
              : `${totals?.staffed ?? 0} staffed`
          }
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 sm:gap-5">
        <div className="lg:col-span-2 h-[480px] sm:h-[560px] rounded-3xl overflow-hidden border border-neutral-200 bg-white relative">
          {!loading && (
            <LocationMap
              pins={pins}
              layer={layer}
              height="100%"
              interactive
              scrollWheelZoom
              zoom={6}
            />
          )}
          {mode !== 'location' && (
            <div className="absolute bottom-3 left-3 right-3 sm:right-auto sm:max-w-xs rounded-2xl bg-white/95 border border-slate-200 shadow-md px-3 py-2 text-[11px] text-slate-600 z-[500]">
              {mode === 'stock' ? (
                <span>
                  <strong className="text-teal-700">Teal</strong> high stock ·{' '}
                  <strong className="text-sky-600">Cyan</strong> mid ·{' '}
                  <strong className="text-red-600">Red</strong> low reorder ·{' '}
                  <strong className="text-slate-400">Grey</strong> empty. Auto-refreshes
                  every 30s.
                </span>
              ) : mode === 'people' ? (
                <span>
                  <strong className="text-emerald-700">Green</strong> = higher
                  people fed · click pins for stock + detail.
                </span>
              ) : (
                <span>
                  <strong className="text-violet-700">Purple</strong> pins =
                  jobs per outlet.
                </span>
              )}
            </div>
          )}
        </div>

        <div className="bg-white border border-neutral-200 rounded-3xl p-5 max-h-[560px] overflow-y-auto">
          <h3 className="text-sm font-bold text-slate-800 mb-1">
            {mode === 'stock'
              ? 'Live stock by outlet'
              : mode === 'people'
                ? 'Impact by outlet (people fed)'
                : mode === 'jobs'
                  ? 'Impact by outlet (jobs)'
                  : 'Outlets'}
          </h3>
          <p className="text-[11px] text-slate-500 mb-4">
            Stock from Supabase <code className="text-[10px]">container_inventory</code>
            {liveAt
              ? ` · ${new Date(liveAt).toLocaleTimeString('en-ZA')}`
              : ''}
            {' · '}auto-refresh 30s
          </p>
          {loading ? (
            <p className="text-sm text-neutral-500">Loading…</p>
          ) : sortedSidebar.length === 0 ? (
            <p className="text-sm text-neutral-500">No containers yet.</p>
          ) : (
            <ul className="space-y-2">
              {sortedSidebar.map((c) => (
                <li key={c.container_id}>
                  <Link
                    href={`/dashboard/containers/${c.container_id}/inventory`}
                    className="block p-3 rounded-2xl border border-neutral-100 hover:border-[#00b4d8]/40 hover:bg-[#00b4d8]/5 transition-all"
                  >
                    <div className="font-semibold text-slate-800 flex items-center gap-2">
                      <Package className="w-4 h-4 text-[#00b4d8] shrink-0" />
                      <span className="truncate">{c.name}</span>
                    </div>
                    <div className="text-xs text-neutral-500 mt-1 font-mono">
                      {c.code}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                      <span
                        className={`rounded-full border px-2 py-0.5 font-bold ${
                          (c.stock_qty || 0) <= 0
                            ? 'bg-slate-50 border-slate-200 text-slate-600'
                            : (c.stock_low || 0) > 0
                              ? 'bg-red-50 border-red-100 text-red-800'
                              : 'bg-teal-50 border-teal-100 text-teal-800'
                        }`}
                      >
                        📦 {formatQty(c.stock_qty || 0)} units
                        {(c.stock_skus || 0) > 0
                          ? ` · ${c.stock_skus} SKU`
                          : ''}
                      </span>
                      {(c.stock_low || 0) > 0 && (
                        <span className="rounded-full bg-amber-50 border border-amber-100 text-amber-900 px-2 py-0.5 font-bold">
                          ⚠ {c.stock_low} low
                        </span>
                      )}
                      <span className="rounded-full bg-emerald-50 border border-emerald-100 text-emerald-800 px-2 py-0.5 font-bold">
                        👥 {c.people_fed.toLocaleString('en-ZA')} fed
                      </span>
                      <span className="rounded-full bg-violet-50 border border-violet-100 text-violet-800 px-2 py-0.5 font-bold">
                        💼 {c.jobs_total} jobs
                      </span>
                    </div>
                    {mode === 'stock' && (c.stock_top?.length || 0) > 0 && (
                      <ul className="mt-2 text-[10px] text-slate-600 space-y-0.5">
                        {c.stock_top!.slice(0, 3).map((l) => (
                          <li key={`${l.product_name}-${l.sku}`}>
                            {l.product_name}:{' '}
                            <strong>
                              {formatQty(l.qty)} {l.unit}
                            </strong>
                            {l.low ? ' ⚠' : ''}
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="text-xs text-neutral-600 mt-1.5 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-[#00b4d8]" />
                      {c.mapped
                        ? [c.city, c.province].filter(Boolean).join(', ') ||
                          'Mapped'
                        : 'No GPS — edit to pin'}
                      <span className="ml-auto text-[10px] text-[#00b4d8] font-semibold">
                        Edit stock →
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {unmapped.length > 0 && (
            <p className="mt-4 text-[11px] text-amber-700">
              {unmapped.length} outlet{unmapped.length === 1 ? '' : 's'} without
              GPS — add coordinates to show on the map.
            </p>
          )}
        </div>
      </div>
    </ContainersPage>
  );
}

function ImpactKpi({
  label,
  value,
  sub,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'neutral' | 'emerald' | 'violet' | 'teal' | 'amber';
}) {
  const bg =
    tone === 'emerald'
      ? 'border-emerald-100 bg-emerald-50/50'
      : tone === 'violet'
        ? 'border-violet-100 bg-violet-50/50'
        : tone === 'teal'
          ? 'border-teal-100 bg-teal-50/50'
          : tone === 'amber'
            ? 'border-amber-100 bg-amber-50/50'
            : 'border-slate-200 bg-white';
  return (
    <div className={`rounded-2xl border px-4 py-3 ${bg}`}>
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </div>
      <div className="text-xl font-black text-slate-900 tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}
