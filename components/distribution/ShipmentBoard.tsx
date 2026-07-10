'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  MapPin,
  Package,
  Plane,
  Plus,
  Ship,
  Train,
  Truck,
  X,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  EVENT_PRESETS,
  SHIPMENT_STATUS_META,
  type ShipmentDirection,
  type ShipmentMode,
  type ShipmentStatus,
} from '@/lib/distribution/types';
import {
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
  status: ShipmentStatus | string;
  mode?: string | null;
  carrier_name?: string | null;
  carrier_id?: number | null;
  tracking_number?: string | null;
  origin?: string | null;
  destination?: string | null;
  origin_name?: string | null;
  destination_name?: string | null;
  origin_city?: string | null;
  destination_city?: string | null;
  origin_country?: string | null;
  destination_country?: string | null;
  eta?: string | null;
  progress_pct?: number | null;
  last_event_label?: string | null;
  last_event_at?: string | null;
  incoterms?: string | null;
  po_reference?: string | null;
  vehicle_code?: string | null;
  driver_name?: string | null;
  priority?: number;
};

type Carrier = { id: number; name: string; code?: string | null };
type Vehicle = { id: number; code: string; name?: string | null };
type Driver = { id: number; code: string; full_name: string };

const MODE_ICON: Record<string, typeof Truck> = {
  road: Truck,
  rail: Train,
  ocean: Ship,
  air: Plane,
  multimodal: Package,
  last_mile: Truck,
};

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'In motion' },
  { id: 'planned', label: 'Planned' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'exception', label: 'Exceptions' },
];

export function ShipmentBoard({
  companyId,
  direction,
  titleNoun,
}: {
  companyId: number;
  direction: ShipmentDirection;
  titleNoun: string;
}) {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [filter, setFilter] = useState('active');
  const [warning, setWarning] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [eventShip, setEventShip] = useState<Shipment | null>(null);
  const [form, setForm] = useState({
    origin_name: '',
    origin_city: '',
    origin_country: '',
    destination_name: '',
    destination_city: '',
    destination_country: '',
    mode: 'road',
    carrier_id: '',
    vehicle_id: '',
    driver_id: '',
    tracking_number: '',
    incoterms: direction === 'inbound' ? 'FOB' : 'DAP',
    eta: '',
    weight_kg: '',
    packages: '',
    po_reference: '',
    notes: '',
  });
  const [eventForm, setEventForm] = useState({
    event_code: 'departed',
    label: '',
    location: '',
    notes: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, cRes, fRes] = await Promise.all([
        fetch(`/api/distribution/shipments?companyId=${companyId}&direction=${direction}`),
        fetch(`/api/distribution/carriers?companyId=${companyId}`),
        fetch(`/api/distribution/fleet?companyId=${companyId}`),
      ]);
      const sData = await sRes.json();
      const cData = await cRes.json();
      const fData = await fRes.json();
      setShipments(sData.shipments || []);
      setWarning(sData.warning);
      setCarriers(cData.carriers || []);
      setVehicles(fData.vehicles || []);
      setDrivers(fData.drivers || []);
    } finally {
      setLoading(false);
    }
  }, [companyId, direction]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const active = [
      'booked',
      'picked_up',
      'in_transit',
      'at_hub',
      'customs',
      'out_for_delivery',
    ];
    if (filter === 'all') return shipments;
    if (filter === 'active') return shipments.filter((s) => active.includes(s.status));
    if (filter === 'planned')
      return shipments.filter((s) => s.status === 'planned' || s.status === 'booked');
    if (filter === 'delivered') return shipments.filter((s) => s.status === 'delivered');
    if (filter === 'exception') return shipments.filter((s) => s.status === 'exception');
    return shipments;
  }, [shipments, filter]);

  const stats = useMemo(() => {
    const active = shipments.filter((s) =>
      ['picked_up', 'in_transit', 'at_hub', 'customs', 'out_for_delivery'].includes(s.status)
    ).length;
    return {
      total: shipments.length,
      active,
      exceptions: shipments.filter((s) => s.status === 'exception').length,
      delivered: shipments.filter((s) => s.status === 'delivered').length,
    };
  }, [shipments]);

  const create = async () => {
    if (!form.origin_name && !form.origin_city) {
      toast.error('Origin required');
      return;
    }
    if (!form.destination_name && !form.destination_city) {
      toast.error('Destination required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/distribution/shipments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          direction,
          ...form,
          carrier_id: form.carrier_id ? Number(form.carrier_id) : null,
          vehicle_id: form.vehicle_id ? Number(form.vehicle_id) : null,
          driver_id: form.driver_id ? Number(form.driver_id) : null,
          weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
          packages: form.packages ? Number(form.packages) : null,
          eta: form.eta || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Create failed');
      toast.success(`${data.shipment?.shipment_number || 'Shipment'} created`);
      setShowForm(false);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const advance = async (id: number) => {
    const res = await fetch('/api/distribution/shipments', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, id, action: 'advance' }),
    });
    if (!res.ok) {
      toast.error('Advance failed');
      return;
    }
    toast.success('Status advanced');
    void load();
  };

  const postEvent = async () => {
    if (!eventShip) return;
    const preset = EVENT_PRESETS.find((p) => p.code === eventForm.event_code);
    const label = eventForm.label || preset?.label || 'Update';
    setSaving(true);
    try {
      const res = await fetch('/api/distribution/shipments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          action: 'event',
          shipment_id: eventShip.id,
          event_code: eventForm.event_code,
          label,
          location: eventForm.location || null,
          notes: eventForm.notes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Event failed');
      toast.success('Tracking event logged');
      setEventShip(null);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const isInbound = direction === 'inbound';

  return (
    <>
      <SchemaHint message={warning} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <TelemetryCard
          label={`${titleNoun}s`}
          value={stats.total}
          icon={Package}
          accent={isInbound ? 'sky' : 'cyan'}
        />
        <TelemetryCard label="In motion" value={stats.active} icon={Truck} accent="emerald" />
        <TelemetryCard label="Exceptions" value={stats.exceptions} icon={Zap} accent="rose" />
        <TelemetryCard
          label="Delivered"
          value={stats.delivered}
          icon={CheckCircle2}
          accent="violet"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border transition-all ${
                filter === f.id
                  ? 'border-[#00b4d8] bg-[#00b4d8] text-white shadow-sm'
                  : 'border-neutral-200 bg-white text-neutral-600 hover:border-[#00b4d8]/40'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="btn-primary !py-2.5 !px-5 text-sm inline-flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> New {titleNoun.toLowerCase()}
        </button>
      </div>

      {loading ? (
        <div className="py-20 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : visible.length === 0 ? (
        <EmptyMission
          title={`No ${titleNoun.toLowerCase()} shipments`}
          body={
            isInbound
              ? 'Plan supplier pickups and inbound legs — from plant to DC, port to warehouse. Log events to track every mile.'
              : 'Dispatch finished goods to customers worldwide — last-mile or ocean. Full chain visibility from dock to door.'
          }
          action={
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="btn-primary !py-2.5 !px-6 text-sm"
            >
              <Plus className="w-4 h-4 inline mr-1" /> Create first shipment
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {visible.map((s) => {
            const meta =
              SHIPMENT_STATUS_META[s.status as ShipmentStatus] || SHIPMENT_STATUS_META.planned;
            const ModeIcon = MODE_ICON[s.mode || 'road'] || Truck;
            const pct = Number(s.progress_pct ?? meta.progress);
            const from =
              s.origin_name ||
              [s.origin_city, s.origin_country].filter(Boolean).join(', ') ||
              s.origin ||
              'Origin';
            const to =
              s.destination_name ||
              [s.destination_city, s.destination_country].filter(Boolean).join(', ') ||
              s.destination ||
              'Destination';

            return (
              <div
                key={s.id}
                className="rounded-3xl border border-neutral-200 bg-white p-4 sm:p-5 shadow-sm hover:border-[#00b4d8]/30 transition-colors"
              >
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-50 to-sky-100 border border-cyan-100 flex items-center justify-center shrink-0 text-[#0077b6]">
                      <ModeIcon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-0.5">
                        <span className="font-mono text-sm font-black text-[#0077b6]">
                          {s.shipment_number || `#${s.id}`}
                        </span>
                        <StatusPill label={meta.label} className={meta.tone} pulse={meta.pulse} />
                        {s.incoterms && (
                          <span className="text-[10px] font-bold uppercase tracking-wide text-violet-600 bg-violet-50 border border-violet-100 px-2 py-0.5 rounded-full">
                            {s.incoterms}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-slate-800">
                        <span className="truncate max-w-[180px]">{from}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-[#00b4d8] shrink-0" />
                        <span className="truncate max-w-[180px]">{to}</span>
                      </div>
                      <div className="text-xs text-neutral-500 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                        {s.carrier_name && <span>{s.carrier_name}</span>}
                        {s.tracking_number && (
                          <span className="font-mono">Track {s.tracking_number}</span>
                        )}
                        {s.driver_name && <span>Driver {s.driver_name}</span>}
                        {s.vehicle_code && <span className="font-mono">{s.vehicle_code}</span>}
                        {s.eta && <span>ETA {new Date(s.eta).toLocaleString()}</span>}
                        {s.po_reference && <span>PO {s.po_reference}</span>}
                      </div>
                      {s.last_event_label && (
                        <div className="text-[11px] text-emerald-700 mt-1 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {s.last_event_label}
                          {s.last_event_at && (
                            <span className="text-neutral-400">
                              · {new Date(s.last_event_at).toLocaleString()}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="w-full lg:w-44 shrink-0">
                    <div className="flex justify-between text-[11px] font-semibold text-neutral-500 mb-1">
                      <span>Progress</span>
                      <span className="tabular-nums">{pct}%</span>
                    </div>
                    <ProgressBar pct={pct} tone={s.status === 'delivered' ? 'emerald' : 'cyan'} />
                  </div>

                  <div className="flex flex-wrap gap-1.5 shrink-0">
                    {s.status !== 'delivered' && s.status !== 'cancelled' && (
                      <>
                        <button
                          type="button"
                          onClick={() => void advance(s.id)}
                          className="inline-flex items-center gap-1 rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-[11px] font-bold text-cyan-900 hover:bg-cyan-100"
                        >
                          Advance
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEventShip(s);
                            setEventForm({
                              event_code: 'departed',
                              label: '',
                              location: '',
                              notes: '',
                            });
                          }}
                          className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100"
                        >
                          Log event
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/30 backdrop-blur-sm">
          <div className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-neutral-200 bg-white shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-neutral-100 bg-white px-5 py-4">
              <h3 className="font-black text-slate-800">New {titleNoun.toLowerCase()}</h3>
              <button type="button" onClick={() => setShowForm(false)}>
                <X className="w-5 h-5 text-neutral-400" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="block sm:col-span-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">
                    Origin
                  </span>
                  <input
                    className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
                    placeholder="Plant / warehouse / port"
                    value={form.origin_name}
                    onChange={(e) => setForm((f) => ({ ...f, origin_name: e.target.value }))}
                  />
                </label>
                <input
                  className="rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
                  placeholder="Origin city"
                  value={form.origin_city}
                  onChange={(e) => setForm((f) => ({ ...f, origin_city: e.target.value }))}
                />
                <input
                  className="rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
                  placeholder="Origin country"
                  value={form.origin_country}
                  onChange={(e) => setForm((f) => ({ ...f, origin_country: e.target.value }))}
                />
                <label className="block sm:col-span-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">
                    Destination
                  </span>
                  <input
                    className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
                    placeholder="DC / customer / port"
                    value={form.destination_name}
                    onChange={(e) => setForm((f) => ({ ...f, destination_name: e.target.value }))}
                  />
                </label>
                <input
                  className="rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
                  placeholder="Dest city"
                  value={form.destination_city}
                  onChange={(e) => setForm((f) => ({ ...f, destination_city: e.target.value }))}
                />
                <input
                  className="rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
                  placeholder="Dest country"
                  value={form.destination_country}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, destination_country: e.target.value }))
                  }
                />
                <select
                  className="rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
                  value={form.mode}
                  onChange={(e) => setForm((f) => ({ ...f, mode: e.target.value as ShipmentMode }))}
                >
                  <option value="road">Road</option>
                  <option value="rail">Rail</option>
                  <option value="ocean">Ocean</option>
                  <option value="air">Air</option>
                  <option value="multimodal">Multimodal</option>
                  <option value="last_mile">Last mile</option>
                </select>
                <select
                  className="rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
                  value={form.incoterms}
                  onChange={(e) => setForm((f) => ({ ...f, incoterms: e.target.value }))}
                >
                  {['EXW', 'FCA', 'FOB', 'CIF', 'CFR', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'].map(
                    (c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    )
                  )}
                </select>
                <select
                  className="rounded-xl border border-neutral-200 px-3 py-2.5 text-sm sm:col-span-2"
                  value={form.carrier_id}
                  onChange={(e) => setForm((f) => ({ ...f, carrier_id: e.target.value }))}
                >
                  <option value="">Carrier (optional)</option>
                  {carriers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
                  value={form.vehicle_id}
                  onChange={(e) => setForm((f) => ({ ...f, vehicle_id: e.target.value }))}
                >
                  <option value="">Vehicle</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.code} {v.name || ''}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
                  value={form.driver_id}
                  onChange={(e) => setForm((f) => ({ ...f, driver_id: e.target.value }))}
                >
                  <option value="">Driver</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.full_name}
                    </option>
                  ))}
                </select>
                <input
                  className="rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
                  placeholder="Tracking #"
                  value={form.tracking_number}
                  onChange={(e) => setForm((f) => ({ ...f, tracking_number: e.target.value }))}
                />
                <input
                  type="datetime-local"
                  className="rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
                  value={form.eta}
                  onChange={(e) => setForm((f) => ({ ...f, eta: e.target.value }))}
                />
                <input
                  className="rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
                  placeholder="PO / ref"
                  value={form.po_reference}
                  onChange={(e) => setForm((f) => ({ ...f, po_reference: e.target.value }))}
                />
                <input
                  type="number"
                  className="rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
                  placeholder="Weight kg"
                  value={form.weight_kg}
                  onChange={(e) => setForm((f) => ({ ...f, weight_kg: e.target.value }))}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="btn-secondary !py-2.5 !px-5 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void create()}
                  className="btn-primary !py-2.5 !px-6 text-sm inline-flex items-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Create shipment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {eventShip && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/30 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-neutral-200 bg-white shadow-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-slate-800">
                Log event · {eventShip.shipment_number}
              </h3>
              <button type="button" onClick={() => setEventShip(null)}>
                <X className="w-5 h-5 text-neutral-400" />
              </button>
            </div>
            <div className="space-y-3">
              <select
                className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
                value={eventForm.event_code}
                onChange={(e) => setEventForm((f) => ({ ...f, event_code: e.target.value }))}
              >
                {EVENT_PRESETS.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.label}
                  </option>
                ))}
              </select>
              <input
                className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
                placeholder="Location"
                value={eventForm.location}
                onChange={(e) => setEventForm((f) => ({ ...f, location: e.target.value }))}
              />
              <input
                className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
                placeholder="Custom label (optional)"
                value={eventForm.label}
                onChange={(e) => setEventForm((f) => ({ ...f, label: e.target.value }))}
              />
              <textarea
                className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
                rows={2}
                placeholder="Notes"
                value={eventForm.notes}
                onChange={(e) => setEventForm((f) => ({ ...f, notes: e.target.value }))}
              />
              <button
                type="button"
                disabled={saving}
                onClick={() => void postEvent()}
                className="btn-primary w-full !py-3 text-sm inline-flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                Post tracking event
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
