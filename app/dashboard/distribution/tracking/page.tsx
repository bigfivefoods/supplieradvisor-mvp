'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  Loader2,
  MapPin,
  Package,
  Plane,
  RefreshCw,
  Ship,
  Train,
  Truck,
} from 'lucide-react';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  SHIPMENT_STATUS_META,
  type ShipmentStatus,
} from '@/lib/distribution/types';
import {
  CompanyRequired,
  DistributionHeader,
  DistributionPage,
  EmptyMission,
  ProgressBar,
  SchemaHint,
  StatusPill,
  TelemetryCard,
} from '@/components/distribution/DistributionShell';

type Shipment = {
  id: number;
  shipment_number?: string | null;
  direction: string;
  status: string;
  mode?: string | null;
  carrier_name?: string | null;
  tracking_number?: string | null;
  origin?: string | null;
  destination?: string | null;
  origin_name?: string | null;
  destination_name?: string | null;
  progress_pct?: number | null;
  last_event_label?: string | null;
  last_event_at?: string | null;
  eta?: string | null;
  incoterms?: string | null;
};

type Event = {
  id: number;
  shipment_id: number;
  label: string;
  event_code: string;
  location?: string | null;
  occurred_at: string;
  source?: string | null;
};

const MODE_ICON: Record<string, typeof Truck> = {
  road: Truck,
  rail: Train,
  ocean: Ship,
  air: Plane,
  multimodal: Package,
  last_mile: Truck,
};

export default function TrackingPage() {
  return (
    <CompanyRequired>
      <TrackingInner />
    </CompanyRequired>
  );
}

function TrackingInner() {
  const companyId = getSelectedCompanyId();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [warning, setWarning] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/distribution/shipments?companyId=${companyId}`);
      const data = await res.json();
      setShipments(data.shipments || []);
      setWarning(data.warning);
      if (!selectedId && data.shipments?.[0]) setSelectedId(data.shipments[0].id);
    } finally {
      setLoading(false);
    }
  }, [companyId, selectedId]);

  const loadEvents = useCallback(async () => {
    if (!companyId || !selectedId) {
      setEvents([]);
      return;
    }
    setLoadingEvents(true);
    try {
      const res = await fetch(
        `/api/distribution/shipments?companyId=${companyId}&id=${selectedId}`
      );
      const data = await res.json();
      setEvents(data.events || []);
    } finally {
      setLoadingEvents(false);
    }
  }, [companyId, selectedId]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const filtered = useMemo(() => {
    if (!q.trim()) return shipments;
    const n = q.toLowerCase();
    return shipments.filter(
      (s) =>
        s.shipment_number?.toLowerCase().includes(n) ||
        s.tracking_number?.toLowerCase().includes(n) ||
        s.carrier_name?.toLowerCase().includes(n) ||
        s.origin?.toLowerCase().includes(n) ||
        s.destination?.toLowerCase().includes(n) ||
        s.origin_name?.toLowerCase().includes(n) ||
        s.destination_name?.toLowerCase().includes(n)
    );
  }, [shipments, q]);

  const selected = shipments.find((s) => s.id === selectedId) || null;
  const inMotion = shipments.filter((s) =>
    ['picked_up', 'in_transit', 'at_hub', 'customs', 'out_for_delivery'].includes(s.status)
  ).length;

  return (
    <DistributionPage>
      <DistributionHeader
        title="Live"
        titleAccent="tracking"
        description="Control-tower visibility across inbound and outbound — search, select, and walk the event spine of every shipment."
        action={
          <button
            type="button"
            onClick={() => void load()}
            className="btn-secondary !py-2.5 !px-4 text-sm inline-flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      <SchemaHint message={warning} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <TelemetryCard label="Shipments" value={shipments.length} accent="cyan" icon={Package} />
        <TelemetryCard label="In motion" value={inMotion} accent="emerald" icon={Truck} />
        <TelemetryCard
          label="Inbound"
          value={shipments.filter((s) => s.direction === 'inbound').length}
          accent="sky"
          icon={ArrowDownToLine}
        />
        <TelemetryCard
          label="Outbound"
          value={shipments.filter((s) => s.direction === 'outbound').length}
          accent="violet"
          icon={ArrowUpFromLine}
        />
      </div>

      <div className="mb-4">
        <input
          className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white px-4 py-2.5 text-sm shadow-sm focus:border-[#00b4d8] focus:outline-none"
          placeholder="Search number, tracking, carrier, city…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="py-20 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : shipments.length === 0 ? (
        <EmptyMission
          title="Nothing to track yet"
          body="Create inbound or outbound shipments, then log events as goods move. This tower becomes your single source of logistics truth."
        />
      ) : (
        <div className="grid lg:grid-cols-[1fr_360px] gap-4">
          <div className="space-y-2">
            {filtered.map((s) => {
              const meta =
                SHIPMENT_STATUS_META[s.status as ShipmentStatus] || SHIPMENT_STATUS_META.planned;
              const ModeIcon = MODE_ICON[s.mode || 'road'] || Truck;
              const active = selectedId === s.id;
              const from = s.origin_name || s.origin || 'Origin';
              const to = s.destination_name || s.destination || 'Destination';
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedId(s.id)}
                  className={`w-full text-left rounded-2xl border p-4 transition-all ${
                    active
                      ? 'border-[#00b4d8] bg-sky-50/80 shadow-sm'
                      : 'border-neutral-200 bg-white hover:border-cyan-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-50 to-white border border-cyan-100 flex items-center justify-center text-[#0077b6] shrink-0">
                      <ModeIcon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-0.5">
                        <span className="font-mono text-xs font-black text-[#0077b6]">
                          {s.shipment_number || `#${s.id}`}
                        </span>
                        <StatusPill label={meta.label} className={meta.tone} pulse={meta.pulse} />
                        <span
                          className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                            s.direction === 'inbound'
                              ? 'bg-sky-50 text-sky-700'
                              : 'bg-cyan-50 text-cyan-800'
                          }`}
                        >
                          {s.direction}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                        <span className="truncate">{from}</span>
                        <ArrowRight className="w-3 h-3 text-[#00b4d8] shrink-0" />
                        <span className="truncate">{to}</span>
                      </div>
                      <div className="mt-2">
                        <ProgressBar pct={Number(s.progress_pct ?? meta.progress)} />
                      </div>
                      {s.last_event_label && (
                        <div className="text-[11px] text-neutral-500 mt-1.5 truncate">
                          {s.last_event_label}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="rounded-3xl border border-neutral-200 bg-white shadow-sm overflow-hidden lg:sticky lg:top-4 self-start">
            <div className="border-b border-neutral-100 bg-gradient-to-r from-sky-50 to-white px-4 py-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#00b4d8]" />
                <div>
                  <div className="font-mono text-sm font-black text-[#0077b6]">
                    {selected?.shipment_number || 'Select a shipment'}
                  </div>
                  {selected && (
                    <div className="text-[11px] text-neutral-500">
                      {selected.carrier_name || 'No carrier'} ·{' '}
                      {selected.tracking_number || 'No tracking #'}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="p-4 max-h-[60vh] overflow-y-auto">
              {loadingEvents ? (
                <div className="py-10 flex justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-[#00b4d8]" />
                </div>
              ) : events.length === 0 ? (
                <p className="text-sm text-neutral-400 text-center py-8">
                  No events yet. Log events from inbound/outbound boards.
                </p>
              ) : (
                <ol className="relative border-l-2 border-cyan-100 ml-2 space-y-0">
                  {events.map((ev) => (
                    <li key={ev.id} className="ml-4 pb-5 last:pb-0">
                      <span className="absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full border-2 border-white bg-[#00b4d8] shadow-sm" />
                      <div className="text-sm font-bold text-slate-800">{ev.label}</div>
                      <div className="text-[11px] text-neutral-500 mt-0.5">
                        {new Date(ev.occurred_at).toLocaleString()}
                        {ev.location && ` · ${ev.location}`}
                        {ev.source && (
                          <span className="text-neutral-400"> · {ev.source}</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </div>
      )}
    </DistributionPage>
  );
}
