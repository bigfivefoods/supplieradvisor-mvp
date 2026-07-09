'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Loader2,
  ArrowLeftRight,
  Plus,
  Truck,
  PackageCheck,
  XCircle,
  ChevronRight,
  ClipboardList,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  ownerTypeLabel,
  transferStatusClass,
  type ProductRecord,
  type StockTransferOrder,
  type WarehouseRecord,
} from '@/lib/inventory/types';
import { CompanyRequired, InventoryHeader } from '@/components/inventory/InventoryShell';

type LineDraft = {
  product_id: string;
  qty_requested: string;
  lot_number: string;
};

const emptyLine = (): LineDraft => ({ product_id: '', qty_requested: '1', lot_number: '' });

export default function StockTransfersPage() {
  return (
    <CompanyRequired>
      <TransfersInner />
    </CompanyRequired>
  );
}

function TransfersInner() {
  const companyId = getSelectedCompanyId()!;
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRecord[]>([]);
  const [transfers, setTransfers] = useState<StockTransferOrder[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [fromWh, setFromWh] = useState('');
  const [toWh, setToWh] = useState('');
  const [carrier, setCarrier] = useState('');
  const [tracking, setTracking] = useState('');
  const [notes, setNotes] = useState('');
  const [expectedShip, setExpectedShip] = useState('');
  const [expectedRecv, setExpectedRecv] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);
  const [saving, setSaving] = useState(false);

  // Expand / ship-receive detail
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [shipCarrier, setShipCarrier] = useState('');
  const [shipTracking, setShipTracking] = useState('');
  const [shipNotes, setShipNotes] = useState('');
  const [receiveNotes, setReceiveNotes] = useState('');
  const [receiveQtys, setReceiveQtys] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, w, t] = await Promise.all([
        fetch(`/api/inventory/products?companyId=${companyId}`).then((r) => r.json()),
        fetch(`/api/inventory/warehouses?companyId=${companyId}`).then((r) => r.json()),
        fetch(`/api/inventory/transfers?companyId=${companyId}`).then((r) => r.json()),
      ]);
      setProducts(p.products || []);
      setWarehouses(w.warehouses || []);
      setTransfers(t.transfers || []);
      if (t.warning) toast.message(t.warning, { description: t.hint });
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (filter === 'all') return transfers;
    if (filter === 'open') {
      return transfers.filter((t) =>
        ['draft', 'shipped', 'in_transit', 'partially_received'].includes(String(t.status))
      );
    }
    return transfers.filter((t) => t.status === filter);
  }, [transfers, filter]);

  const whLabel = (w: WarehouseRecord) => {
    const owner = ownerTypeLabel(w.owner_type).replace('My warehouse', 'Mine');
    const partner = w.partner_name && w.owner_type !== 'own' ? ` · ${w.partner_name}` : '';
    return `${w.name}${partner} (${owner})`;
  };

  const create = async () => {
    if (!fromWh || !toWh) {
      toast.error('Select from and to locations');
      return;
    }
    if (fromWh === toWh) {
      toast.error('Locations must differ');
      return;
    }
    const validLines = lines
      .filter((l) => l.product_id && Number(l.qty_requested) > 0)
      .map((l) => ({
        product_id: Number(l.product_id),
        qty_requested: Number(l.qty_requested),
        lot_number: l.lot_number || null,
      }));
    if (!validLines.length) {
      toast.error('Add at least one product line');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/inventory/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          action: 'create',
          fromWarehouseId: Number(fromWh),
          toWarehouseId: Number(toWh),
          carrier: carrier || undefined,
          tracking_ref: tracking || undefined,
          notes: notes || undefined,
          expected_ship_date: expectedShip || undefined,
          expected_receive_date: expectedRecv || undefined,
          lines: validLines,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.hint || 'Create failed');
      toast.success(`Draft ${data.transfer?.transfer_number || 'transfer'} created`);
      setShowCreate(false);
      setFromWh('');
      setToWh('');
      setCarrier('');
      setTracking('');
      setNotes('');
      setExpectedShip('');
      setExpectedRecv('');
      setLines([emptyLine()]);
      void load();
      if (data.transfer?.id) setExpandedId(data.transfer.id);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const act = async (
    id: number,
    action: 'ship' | 'receive' | 'cancel',
    extra?: Record<string, unknown>
  ) => {
    setBusyId(id);
    try {
      const res = await fetch('/api/inventory/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, id, action, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');
      toast.success(
        action === 'ship'
          ? 'Shipped — stock left source, now in transit'
          : action === 'receive'
            ? `Received · status ${data.transfer?.status}`
            : 'Transfer cancelled'
      );
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusyId(null);
    }
  };

  const ship = (t: StockTransferOrder) => {
    void act(t.id, 'ship', {
      carrier: shipCarrier || t.carrier,
      tracking_ref: shipTracking || t.tracking_ref,
      ship_notes: shipNotes || undefined,
    });
  };

  const receive = (t: StockTransferOrder) => {
    const linePayload = (t.lines || []).map((l) => {
      const id = l.id!;
      const remaining = Number(l.qty_shipped || l.qty_requested || 0) - Number(l.qty_received || 0);
      const qty =
        receiveQtys[id] != null && receiveQtys[id] !== ''
          ? Number(receiveQtys[id])
          : remaining;
      return { id, product_id: l.product_id, qty_received: qty };
    });
    void act(t.id, 'receive', {
      receive_notes: receiveNotes || undefined,
      lines: linePayload,
    });
  };

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = { all: transfers.length, open: 0 };
    for (const t of transfers) {
      c[t.status] = (c[t.status] || 0) + 1;
      if (['draft', 'shipped', 'in_transit', 'partially_received'].includes(String(t.status))) {
        c.open += 1;
      }
    }
    return c;
  }, [transfers]);

  return (
    <div className="px-2 md:px-4 max-w-screen-2xl mx-auto pb-12">
      <InventoryHeader
        title="Stock transfers"
        description="World-class inter-location process: draft → ship (leave source) → receive (arrive destination). Works across your, supplier, and customer sites."
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/inventory/warehouses"
              className="btn-secondary !py-2.5 !px-4 text-sm"
            >
              Locations
            </Link>
            <button
              type="button"
              onClick={() => setShowCreate((v) => !v)}
              className="btn-primary !py-2.5 !px-4 text-sm inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> New transfer
            </button>
          </div>
        }
      />

      {/* Process strip */}
      <div className="mb-6 grid grid-cols-3 gap-2 text-center">
        {[
          { n: '1', t: 'Draft', d: 'Pick products & locations' },
          { n: '2', t: 'Ship', d: 'Deduct source · in transit' },
          { n: '3', t: 'Receive', d: 'Add dest · close order' },
        ].map((s, i) => (
          <div
            key={s.n}
            className="rounded-2xl border border-neutral-200 bg-white px-3 py-3 relative"
          >
            <div className="text-[10px] font-bold text-[#00b4d8] mb-0.5">STEP {s.n}</div>
            <div className="font-bold text-sm">{s.t}</div>
            <div className="text-[11px] text-neutral-500">{s.d}</div>
            {i < 2 && (
              <ChevronRight className="hidden sm:block absolute -right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-300 z-10" />
            )}
          </div>
        ))}
      </div>

      {/* Create panel */}
      {showCreate && (
        <div className="bg-white border rounded-3xl p-5 mb-6 space-y-4">
          <h2 className="font-bold flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-[#00b4d8]" /> Create transfer order
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-neutral-500">From location *</label>
              <select
                className="input mt-1 w-full !p-3 !text-sm"
                value={fromWh}
                onChange={(e) => setFromWh(e.target.value)}
              >
                <option value="">Select source…</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {whLabel(w)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-500">To location *</label>
              <select
                className="input mt-1 w-full !p-3 !text-sm"
                value={toWh}
                onChange={(e) => setToWh(e.target.value)}
              >
                <option value="">Select destination…</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {whLabel(w)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <input
              className="input !p-3 !text-sm"
              placeholder="Carrier"
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
            />
            <input
              className="input !p-3 !text-sm font-mono"
              placeholder="Tracking ref"
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
            />
            <div>
              <label className="text-[10px] text-neutral-400">Expected ship</label>
              <input
                type="date"
                className="input w-full !p-2.5 !text-sm"
                value={expectedShip}
                onChange={(e) => setExpectedShip(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[10px] text-neutral-400">Expected receive</label>
              <input
                type="date"
                className="input w-full !p-2.5 !text-sm"
                value={expectedRecv}
                onChange={(e) => setExpectedRecv(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-medium text-neutral-500">Lines</div>
            {lines.map((l, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                <select
                  className="input !p-2.5 !text-sm col-span-6"
                  value={l.product_id}
                  onChange={(e) => {
                    const next = [...lines];
                    next[idx] = { ...l, product_id: e.target.value };
                    setLines(next);
                  }}
                >
                  <option value="">Product *</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.sku ? `(${p.sku})` : ''} · {p.product_type || ''}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  className="input !p-2.5 !text-sm col-span-2"
                  placeholder="Qty"
                  value={l.qty_requested}
                  onChange={(e) => {
                    const next = [...lines];
                    next[idx] = { ...l, qty_requested: e.target.value };
                    setLines(next);
                  }}
                />
                <input
                  className="input !p-2.5 !text-sm font-mono col-span-3"
                  placeholder="Lot"
                  value={l.lot_number}
                  onChange={(e) => {
                    const next = [...lines];
                    next[idx] = { ...l, lot_number: e.target.value };
                    setLines(next);
                  }}
                />
                <button
                  type="button"
                  className="col-span-1 text-neutral-400 hover:text-red-600 text-sm"
                  onClick={() => setLines(lines.filter((_, i) => i !== idx))}
                  disabled={lines.length === 1}
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              className="text-xs font-semibold text-[#00b4d8]"
              onClick={() => setLines([...lines, emptyLine()])}
            >
              + Add line
            </button>
          </div>

          <textarea
            className="input w-full !p-3 !text-sm min-h-[56px]"
            placeholder="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <div className="flex gap-2 justify-end">
            <button type="button" className="btn-secondary !py-2.5 !px-4" onClick={() => setShowCreate(false)}>
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void create()}
              className="btn-primary !py-2.5 !px-5"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create draft'}
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        {(
          [
            ['all', 'All'],
            ['open', 'Open'],
            ['draft', 'Draft'],
            ['in_transit', 'In transit'],
            ['partially_received', 'Partial'],
            ['received', 'Received'],
            ['cancelled', 'Cancelled'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${
              filter === k
                ? 'border-[#00b4d8] bg-[#00b4d8]/10 text-[#0077b6]'
                : 'border-neutral-200 text-neutral-600'
            }`}
          >
            {label}
            {statusCounts[k] != null ? ` (${statusCounts[k]})` : ''}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="bg-white border rounded-3xl overflow-hidden">
        {loading ? (
          <div className="p-16 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center text-neutral-500 text-sm">
            <ArrowLeftRight className="w-10 h-10 mx-auto mb-3 text-neutral-300" />
            <p className="mb-4">No transfer orders yet. Create a draft to move stock between locations.</p>
            <button type="button" onClick={() => setShowCreate(true)} className="btn-primary !py-2.5 !px-5 text-sm">
              New transfer
            </button>
          </div>
        ) : (
          <ul className="divide-y">
            {filtered.map((t) => {
              const open = expandedId === t.id;
              const lineCount = t.lines?.length || 0;
              const totalReq = (t.lines || []).reduce((s, l) => s + Number(l.qty_requested || 0), 0);
              return (
                <li key={t.id} className="text-sm">
                  <button
                    type="button"
                    className="w-full px-5 py-4 flex flex-wrap items-center justify-between gap-3 text-left hover:bg-neutral-50"
                    onClick={() => {
                      setExpandedId(open ? null : t.id);
                      setShipCarrier(t.carrier || '');
                      setShipTracking(t.tracking_ref || '');
                      setShipNotes('');
                      setReceiveNotes('');
                      const q: Record<number, string> = {};
                      for (const l of t.lines || []) {
                        if (l.id == null) continue;
                        const rem =
                          Number(l.qty_shipped || l.qty_requested || 0) - Number(l.qty_received || 0);
                        q[l.id] = String(Math.max(0, rem));
                      }
                      setReceiveQtys(q);
                    }}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold font-mono text-slate-900">
                          {t.transfer_number || `#${t.id}`}
                        </span>
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${transferStatusClass(t.status)}`}
                        >
                          {String(t.status).replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div className="text-xs text-neutral-500 mt-1">
                        {t.from_warehouse_name || t.from_warehouse_id} →{' '}
                        {t.to_warehouse_name || t.to_warehouse_id}
                        {' · '}
                        {lineCount} line{lineCount === 1 ? '' : 's'} · {totalReq} units req
                        {t.tracking_ref ? ` · track ${t.tracking_ref}` : ''}
                      </div>
                    </div>
                    <ChevronRight
                      className={`w-4 h-4 text-neutral-400 transition-transform ${open ? 'rotate-90' : ''}`}
                    />
                  </button>

                  {open && (
                    <div className="px-5 pb-5 bg-neutral-50/80 border-t space-y-4">
                      {/* Lines table */}
                      <div className="overflow-x-auto rounded-2xl border bg-white mt-3">
                        <table className="w-full text-xs">
                          <thead className="bg-neutral-50 text-left">
                            <tr>
                              <th className="px-3 py-2 font-semibold">Product</th>
                              <th className="px-3 py-2 font-semibold text-right">Req</th>
                              <th className="px-3 py-2 font-semibold text-right">Shipped</th>
                              <th className="px-3 py-2 font-semibold text-right">Received</th>
                              <th className="px-3 py-2 font-semibold">Lot</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {(t.lines || []).map((l) => (
                              <tr key={l.id || `${l.product_id}`}>
                                <td className="px-3 py-2">
                                  <div className="font-semibold">{l.product_name || `#${l.product_id}`}</div>
                                  <div className="text-neutral-400 font-mono">{l.sku || ''}</div>
                                </td>
                                <td className="px-3 py-2 text-right">{Number(l.qty_requested)}</td>
                                <td className="px-3 py-2 text-right">{Number(l.qty_shipped || 0)}</td>
                                <td className="px-3 py-2 text-right">{Number(l.qty_received || 0)}</td>
                                <td className="px-3 py-2 font-mono">{l.lot_number || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Actions by status */}
                      {t.status === 'draft' && (
                        <div className="rounded-2xl border border-sky-100 bg-sky-50/50 p-4 space-y-3">
                          <div className="font-semibold text-sky-900 flex items-center gap-2">
                            <Truck className="w-4 h-4" /> Ship transfer
                          </div>
                          <p className="text-xs text-sky-800/80">
                            Shipping deducts stock from the source location and marks the order in
                            transit. Destination stock updates only on receive.
                          </p>
                          <div className="grid sm:grid-cols-2 gap-2">
                            <input
                              className="input !p-2.5 !text-sm"
                              placeholder="Carrier"
                              value={shipCarrier}
                              onChange={(e) => setShipCarrier(e.target.value)}
                            />
                            <input
                              className="input !p-2.5 !text-sm font-mono"
                              placeholder="Tracking"
                              value={shipTracking}
                              onChange={(e) => setShipTracking(e.target.value)}
                            />
                          </div>
                          <input
                            className="input w-full !p-2.5 !text-sm"
                            placeholder="Ship notes"
                            value={shipNotes}
                            onChange={(e) => setShipNotes(e.target.value)}
                          />
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={busyId === t.id}
                              onClick={() => ship(t)}
                              className="btn-primary !py-2 !px-4 text-sm"
                            >
                              {busyId === t.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <Truck className="w-4 h-4" /> Confirm ship
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              disabled={busyId === t.id}
                              onClick={() => {
                                if (confirm('Cancel this draft?')) void act(t.id, 'cancel');
                              }}
                              className="btn-secondary !py-2 !px-4 text-sm text-red-700"
                            >
                              <XCircle className="w-4 h-4" /> Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      {['in_transit', 'shipped', 'partially_received'].includes(String(t.status)) && (
                        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 space-y-3">
                          <div className="font-semibold text-emerald-900 flex items-center gap-2">
                            <PackageCheck className="w-4 h-4" /> Receive transfer
                          </div>
                          <p className="text-xs text-emerald-800/80">
                            Confirm quantities received at destination. Partial receipts leave the
                            order open until fully received.
                          </p>
                          <div className="space-y-2">
                            {(t.lines || []).map((l) => {
                              if (l.id == null) return null;
                              const rem =
                                Number(l.qty_shipped || l.qty_requested || 0) -
                                Number(l.qty_received || 0);
                              return (
                                <div
                                  key={l.id}
                                  className="flex items-center justify-between gap-3 text-xs bg-white rounded-xl px-3 py-2 border"
                                >
                                  <span className="font-medium truncate">
                                    {l.product_name || `#${l.product_id}`}
                                    <span className="text-neutral-400 font-normal">
                                      {' '}
                                      · remaining {rem}
                                    </span>
                                  </span>
                                  <input
                                    type="number"
                                    className="input !p-2 !text-sm w-24 text-right"
                                    value={receiveQtys[l.id] ?? String(rem)}
                                    onChange={(e) =>
                                      setReceiveQtys({ ...receiveQtys, [l.id!]: e.target.value })
                                    }
                                  />
                                </div>
                              );
                            })}
                          </div>
                          <input
                            className="input w-full !p-2.5 !text-sm"
                            placeholder="Receive notes / variance reason"
                            value={receiveNotes}
                            onChange={(e) => setReceiveNotes(e.target.value)}
                          />
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={busyId === t.id}
                              onClick={() => receive(t)}
                              className="btn-primary !py-2 !px-4 text-sm"
                            >
                              {busyId === t.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <PackageCheck className="w-4 h-4" /> Confirm receive
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              disabled={busyId === t.id}
                              onClick={() => {
                                if (
                                  confirm(
                                    'Cancel transfer? Unreceived shipped qty will restock the source.'
                                  )
                                ) {
                                  void act(t.id, 'cancel');
                                }
                              }}
                              className="btn-secondary !py-2 !px-4 text-sm text-red-700"
                            >
                              <XCircle className="w-4 h-4" /> Cancel & restock
                            </button>
                          </div>
                        </div>
                      )}

                      {t.status === 'received' && (
                        <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
                          Fully received
                          {t.received_at ? ` · ${String(t.received_at).slice(0, 19)}` : ''}
                          {t.carrier ? ` · ${t.carrier}` : ''}
                          {t.tracking_ref ? ` · ${t.tracking_ref}` : ''}
                        </div>
                      )}

                      {t.status === 'cancelled' && (
                        <div className="text-xs text-neutral-600 bg-neutral-100 rounded-xl px-3 py-2">
                          Cancelled
                          {t.cancelled_at ? ` · ${String(t.cancelled_at).slice(0, 19)}` : ''}
                        </div>
                      )}

                      {t.onchain_hash && (
                        <div className="text-[10px] font-mono text-neutral-400 break-all">
                          hash {t.onchain_hash}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
