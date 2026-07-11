'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Loader2,
  ArrowLeftRight,
  Plus,
  Truck,
  PackageCheck,
  XCircle,
  ChevronRight,
  ClipboardList,
  Container,
  QrCode,
  Copy,
  Smartphone,
  MapPin,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import type { ContainerRecord } from '@/lib/containers/types';
import {
  ownerTypeLabel,
  transferDriverUrl,
  transferQrImageUrl,
  transferStatusClass,
  type ProductRecord,
  type StockTransferOrder,
  type WarehouseRecord,
} from '@/lib/inventory/types';
import { CompanyRequired, InventoryHeader } from '@/components/inventory/InventoryShell';
import { useCompanyRole } from '@/lib/business/useCompanyRole';
import { RoleDeniedBanner } from '@/components/chrome/RoleGuard';

type LineDraft = {
  product_id: string;
  qty_requested: string;
  lot_number: string;
};

const emptyLine = (): LineDraft => ({ product_id: '', qty_requested: '1', lot_number: '' });

export default function StockTransfersPage() {
  return (
    <CompanyRequired>
      <Suspense
        fallback={
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
          </div>
        }
      >
        <TransfersInner />
      </Suspense>
    </CompanyRequired>
  );
}

function TransfersInner() {
  const companyId = getSelectedCompanyId()!;
  const searchParams = useSearchParams();
  const { canOpsWrite, canQaOverride, roleLabel } = useCompanyRole();
  const [overrideQaHold, setOverrideQaHold] = useState(false);
  const [mainTab, setMainTab] = useState<'locations' | 'container'>(
    searchParams.get('tab') === 'container' ? 'container' : 'locations'
  );
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRecord[]>([]);
  const [transfers, setTransfers] = useState<StockTransferOrder[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  // Container sync (was /sync)
  const [containers, setContainers] = useState<ContainerRecord[]>([]);
  const [ctrTransfers, setCtrTransfers] = useState<Array<Record<string, unknown>>>([]);
  const [direction, setDirection] = useState<'warehouse_to_container' | 'container_to_warehouse'>(
    'warehouse_to_container'
  );
  const [containerId, setContainerId] = useState('');
  const [ctrProductId, setCtrProductId] = useState('');
  const [ctrQty, setCtrQty] = useState('1');
  const [ctrLot, setCtrLot] = useState('');
  const [ctrSaving, setCtrSaving] = useState(false);

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
      const [p, w, t, c, st] = await Promise.all([
        fetch(`/api/inventory/products?companyId=${companyId}`).then((r) => r.json()),
        fetch(`/api/inventory/warehouses?companyId=${companyId}`).then((r) => r.json()),
        fetch(`/api/inventory/transfers?companyId=${companyId}`).then((r) => r.json()),
        fetch(`/api/containers?companyId=${companyId}`).then((r) => r.json()),
        fetch(`/api/inventory/sync-transfer?companyId=${companyId}`).then((r) => r.json()),
      ]);
      setProducts(p.products || []);
      setWarehouses(w.warehouses || []);
      setTransfers(t.transfers || []);
      setContainers(c.containers || []);
      setCtrTransfers(st.transfers || []);
      if (t.warning) toast.message(t.warning, { description: t.hint });
      if (st.warning) toast.message(st.warning, { description: st.hint });
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (searchParams.get('tab') === 'container') setMainTab('container');
    else if (searchParams.get('tab') === 'locations') setMainTab('locations');
  }, [searchParams]);

  const submitContainerSync = async () => {
    if (!containerId || !ctrProductId) {
      toast.error('Container and product required');
      return;
    }
    setCtrSaving(true);
    try {
      const res = await fetch('/api/inventory/sync-transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          direction,
          containerId: Number(containerId),
          productId: Number(ctrProductId),
          quantity: Number(ctrQty),
          lot_number: ctrLot || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync failed');
      toast.success(`Container sync complete · ${String(data.onchain_hash || '').slice(0, 12)}…`);
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setCtrSaving(false);
    }
  };

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
      overrideQaHold: canQaOverride && overrideQaHold ? true : undefined,
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
        title="Transfers"
        description="Location transfers: draft → driver QR pickup → GPS in transit → deliver/receive. Container tab for warehouse ↔ outlet sync."
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/inventory/tracking"
              className="btn-secondary !py-2.5 !px-4 text-sm inline-flex items-center gap-1.5"
            >
              <MapPin className="w-4 h-4" /> Live tracking
            </Link>
            {mainTab === 'locations' && (
              <>
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
              </>
            )}
          </div>
        }
      />

      <div className="flex rounded-2xl border bg-white p-1 gap-1 mb-6 w-fit">
        <button
          type="button"
          onClick={() => setMainTab('locations')}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold ${
            mainTab === 'locations' ? 'bg-[#00b4d8] text-white' : 'text-neutral-600'
          }`}
        >
          <ArrowLeftRight className="w-3.5 h-3.5" /> Location transfers
        </button>
        <button
          type="button"
          onClick={() => setMainTab('container')}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold ${
            mainTab === 'container' ? 'bg-[#00b4d8] text-white' : 'text-neutral-600'
          }`}
        >
          <Container className="w-3.5 h-3.5" /> Warehouse ↔ container
        </button>
      </div>

      {mainTab === 'container' && (
        <div className="space-y-6">
          <div className="bg-white border rounded-3xl p-6 space-y-4 max-w-xl">
            <h2 className="font-bold text-sm">Container outlet sync</h2>
            <p className="text-xs text-neutral-500">
              Move stock between central warehouse balances and retail containers. Same ledger —
              formerly a separate “Warehouse ↔ container” page.
            </p>
            <div className="flex gap-2">
              {(
                [
                  ['warehouse_to_container', 'Warehouse → Container'],
                  ['container_to_warehouse', 'Container → Warehouse'],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setDirection(v)}
                  className={`flex-1 py-2.5 rounded-2xl text-sm font-semibold border ${
                    direction === v
                      ? 'border-[#00b4d8] bg-[#00b4d8]/10 text-[#0077b6]'
                      : 'border-neutral-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <select
              className="input w-full !p-3 !text-sm"
              value={containerId}
              onChange={(e) => setContainerId(e.target.value)}
            >
              <option value="">Container *</option>
              {containers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.container_code})
                </option>
              ))}
            </select>
            <select
              className="input w-full !p-3 !text-sm"
              value={ctrProductId}
              onChange={(e) => setCtrProductId(e.target.value)}
            >
              <option value="">Product *</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.sku ? `(${p.sku})` : ''}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                className="input !p-3 !text-sm"
                placeholder="Qty"
                value={ctrQty}
                onChange={(e) => setCtrQty(e.target.value)}
              />
              <input
                className="input !p-3 !text-sm font-mono"
                placeholder="Lot (optional)"
                value={ctrLot}
                onChange={(e) => setCtrLot(e.target.value)}
              />
            </div>
            <button
              type="button"
              disabled={ctrSaving}
              onClick={() => void submitContainerSync()}
              className="btn-primary w-full !py-3"
            >
              {ctrSaving ? (
                <Loader2 className="w-4 h-4 animate-spin mx-auto" />
              ) : (
                <>
                  <ArrowLeftRight className="w-4 h-4" /> Execute sync
                </>
              )}
            </button>
          </div>
          <div className="bg-white border rounded-3xl overflow-hidden">
            <div className="px-5 py-3 border-b font-semibold text-sm">Container sync history</div>
            {loading ? (
              <div className="p-10 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-[#00b4d8]" />
              </div>
            ) : ctrTransfers.length === 0 ? (
              <div className="p-10 text-center text-neutral-500 text-sm">No container transfers yet</div>
            ) : (
              <ul className="divide-y">
                {ctrTransfers.map((t) => (
                  <li key={String(t.id)} className="px-5 py-3 text-sm flex justify-between gap-3">
                    <div>
                      <div className="font-semibold">
                        {String(t.product_name || t.product_id)} × {String(t.quantity)}
                      </div>
                      <div className="text-xs text-neutral-500">
                        {String(t.from_type)} {String(t.from_id ?? '—')} → {String(t.to_type)}{' '}
                        {String(t.to_id ?? '—')}
                      </div>
                    </div>
                    <span className="text-xs capitalize text-neutral-500">{String(t.status)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {mainTab === 'locations' && (
        <>
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
                      {/* Driver QR / cellphone handoff */}
                      <DriverHandoffPanel transfer={t} />

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
                          {canQaOverride ? (
                            <label className="flex items-start gap-2 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                              <input
                                type="checkbox"
                                className="mt-0.5"
                                checked={overrideQaHold}
                                onChange={(e) => setOverrideQaHold(e.target.checked)}
                              />
                              <span>
                                <strong>Override QA hold</strong> (owner/admin only) — ships even if
                                lots have open/failed inspections. Always audited.
                              </span>
                            </label>
                          ) : (
                            <p className="text-[11px] text-neutral-500">
                              Lots on QA hold cannot ship. Clear Quality → Inspections first.
                              Override is limited to owners/admins.
                            </p>
                          )}
                          {!canOpsWrite && (
                            <RoleDeniedBanner
                              message={`Your role (${roleLabel || 'viewer'}) cannot ship transfers. Ask an operations member or admin.`}
                            />
                          )}
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={busyId === t.id || !canOpsWrite}
                              onClick={() => ship(t)}
                              className="btn-primary !py-2 !px-4 text-sm disabled:opacity-50"
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
        </>
      )}
    </div>
  );
}

function DriverHandoffPanel({ transfer }: { transfer: StockTransferOrder }) {
  const url =
    transfer.driver_url ||
    transferDriverUrl(transfer.public_token) ||
    (transfer.public_token
      ? `${typeof window !== 'undefined' ? window.location.origin : ''}/t/${transfer.public_token}`
      : null);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied');
    } catch {
      toast.error('Could not copy');
    }
  };

  if (!url && !transfer.public_token) {
    return (
      <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
        Driver QR not available yet. Run migration{' '}
        <code className="font-mono">20260709_transfer_driver_tracking.sql</code> then create a new
        transfer.
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-2xl border border-sky-100 bg-sky-50/60 p-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start">
        {url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={transferQrImageUrl(url, 160)}
            alt="Driver transfer QR"
            className="w-36 h-36 rounded-2xl bg-white border shadow-sm"
          />
        )}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="font-semibold text-sky-950 flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-[#00b4d8]" /> Driver cellphone handoff
          </div>
          <p className="text-xs text-sky-900/80 leading-relaxed">
            Print or WhatsApp this QR / link. Driver scans on phone → confirms{' '}
            <strong>pickup</strong> (stock leaves source) → GPS tracks en route → confirms{' '}
            <strong>delivery</strong> (stock received at destination).
          </p>
          {url && (
            <div className="flex flex-wrap gap-2 items-center">
              <code className="text-[11px] font-mono bg-white border rounded-lg px-2 py-1.5 break-all max-w-full">
                {url}
              </code>
              <button
                type="button"
                onClick={() => void copy(url)}
                className="btn-secondary !py-1.5 !px-3 text-xs inline-flex items-center gap-1"
              >
                <Copy className="w-3.5 h-3.5" /> Copy link
              </button>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="btn-primary !py-1.5 !px-3 text-xs inline-flex items-center gap-1"
              >
                <QrCode className="w-3.5 h-3.5" /> Open
              </a>
            </div>
          )}
          <div className="flex flex-wrap gap-3 text-[11px] text-sky-900/70">
            {transfer.driver_name && (
              <span>
                Driver: <strong>{transfer.driver_name}</strong>
                {transfer.driver_phone ? ` · ${transfer.driver_phone}` : ''}
              </span>
            )}
            {transfer.pickup_scanned_at && (
              <span className="inline-flex items-center gap-1">
                <Truck className="w-3 h-3" /> Pickup{' '}
                {String(transfer.pickup_scanned_at).slice(0, 19)}
              </span>
            )}
            {transfer.dropoff_scanned_at && (
              <span className="inline-flex items-center gap-1">
                <PackageCheck className="w-3 h-3" /> Dropoff{' '}
                {String(transfer.dropoff_scanned_at).slice(0, 19)}
              </span>
            )}
            {transfer.last_lat != null && transfer.last_lng != null && (
              <a
                href={`https://www.google.com/maps?q=${transfer.last_lat},${transfer.last_lng}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-[#0077b6]"
              >
                <MapPin className="w-3 h-3" /> Live map
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
