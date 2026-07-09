'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Loader2,
  Truck,
  PackageCheck,
  MapPin,
  Phone,
  User,
  ScanLine,
  Navigation,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';

type TransferLine = {
  id: number;
  product_name?: string | null;
  sku?: string | null;
  uom?: string | null;
  qty_requested: number;
  qty_shipped?: number;
  qty_received?: number;
  lot_number?: string | null;
};

type Transfer = {
  id: number;
  transfer_number?: string;
  status: string;
  from_warehouse_name?: string | null;
  to_warehouse_name?: string | null;
  driver_name?: string | null;
  driver_phone?: string | null;
  vehicle_reg?: string | null;
  lines?: TransferLine[];
  events?: Array<{
    id: number;
    event_type: string;
    actor_name?: string | null;
    lat?: number | null;
    lng?: number | null;
    notes?: string | null;
    created_at?: string;
  }>;
  shipped_at?: string | null;
  received_at?: string | null;
  last_lat?: number | null;
  last_lng?: number | null;
  last_location_at?: string | null;
  pickup_scanned_at?: string | null;
  dropoff_scanned_at?: string | null;
};

type Geo = { lat: number; lng: number; accuracy?: number };

/**
 * Mobile driver handoff — open from QR on transfer slip.
 * Flow: identify → pickup scan → GPS while en route → deliver / receive.
 */
export default function DriverTransferPage() {
  const { token } = useParams() as { token: string };
  const [transfer, setTransfer] = useState<Transfer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [vehicleReg, setVehicleReg] = useState('');
  const [notes, setNotes] = useState('');
  const [geo, setGeo] = useState<Geo | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [tracking, setTracking] = useState(false);
  const watchRef = useRef<number | null>(null);
  const lastPing = useRef(0);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/inventory/transfers/driver?token=${encodeURIComponent(token)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.hint || 'Not found');
      setTransfer(data.transfer);
      if (data.transfer?.driver_name) setDriverName(data.transfer.driver_name);
      if (data.transfer?.driver_phone) setDriverPhone(data.transfer.driver_phone);
      if (data.transfer?.vehicle_reg) setVehicleReg(data.transfer.vehicle_reg);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load transfer');
      setTransfer(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const captureGeo = useCallback((): Promise<Geo | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        setGeoError('GPS not available on this device');
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const g = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          };
          setGeo(g);
          setGeoError(null);
          resolve(g);
        },
        (err) => {
          setGeoError(err.message || 'Location permission denied');
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 5000 }
      );
    });
  }, []);

  useEffect(() => {
    void captureGeo();
  }, [captureGeo]);

  // Auto GPS pings while in transit
  useEffect(() => {
    if (!tracking || !transfer || !['in_transit', 'shipped', 'partially_received'].includes(transfer.status)) {
      if (watchRef.current != null) {
        navigator.geolocation.clearWatch(watchRef.current);
        watchRef.current = null;
      }
      return;
    }
    if (!navigator.geolocation) return;

    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const g = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        setGeo(g);
        const now = Date.now();
        // Ping at most every 45s
        if (now - lastPing.current < 45000) return;
        lastPing.current = now;
        void fetch('/api/inventory/transfers/driver', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            action: 'ping',
            driverName,
            driverPhone,
            geo: g,
          }),
        }).catch(() => {});
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 15000 }
    );

    return () => {
      if (watchRef.current != null) {
        navigator.geolocation.clearWatch(watchRef.current);
        watchRef.current = null;
      }
    };
  }, [tracking, transfer, token, driverName, driverPhone]);

  const act = async (action: string) => {
    setBusy(true);
    setMessage(null);
    try {
      const g = (await captureGeo()) || geo;
      const res = await fetch('/api/inventory/transfers/driver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          action,
          driverName: driverName || undefined,
          driverPhone: driverPhone || undefined,
          vehicleReg: vehicleReg || undefined,
          notes: notes || undefined,
          geo: g || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');
      if (data.transfer) setTransfer(data.transfer);
      if (action === 'pickup' || action === 'ship') {
        setTracking(true);
        setMessage(data.already ? 'Already in transit' : 'Pickup confirmed — stock left source');
      } else if (action === 'deliver' || action === 'receive') {
        setTracking(false);
        setMessage(
          data.already
            ? 'Already received'
            : data.transfer?.status === 'received'
              ? 'Delivered & received at destination'
              : 'Delivery recorded'
        );
      } else if (action === 'identify') {
        setMessage('Driver details saved');
      }
      void load();
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <Loader2 className="w-10 h-10 animate-spin text-[#00b4d8]" />
      </div>
    );
  }

  if (error || !transfer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 px-6">
        <div className="text-center max-w-sm text-white">
          <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Transfer not found</h1>
          <p className="text-sm text-white/70 mb-6">{error || 'Invalid or expired code'}</p>
          <p className="text-xs text-white/40">
            Scan the QR on the transfer slip or open the driver link from the warehouse office.
          </p>
        </div>
      </div>
    );
  }

  const status = String(transfer.status);
  const isDraft = status === 'draft';
  const inTransit = ['in_transit', 'shipped', 'partially_received'].includes(status);
  const done = status === 'received';
  const cancelled = status === 'cancelled';

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-28">
      <div className="sticky top-0 z-20 bg-slate-950/95 backdrop-blur border-b border-white/10 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#00b4d8] font-bold">
              Driver handoff
            </div>
            <div className="font-mono font-bold text-lg">{transfer.transfer_number}</div>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="p-2 rounded-xl bg-white/10"
            aria-label="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
        <div className="mt-2">
          <StatusPill status={status} />
        </div>
      </div>

      <div className="px-4 pt-5 space-y-4 max-w-lg mx-auto">
        {/* Route */}
        <div className="rounded-3xl bg-white/5 border border-white/10 p-4">
          <div className="flex gap-3">
            <div className="flex flex-col items-center pt-1">
              <div className="w-3 h-3 rounded-full bg-emerald-400" />
              <div className="w-0.5 flex-1 bg-white/20 my-1 min-h-[28px]" />
              <MapPin className="w-4 h-4 text-[#00b4d8]" />
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <div className="text-[10px] uppercase text-white/40 font-semibold">From</div>
                <div className="font-semibold text-base">
                  {transfer.from_warehouse_name || 'Source'}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-white/40 font-semibold">To</div>
                <div className="font-semibold text-base">
                  {transfer.to_warehouse_name || 'Destination'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Lines */}
        <div className="rounded-3xl bg-white/5 border border-white/10 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 text-sm font-semibold">
            Cargo ({transfer.lines?.length || 0} lines)
          </div>
          <ul className="divide-y divide-white/5">
            {(transfer.lines || []).map((l) => (
              <li key={l.id} className="px-4 py-3 flex justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{l.product_name || 'Product'}</div>
                  <div className="text-xs text-white/40 font-mono">
                    {l.sku || '—'}
                    {l.lot_number ? ` · lot ${l.lot_number}` : ''}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-bold text-lg tabular-nums">{Number(l.qty_requested)}</div>
                  <div className="text-[10px] text-white/40">
                    ship {Number(l.qty_shipped || 0)} · recv {Number(l.qty_received || 0)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Driver identity */}
        {!done && !cancelled && (
          <div className="rounded-3xl bg-white/5 border border-white/10 p-4 space-y-3">
            <div className="text-sm font-semibold flex items-center gap-2">
              <User className="w-4 h-4 text-[#00b4d8]" /> Your details
            </div>
            <input
              className="w-full rounded-2xl bg-white/10 border border-white/10 px-4 py-3 text-base outline-none focus:border-[#00b4d8]"
              placeholder="Full name"
              value={driverName}
              onChange={(e) => setDriverName(e.target.value)}
              autoComplete="name"
            />
            <input
              className="w-full rounded-2xl bg-white/10 border border-white/10 px-4 py-3 text-base outline-none focus:border-[#00b4d8]"
              placeholder="Mobile number"
              type="tel"
              value={driverPhone}
              onChange={(e) => setDriverPhone(e.target.value)}
              autoComplete="tel"
            />
            <input
              className="w-full rounded-2xl bg-white/10 border border-white/10 px-4 py-3 text-base outline-none focus:border-[#00b4d8]"
              placeholder="Vehicle reg (optional)"
              value={vehicleReg}
              onChange={(e) => setVehicleReg(e.target.value)}
            />
            <textarea
              className="w-full rounded-2xl bg-white/10 border border-white/10 px-4 py-3 text-sm outline-none focus:border-[#00b4d8] min-h-[64px]"
              placeholder="Notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        )}

        {/* GPS status */}
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs flex items-start gap-2">
          <Navigation className="w-4 h-4 text-[#00b4d8] flex-shrink-0 mt-0.5" />
          <div>
            {geo ? (
              <span>
                GPS ready · {geo.lat.toFixed(5)}, {geo.lng.toFixed(5)}
                {geo.accuracy != null ? ` · ±${Math.round(geo.accuracy)}m` : ''}
              </span>
            ) : (
              <span className="text-amber-300">
                {geoError || 'Waiting for location permission…'}
              </span>
            )}
            {tracking && inTransit && (
              <div className="text-emerald-400 mt-1 font-semibold">Live tracking on</div>
            )}
            {transfer.last_location_at && (
              <div className="text-white/40 mt-1">
                Last ping {String(transfer.last_location_at).slice(0, 19)}
              </div>
            )}
          </div>
        </div>

        {message && (
          <div
            className={`rounded-2xl px-4 py-3 text-sm ${
              /fail|error|cannot|insufficient/i.test(message)
                ? 'bg-red-500/20 text-red-200 border border-red-500/30'
                : 'bg-emerald-500/20 text-emerald-100 border border-emerald-500/30'
            }`}
          >
            {message}
          </div>
        )}

        {done && (
          <div className="rounded-3xl bg-emerald-500/15 border border-emerald-400/30 p-6 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
            <div className="font-bold text-lg">Delivery complete</div>
            <p className="text-sm text-white/60 mt-1">
              Stock received at {transfer.to_warehouse_name}
              {transfer.received_at ? ` · ${String(transfer.received_at).slice(0, 19)}` : ''}
            </p>
          </div>
        )}

        {/* Recent events */}
        {(transfer.events || []).length > 0 && (
          <div className="rounded-3xl bg-white/5 border border-white/10 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10 text-sm font-semibold">
              Trail
            </div>
            <ul className="divide-y divide-white/5 max-h-48 overflow-y-auto">
              {(transfer.events || []).slice(0, 12).map((e) => (
                <li key={e.id} className="px-4 py-2.5 text-xs flex justify-between gap-2">
                  <div>
                    <span className="font-semibold capitalize">
                      {e.event_type.replace(/_/g, ' ')}
                    </span>
                    {e.actor_name ? ` · ${e.actor_name}` : ''}
                    {e.notes ? (
                      <div className="text-white/40 mt-0.5">{e.notes}</div>
                    ) : null}
                  </div>
                  <span className="text-white/30 whitespace-nowrap">
                    {String(e.created_at || '').slice(11, 19)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Sticky actions */}
      {!done && !cancelled && (
        <div className="fixed bottom-0 inset-x-0 bg-slate-950/95 backdrop-blur border-t border-white/10 p-4 safe-area-pb">
          <div className="max-w-lg mx-auto space-y-2">
            {isDraft && (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void act('identify')}
                  className="w-full py-3 rounded-2xl border border-white/20 text-sm font-semibold"
                >
                  Save driver details
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void act('pickup')}
                  className="w-full py-4 rounded-2xl bg-[#00b4d8] text-slate-950 font-bold text-base flex items-center justify-center gap-2"
                >
                  {busy ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <ScanLine className="w-5 h-5" /> Confirm pickup · leave warehouse
                    </>
                  )}
                </button>
                <p className="text-[11px] text-center text-white/40">
                  Deducts stock from source and starts GPS tracking
                </p>
              </>
            )}

            {inTransit && (
              <>
                {!tracking && (
                  <button
                    type="button"
                    onClick={() => setTracking(true)}
                    className="w-full py-3 rounded-2xl border border-emerald-400/40 text-emerald-300 text-sm font-semibold flex items-center justify-center gap-2"
                  >
                    <Truck className="w-4 h-4" /> Start live GPS tracking
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void act('deliver')}
                  className="w-full py-4 rounded-2xl bg-emerald-500 text-slate-950 font-bold text-base flex items-center justify-center gap-2"
                >
                  {busy ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <PackageCheck className="w-5 h-5" /> Confirm delivery · receive stock
                    </>
                  )}
                </button>
                <p className="text-[11px] text-center text-white/40">
                  Adds stock at destination and closes the transfer
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: 'bg-violet-500/20 text-violet-200',
    shipped: 'bg-sky-500/20 text-sky-200',
    in_transit: 'bg-sky-500/20 text-sky-200',
    partially_received: 'bg-amber-500/20 text-amber-200',
    received: 'bg-emerald-500/20 text-emerald-200',
    cancelled: 'bg-white/10 text-white/50',
  };
  return (
    <span
      className={`inline-flex text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full ${map[status] || 'bg-white/10'}`}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}
