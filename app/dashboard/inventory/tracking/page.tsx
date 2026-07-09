'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  Loader2,
  Radio,
  RefreshCw,
  Truck,
  MapPin,
  Clock,
  AlertTriangle,
  Navigation,
  ExternalLink,
  QrCode,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  formatDuration,
  formatEtaClock,
} from '@/lib/inventory/eta';
import { CompanyRequired, InventoryHeader } from '@/components/inventory/InventoryShell';

const TransferLiveMap = dynamic(() => import('@/components/inventory/TransferLiveMap'), {
  ssr: false,
  loading: () => (
    <div className="h-[380px] rounded-3xl border bg-neutral-50 flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
    </div>
  ),
});

type Eta = {
  distance_km: number | null;
  remaining_km: number | null;
  eta_minutes: number | null;
  eta_at: string | null;
  speed_kmh: number | null;
  progress_pct: number | null;
  method: string;
  dest: { lat: number; lng: number } | null;
  current: { lat: number; lng: number } | null;
  origin: { lat: number; lng: number } | null;
};

type LiveTransfer = {
  id: number;
  transfer_number?: string | null;
  status: string;
  driver_name?: string | null;
  driver_phone?: string | null;
  driver_url?: string | null;
  from_warehouse_name?: string | null;
  to_warehouse_name?: string | null;
  from_city?: string | null;
  to_city?: string | null;
  from_address?: string | null;
  to_address?: string | null;
  collection_physical?: boolean;
  destination_physical?: boolean;
  from_lat?: number | null;
  from_lng?: number | null;
  to_lat?: number | null;
  to_lng?: number | null;
  expected_receive_date?: string | null;
  shipped_at?: string | null;
  pickup_scanned_at?: string | null;
  last_location_at?: string | null;
  last_lat?: number | null;
  last_lng?: number | null;
  units: number;
  line_count: number;
  is_moving: boolean;
  delayed: boolean;
  eta: Eta;
  trail?: Array<{ lat: number; lng: number; at?: string }>;
  lines?: Array<{ product_name?: string; qty_requested?: number; qty_shipped?: number }>;
};

type Summary = {
  moving: number;
  upcoming: number;
  delayed: number;
  withGps: number;
  withEta: number;
};

function relTime(iso?: string | null) {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return formatEtaClock(iso);
  if (ms < 15000) return 'just now';
  if (ms < 60000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`;
  if (ms < 86400000) return `${Math.floor(ms / 3600000)}h ago`;
  return new Date(iso).toLocaleString();
}

export default function LiveTransferTrackingPage() {
  return (
    <CompanyRequired>
      <TrackingInner />
    </CompanyRequired>
  );
}

function TrackingInner() {
  const companyId = getSelectedCompanyId()!;
  const [moving, setMoving] = useState<LiveTransfer[]>([]);
  const [upcoming, setUpcoming] = useState<LiveTransfer[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [asOf, setAsOf] = useState<string | null>(null);
  const [live, setLive] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      else setRefreshing(true);
      try {
        const res = await fetch(`/api/inventory/transfers/live?companyId=${companyId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed');
        setMoving(data.moving || []);
        setUpcoming(data.upcoming || []);
        setSummary(data.summary || null);
        setAsOf(data.asOf || new Date().toISOString());
        if (data.warning) toast.message(data.warning, { description: data.hint });
        // Keep selection if still present
        if (selectedId && !(data.moving || []).some((t: LiveTransfer) => t.id === selectedId)) {
          setSelectedId(null);
        }
      } catch (e: unknown) {
        if (!opts?.silent) toast.error(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [companyId, selectedId]
  );

  useEffect(() => {
    void load();
  }, [companyId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => void load({ silent: true }), 15000);
    return () => clearInterval(id);
  }, [live, load]);

  const mapTransfers = useMemo(() => {
    return moving.map((t) => ({
      id: t.id,
      transfer_number: t.transfer_number,
      status: t.status,
      driver_name: t.driver_name,
      to_warehouse_name: t.to_warehouse_name,
      current: t.eta?.current || (t.last_lat != null && t.last_lng != null
        ? { lat: Number(t.last_lat), lng: Number(t.last_lng) }
        : null),
      dest: t.eta?.dest || null,
      origin: t.eta?.origin || null,
      trail: t.trail || [],
      eta_label:
        t.eta?.eta_minutes != null
          ? `${formatDuration(t.eta.eta_minutes)} · ${formatEtaClock(t.eta.eta_at)}`
          : undefined,
    }));
  }, [moving]);

  const selected = moving.find((t) => t.id === selectedId) || moving[0] || null;

  return (
    <div className="px-2 md:px-4 max-w-screen-2xl mx-auto pb-12">
      <InventoryHeader
        title="Live transfer tracking"
        description="Watch stock in motion — GPS from driver phones, distance remaining, and estimated arrival at destination."
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/inventory/stock-transfers"
              className="btn-secondary !py-2.5 !px-4 text-sm"
            >
              Manage transfers
            </Link>
            <button
              type="button"
              onClick={() => void load({ silent: true })}
              className="btn-primary !py-2.5 !px-4 text-sm inline-flex items-center gap-1.5"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
        }
      />

      {/* Live bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5 text-xs">
        <div className="inline-flex items-center gap-2 text-neutral-600">
          <span
            className={`inline-flex items-center gap-1.5 font-semibold ${live ? 'text-emerald-700' : 'text-neutral-500'}`}
          >
            <Radio className={`w-3.5 h-3.5 ${live && !refreshing ? 'animate-pulse' : ''}`} />
            {live ? 'Live · 15s' : 'Paused'}
          </span>
          <span className="text-neutral-400">·</span>
          <span>Updated {asOf ? relTime(asOf) : '—'}</span>
        </div>
        <button
          type="button"
          onClick={() => setLive((v) => !v)}
          className={`px-3 py-1.5 rounded-full border text-xs font-semibold ${
            live
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-neutral-200 text-neutral-600'
          }`}
        >
          {live ? 'Auto-refresh on' : 'Auto-refresh off'}
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Kpi label="In transit" value={summary?.moving ?? 0} sub="active movements" tone="sky" />
        <Kpi
          label="With GPS"
          value={summary?.withGps ?? 0}
          sub="live driver position"
          tone="emerald"
        />
        <Kpi label="ETA available" value={summary?.withEta ?? 0} sub="calc or schedule" />
        <Kpi
          label="Delayed"
          value={summary?.delayed ?? 0}
          sub="past expected receive"
          tone={(summary?.delayed || 0) > 0 ? 'amber' : 'neutral'}
        />
      </div>

      {loading ? (
        <div className="p-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <div className="grid lg:grid-cols-5 gap-6">
          {/* List */}
          <div className="lg:col-span-2 space-y-3">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Truck className="w-4 h-4 text-[#00b4d8]" /> Moving now
            </h2>
            {moving.length === 0 ? (
              <div className="rounded-3xl border bg-white p-8 text-center text-sm text-neutral-500">
                <Navigation className="w-10 h-10 mx-auto mb-3 text-neutral-300" />
                <p className="mb-2">No transfers in transit right now.</p>
                <p className="text-xs text-neutral-400 mb-4">
                  Create a transfer and have the driver scan pickup on their phone.
                </p>
                <Link href="/dashboard/inventory/stock-transfers" className="btn-primary !py-2 !px-4 text-sm">
                  Open transfers
                </Link>
              </div>
            ) : (
              <ul className="space-y-2">
                {moving.map((t) => {
                  const active = (selected?.id || moving[0]?.id) === t.id;
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(t.id)}
                        className={`w-full text-left rounded-3xl border p-4 transition-all ${
                          active
                            ? 'border-[#00b4d8] bg-[#00b4d8]/5 shadow-sm'
                            : 'border-neutral-200 bg-white hover:border-neutral-300'
                        } ${t.delayed ? 'ring-1 ring-amber-200' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <span className="font-bold font-mono text-slate-900">
                            {t.transfer_number || `#${t.id}`}
                          </span>
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                              t.delayed
                                ? 'bg-amber-100 text-amber-900'
                                : 'bg-sky-100 text-sky-800'
                            }`}
                          >
                            {t.delayed ? 'Delayed' : t.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div className="text-xs text-neutral-600 mb-2">
                          <span className={t.collection_physical ? 'text-emerald-800' : ''}>
                            {t.from_warehouse_name || '—'}
                            {t.from_city ? ` (${t.from_city})` : ''}
                          </span>
                          {' → '}
                          <strong className={t.destination_physical ? 'text-emerald-800' : ''}>
                            {t.to_warehouse_name || '—'}
                          </strong>
                          {t.to_city ? ` (${t.to_city})` : ''}
                        </div>
                        {(!t.collection_physical || !t.destination_physical) && (
                          <div className="text-[10px] text-amber-700 mb-1">
                            {!t.collection_physical && !t.destination_physical
                              ? 'Pin GPS on both locations for route accuracy'
                              : !t.collection_physical
                                ? 'Collection site missing physical GPS'
                                : 'Destination missing physical GPS'}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                          <span className="inline-flex items-center gap-1 font-semibold text-[#0077b6]">
                            <Clock className="w-3.5 h-3.5" />
                            ETA {formatDuration(t.eta?.eta_minutes)}
                          </span>
                          {t.eta?.remaining_km != null && (
                            <span className="text-neutral-500">
                              {t.eta.remaining_km} km left
                            </span>
                          )}
                          {t.eta?.speed_kmh != null && (
                            <span className="text-neutral-500">~{t.eta.speed_kmh} km/h</span>
                          )}
                        </div>
                        {t.eta?.progress_pct != null && (
                          <div className="mt-2 h-1.5 rounded-full bg-neutral-100 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[#00b4d8] transition-all"
                              style={{ width: `${t.eta.progress_pct}%` }}
                            />
                          </div>
                        )}
                        <div className="mt-2 text-[11px] text-neutral-400">
                          {t.driver_name ? `${t.driver_name} · ` : ''}
                          GPS {t.last_location_at ? relTime(t.last_location_at) : 'not yet'}
                          {' · '}
                          {t.units} units
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {upcoming.length > 0 && (
              <div className="pt-4">
                <h2 className="text-sm font-bold text-slate-800 mb-2">Draft / awaiting pickup</h2>
                <ul className="space-y-2">
                  {upcoming.slice(0, 5).map((t) => (
                    <li
                      key={t.id}
                      className="rounded-2xl border border-dashed border-neutral-200 bg-white px-4 py-3 text-sm"
                    >
                      <div className="font-mono font-semibold">{t.transfer_number}</div>
                      <div className="text-xs text-neutral-500">
                        {t.from_warehouse_name} → {t.to_warehouse_name}
                      </div>
                      {t.driver_url && (
                        <a
                          href={t.driver_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] font-semibold text-[#00b4d8] inline-flex items-center gap-1 mt-1"
                        >
                          <QrCode className="w-3 h-3" /> Driver link
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Map + detail */}
          <div className="lg:col-span-3 space-y-4">
            <TransferLiveMap transfers={mapTransfers} />

            {selected ? (
              <div className="rounded-3xl border bg-white p-5 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-neutral-400 font-semibold uppercase tracking-wide">
                      Selected transfer
                    </div>
                    <div className="text-xl font-black font-mono text-slate-900">
                      {selected.transfer_number}
                    </div>
                    <div className="text-sm text-neutral-600 mt-1">
                      {selected.from_warehouse_name} → {selected.to_warehouse_name}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-black text-[#00b4d8]">
                      {formatDuration(selected.eta?.eta_minutes)}
                    </div>
                    <div className="text-xs text-neutral-500">
                      Arrive {formatEtaClock(selected.eta?.eta_at)}
                    </div>
                    <div className="text-[10px] text-neutral-400 mt-0.5 capitalize">
                      via{' '}
                      {selected.eta?.method === 'physical'
                        ? 'physical sites'
                        : selected.eta?.method === 'gps'
                          ? 'live GPS'
                          : selected.eta?.method}
                    </div>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3 text-xs">
                  <div className="rounded-2xl border bg-emerald-50/50 border-emerald-100 px-3 py-2">
                    <div className="font-semibold text-emerald-900 mb-0.5">Collection (from)</div>
                    <div className="text-emerald-900/80">{selected.from_warehouse_name}</div>
                    <div className="text-emerald-800/70 mt-0.5">
                      {selected.from_address || selected.from_city || '—'}
                    </div>
                    {selected.from_lat != null && selected.from_lng != null ? (
                      <div className="font-mono text-[10px] mt-1 text-emerald-700">
                        {Number(selected.from_lat).toFixed(5)}, {Number(selected.from_lng).toFixed(5)}
                        {selected.collection_physical ? ' · physical pin' : ' · approx'}
                      </div>
                    ) : (
                      <div className="text-amber-700 mt-1">No GPS — pin location on Locations page</div>
                    )}
                  </div>
                  <div className="rounded-2xl border bg-amber-50/50 border-amber-100 px-3 py-2">
                    <div className="font-semibold text-amber-900 mb-0.5">Destination (to)</div>
                    <div className="text-amber-900/80">{selected.to_warehouse_name}</div>
                    <div className="text-amber-800/70 mt-0.5">
                      {selected.to_address || selected.to_city || '—'}
                    </div>
                    {selected.to_lat != null && selected.to_lng != null ? (
                      <div className="font-mono text-[10px] mt-1 text-amber-800">
                        {Number(selected.to_lat).toFixed(5)}, {Number(selected.to_lng).toFixed(5)}
                        {selected.destination_physical ? ' · physical pin' : ' · approx'}
                      </div>
                    ) : (
                      <div className="text-amber-700 mt-1">No GPS — pin location on Locations page</div>
                    )}
                  </div>
                </div>

                <div className="grid sm:grid-cols-3 gap-3 text-sm">
                  <div className="rounded-2xl bg-neutral-50 border px-3 py-2">
                    <div className="text-[10px] uppercase text-neutral-400 font-semibold">
                      Route / remaining
                    </div>
                    <div className="font-bold">
                      {selected.eta?.remaining_km != null
                        ? `${selected.eta.remaining_km} km`
                        : selected.eta?.distance_km != null
                          ? `${selected.eta.distance_km} km route`
                          : '—'}
                    </div>
                    {selected.eta?.distance_km != null && (
                      <div className="text-[10px] text-neutral-400">
                        Full site-to-site ~{selected.eta.distance_km} km
                      </div>
                    )}
                  </div>
                  <div className="rounded-2xl bg-neutral-50 border px-3 py-2">
                    <div className="text-[10px] uppercase text-neutral-400 font-semibold">
                      Speed
                    </div>
                    <div className="font-bold">
                      {selected.eta?.speed_kmh != null
                        ? `~${selected.eta.speed_kmh} km/h`
                        : '—'}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-neutral-50 border px-3 py-2">
                    <div className="text-[10px] uppercase text-neutral-400 font-semibold">
                      Progress
                    </div>
                    <div className="font-bold">
                      {selected.eta?.progress_pct != null
                        ? `${selected.eta.progress_pct}%`
                        : '—'}
                    </div>
                  </div>
                </div>

                {selected.delayed && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Past expected receive ({selected.expected_receive_date}). Still open.
                  </div>
                )}

                <div className="flex flex-wrap gap-2 text-xs">
                  {selected.driver_name && (
                    <span className="px-2.5 py-1 rounded-full bg-neutral-100">
                      Driver: {selected.driver_name}
                      {selected.driver_phone ? ` · ${selected.driver_phone}` : ''}
                    </span>
                  )}
                  {selected.last_lat != null && selected.last_lng != null && (
                    <a
                      href={`https://www.google.com/maps?q=${selected.last_lat},${selected.last_lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1 rounded-full bg-sky-50 text-sky-800 font-semibold inline-flex items-center gap-1"
                    >
                      <MapPin className="w-3 h-3" /> Open in Maps <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {selected.driver_url && (
                    <a
                      href={selected.driver_url}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1 rounded-full bg-violet-50 text-violet-800 font-semibold inline-flex items-center gap-1"
                    >
                      <QrCode className="w-3 h-3" /> Driver phone page
                    </a>
                  )}
                  <Link
                    href="/dashboard/inventory/stock-transfers"
                    className="px-2.5 py-1 rounded-full bg-neutral-100 font-semibold"
                  >
                    Open in Transfers
                  </Link>
                </div>

                {(selected.lines || []).length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-neutral-500 mb-1">Cargo</div>
                    <ul className="text-sm divide-y border rounded-2xl overflow-hidden">
                      {(selected.lines || []).map((l, i) => (
                        <li key={i} className="px-3 py-2 flex justify-between bg-white">
                          <span>{l.product_name || 'Product'}</span>
                          <span className="font-semibold tabular-nums">
                            {Number(l.qty_shipped || l.qty_requested || 0)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-3xl border bg-white p-8 text-center text-sm text-neutral-500">
                Select a transfer to see ETA detail.
              </div>
            )}

            <p className="text-[11px] text-neutral-400 leading-relaxed">
              Route is always <strong>collection site GPS → destination site GPS</strong> (pinned on
              Locations). While in transit, remaining distance is from the driver&apos;s live position
              to the destination pin. Pin both sites under Locations for accurate ETA. SQL:{' '}
              <code className="font-mono">20260709_transfer_physical_endpoints.sql</code>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  sub: string;
  tone?: 'neutral' | 'amber' | 'sky' | 'emerald';
}) {
  const tones = {
    neutral: 'bg-white border-neutral-200',
    amber: 'bg-amber-50 border-amber-100',
    sky: 'bg-sky-50 border-sky-100',
    emerald: 'bg-emerald-50 border-emerald-100',
  };
  return (
    <div className={`rounded-3xl border p-4 ${tones[tone]}`}>
      <div className="text-[11px] text-neutral-500 mb-0.5">{label}</div>
      <div className="text-2xl font-black tracking-tighter text-slate-900">{value}</div>
      <div className="text-[10px] text-neutral-500 mt-0.5">{sub}</div>
    </div>
  );
}
