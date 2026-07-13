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
} from 'lucide-react';
import { getSelectedCompanyId } from '@/lib/containers/company';
import type { MapPin as Pin } from '@/components/LocationMap';
import type { ContainerImpactRow, ImpactTotals } from '@/lib/containers/impact';
import {
  CompanyRequired,
  ContainersHeader,
  ContainersPage,
} from '@/components/containers/ContainersShell';

const LocationMap = dynamic(() => import('@/components/LocationMap'), {
  ssr: false,
});

type MapMode = 'location' | 'people' | 'jobs';

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
  const [layer, setLayer] = useState<'street' | 'satellite'>('street');
  const [mode, setMode] = useState<MapMode>('people');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/containers/impact?companyId=${companyId}`);
      const data = await res.json();
      setRows(data.rows || []);
      setTotals(data.totals || null);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const maxPeople = useMemo(
    () => Math.max(1, ...rows.map((r) => r.people_fed)),
    [rows]
  );
  const maxJobs = useMemo(
    () => Math.max(1, ...rows.map((r) => r.jobs_total)),
    [rows]
  );

  const pins: Pin[] = useMemo(() => {
    return rows
      .filter((c) => c.mapped && c.latitude != null && c.longitude != null)
      .map((c) => {
        let tone: Pin['tone'] = 'default';
        let detail = '';
        if (mode === 'people') {
          const ratio = c.people_fed / maxPeople;
          tone =
            ratio >= 0.66
              ? 'impact-high'
              : ratio >= 0.33
                ? 'impact-mid'
                : 'impact-low';
          detail = `👥 ~${c.people_fed.toLocaleString('en-ZA')} people fed (period)\n💼 ${c.jobs_total} jobs · Sales R${c.sales_revenue.toLocaleString('en-ZA')}`;
        } else if (mode === 'jobs') {
          tone = 'jobs';
          detail = `💼 ${c.jobs_total} jobs (${c.jobs_direct} direct + ${c.jobs_support} support)\n👥 ~${c.people_fed.toLocaleString('en-ZA')} people fed`;
        } else {
          detail = c.staffed
            ? `Operator: ${c.contractor_name || 'Assigned'}`
            : 'No operator assigned';
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
  }, [rows, mode, maxPeople, maxJobs]);

  const unmapped = rows.filter((c) => !c.mapped);
  const sortedSidebar = useMemo(() => {
    const list = [...rows];
    if (mode === 'jobs') {
      list.sort((a, b) => b.jobs_total - a.jobs_total);
    } else if (mode === 'people') {
      list.sort((a, b) => b.people_fed - a.people_fed);
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
            ? 'Loading impact map…'
            : `${pins.length} mapped · ${totals?.people_fed?.toLocaleString('en-ZA') ?? 0} people fed · ${totals?.jobs_total ?? 0} jobs (period)`
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
            <Link
              href="/dashboard/containers/impact"
              className="btn-secondary !py-2.5 !px-5 text-sm inline-flex items-center gap-1"
            >
              <BarChart3 className="w-4 h-4" /> Impact report
            </Link>
            <Link
              href="/dashboard/containers/settings"
              className="btn-secondary !py-2.5 !px-5 text-sm"
            >
              Share
            </Link>
          </>
        }
      />

      {/* Impact mode toggle */}
      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            {
              id: 'people' as const,
              label: 'People fed',
              icon: Heart,
              hint: 'Food security impact',
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
              hint: 'Outlet pins only',
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

      {/* Network impact strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <ImpactKpi
          label="People fed (period)"
          value={totals?.people_fed?.toLocaleString('en-ZA') ?? '—'}
          sub="From food sales ÷ meal price"
          tone="emerald"
        />
        <ImpactKpi
          label="Jobs created"
          value={String(totals?.jobs_total ?? '—')}
          sub={`${totals?.jobs_direct ?? 0} direct · ${totals?.jobs_support ?? 0} support`}
          tone="violet"
        />
        <ImpactKpi
          label="Sales revenue"
          value={
            totals
              ? `R${totals.sales_revenue.toLocaleString('en-ZA')}`
              : '—'
          }
          sub={`${totals?.sales_count ?? 0} sales logged`}
        />
        <ImpactKpi
          label="Mapped outlets"
          value={String(totals?.mapped ?? 0)}
          sub={`${totals?.staffed ?? 0} staffed`}
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
              {mode === 'people' ? (
                <span>
                  <strong className="text-emerald-700">Green</strong> = higher
                  people fed ·{' '}
                  <strong className="text-sky-600">Blue</strong> mid ·{' '}
                  <strong className="text-amber-600">Amber</strong> lower. Click
                  pins for detail.
                </span>
              ) : (
                <span>
                  <strong className="text-violet-700">Purple</strong> pins =
                  jobs per outlet. Click for direct vs support split.
                </span>
              )}
            </div>
          )}
        </div>

        <div className="bg-white border border-neutral-200 rounded-3xl p-5 max-h-[560px] overflow-y-auto">
          <h3 className="text-sm font-bold text-slate-800 mb-1">
            {mode === 'people'
              ? 'Impact by outlet (people fed)'
              : mode === 'jobs'
                ? 'Impact by outlet (jobs)'
                : 'Outlets'}
          </h3>
          <p className="text-[11px] text-slate-500 mb-4">
            Rolling 12 months · assumptions on Impact report
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
                    href={`/dashboard/containers/${c.container_id}`}
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
                      <span className="rounded-full bg-emerald-50 border border-emerald-100 text-emerald-800 px-2 py-0.5 font-bold">
                        👥 {c.people_fed.toLocaleString('en-ZA')} fed
                      </span>
                      <span className="rounded-full bg-violet-50 border border-violet-100 text-violet-800 px-2 py-0.5 font-bold">
                        💼 {c.jobs_total} jobs
                      </span>
                    </div>
                    <div className="text-xs text-neutral-600 mt-1.5 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-[#00b4d8]" />
                      {c.mapped
                        ? [c.city, c.province].filter(Boolean).join(', ') ||
                          'Mapped'
                        : 'No GPS — edit to pin'}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {unmapped.length > 0 && (
            <p className="mt-4 text-[11px] text-amber-700">
              {unmapped.length} outlet{unmapped.length === 1 ? '' : 's'} without
              GPS — add coordinates to show on the impact map.
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
  tone?: 'neutral' | 'emerald' | 'violet';
}) {
  const bg =
    tone === 'emerald'
      ? 'border-emerald-100 bg-emerald-50/50'
      : tone === 'violet'
        ? 'border-violet-100 bg-violet-50/50'
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
