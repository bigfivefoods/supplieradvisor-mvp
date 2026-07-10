'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Factory,
  Loader2,
  Pause,
  Play,
  Plus,
  Rocket,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  PO_STATUS_META,
  completionPct,
  type ProductionOrderStatus,
} from '@/lib/manufacturing/types';
import {
  CompanyRequired,
  EmptyMission,
  ManufacturingHeader,
  ManufacturingPage,
  SchemaHint,
  StatusPill,
  TelemetryCard,
} from '@/components/manufacturing/ManufacturingShell';

type Product = { id: number; name: string; sku?: string | null };
type WorkCenter = { id: number; code: string; name: string };
type Order = {
  id: number;
  order_number: string;
  product_id?: number | null;
  product_name?: string | null;
  product_sku?: string | null;
  bom_id?: number | null;
  bom_number?: string | null;
  work_center_id?: number | null;
  work_center_code?: string | null;
  work_center_name?: string | null;
  qty_planned: number;
  qty_completed: number;
  qty_scrapped: number;
  status: ProductionOrderStatus;
  priority: number;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  notes?: string | null;
};

const FILTERS: { id: string; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'planned', label: 'Planned' },
  { id: 'released', label: 'Released' },
  { id: 'in_progress', label: 'In flight' },
  { id: 'hold', label: 'Hold' },
  { id: 'complete', label: 'Complete' },
];

export default function ProductionOrdersPage() {
  return (
    <CompanyRequired>
      <OrdersInner />
    </CompanyRequired>
  );
}

function OrdersInner() {
  const companyId = getSelectedCompanyId();
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [workCenters, setWorkCenters] = useState<WorkCenter[]>([]);
  const [filter, setFilter] = useState('all');
  const [warning, setWarning] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    product_id: '',
    work_center_id: '',
    qty_planned: '100',
    priority: '50',
    scheduled_start: '',
    notes: '',
  });

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [oRes, pRes, wRes] = await Promise.all([
        fetch(
          `/api/manufacturing/production-orders?companyId=${companyId}${
            filter !== 'all' ? `&status=${filter}` : ''
          }`
        ),
        fetch(`/api/inventory/products?companyId=${companyId}`),
        fetch(`/api/manufacturing/work-centers?companyId=${companyId}`),
      ]);
      const oData = await oRes.json();
      const pData = await pRes.json();
      const wData = await wRes.json();
      setOrders(oData.orders || []);
      setWarning(oData.warning);
      setProducts(pData.products || []);
      setWorkCenters(wData.workCenters || []);
    } finally {
      setLoading(false);
    }
  }, [companyId, filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const all = orders;
    return {
      total: all.length,
      inFlight: all.filter((o) => o.status === 'in_progress').length,
      hold: all.filter((o) => o.status === 'hold').length,
      done: all.filter((o) => o.status === 'complete').length,
    };
  }, [orders]);

  const create = async () => {
    if (!companyId || !form.product_id) {
      toast.error('Select a product');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/manufacturing/production-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          product_id: Number(form.product_id),
          work_center_id: form.work_center_id ? Number(form.work_center_id) : null,
          qty_planned: Number(form.qty_planned),
          priority: Number(form.priority),
          scheduled_start: form.scheduled_start || null,
          notes: form.notes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Create failed');
      toast.success(`Work order ${data.order?.order_number} created`);
      setShowForm(false);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const act = async (id: number, action: string, extra?: Record<string, unknown>) => {
    if (!companyId) return;
    const res = await fetch('/api/manufacturing/production-orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, id, action, ...extra }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || 'Update failed');
      return;
    }
    toast.success(`Order ${action}`);
    void load();
  };

  const reportProgress = async (order: Order) => {
    const raw = prompt(
      `Qty completed (planned ${order.qty_planned})`,
      String(order.qty_completed || order.qty_planned)
    );
    if (raw == null) return;
    const qty = Number(raw);
    if (!Number.isFinite(qty) || qty < 0) {
      toast.error('Invalid qty');
      return;
    }
    if (!companyId) return;
    const res = await fetch('/api/manufacturing/production-orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId,
        id: order.id,
        qty_completed: qty,
        status: qty >= Number(order.qty_planned) ? 'complete' : 'in_progress',
        actual_end: qty >= Number(order.qty_planned) ? new Date().toISOString() : undefined,
      }),
    });
    if (!res.ok) {
      toast.error('Update failed');
      return;
    }
    toast.success('Progress logged');
    void load();
  };

  return (
    <ManufacturingPage>
      <ManufacturingHeader
        title="Work"
        titleAccent="orders"
        description="Shop-floor execution — plan, release, run, hold, complete. Priority-ranked with live completion telemetry."
        action={
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="btn-primary !py-2.5 !px-5 text-sm inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> New work order
          </button>
        }
      />

      <SchemaHint message={warning} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <TelemetryCard label="Orders" value={stats.total} accent="slate" />
        <TelemetryCard label="In flight" value={stats.inFlight} accent="emerald" />
        <TelemetryCard label="On hold" value={stats.hold} accent="amber" />
        <TelemetryCard label="Complete" value={stats.done} accent="cyan" />
      </div>

      <div className="flex flex-wrap gap-1.5 mb-5">
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

      {loading ? (
        <div className="py-20 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : orders.length === 0 ? (
        <EmptyMission
          title="No work orders"
          body="Create production orders from demand or firm MPS buckets. Assign a cell, release, and drive them to complete with live progress."
          action={
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="btn-primary !py-2.5 !px-6 text-sm"
            >
              <Plus className="w-4 h-4 inline mr-1" /> Launch first order
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {orders.map((o) => {
            const meta = PO_STATUS_META[o.status] || PO_STATUS_META.planned;
            const pct = completionPct(Number(o.qty_planned), Number(o.qty_completed));
            return (
              <div
                key={o.id}
                className="rounded-3xl border border-neutral-200 bg-white p-4 sm:p-5 shadow-sm hover:border-[#00b4d8]/25 transition-colors"
              >
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-50 to-sky-100 border border-cyan-100 text-[#0077b6] flex items-center justify-center shrink-0">
                      <Factory className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-0.5">
                        <span className="font-mono text-sm font-black text-[#0077b6]">
                          {o.order_number}
                        </span>
                        <StatusPill label={meta.label} className={meta.tone} pulse={meta.pulse} />
                        <span className="text-[10px] font-bold text-neutral-400 uppercase">
                          P{o.priority}
                        </span>
                      </div>
                      <div className="font-bold text-slate-800 truncate">
                        {o.product_name || `Product #${o.product_id}`}
                      </div>
                      <div className="text-xs text-neutral-500 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                        {o.bom_number && <span className="font-mono">BOM {o.bom_number}</span>}
                        {o.work_center_code && (
                          <span className="font-mono">CELL {o.work_center_code}</span>
                        )}
                        {o.scheduled_start && (
                          <span>
                            Start {new Date(o.scheduled_start).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="w-full lg:w-48 shrink-0">
                    <div className="flex justify-between text-[11px] font-semibold text-neutral-500 mb-1">
                      <span>
                        {o.qty_completed}/{o.qty_planned}
                      </span>
                      <span className="tabular-nums">{pct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-neutral-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#00b4d8] to-emerald-400 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {Number(o.qty_scrapped) > 0 && (
                      <div className="text-[10px] text-rose-600 mt-1 font-semibold">
                        Scrap {o.qty_scrapped}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5 shrink-0">
                    {o.status === 'planned' && (
                      <button
                        type="button"
                        onClick={() => void act(o.id, 'release')}
                        className="inline-flex items-center gap-1 rounded-xl border border-sky-200 bg-sky-50 px-3 py-1.5 text-[11px] font-bold text-sky-800 hover:bg-sky-100"
                      >
                        <Rocket className="w-3.5 h-3.5" /> Release
                      </button>
                    )}
                    {(o.status === 'released' || o.status === 'hold') && (
                      <button
                        type="button"
                        onClick={() => void act(o.id, 'start')}
                        className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100"
                      >
                        <Play className="w-3.5 h-3.5" /> Start
                      </button>
                    )}
                    {o.status === 'in_progress' && (
                      <>
                        <button
                          type="button"
                          onClick={() => void reportProgress(o)}
                          className="inline-flex items-center gap-1 rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-[11px] font-bold text-cyan-900 hover:bg-cyan-100"
                        >
                          Progress
                        </button>
                        <button
                          type="button"
                          onClick={() => void act(o.id, 'hold')}
                          className="inline-flex items-center gap-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-bold text-amber-900 hover:bg-amber-100"
                        >
                          <Pause className="w-3.5 h-3.5" /> Hold
                        </button>
                        <button
                          type="button"
                          onClick={() => void act(o.id, 'complete')}
                          className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Complete
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
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl border border-neutral-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
              <h3 className="font-black text-slate-800">New work order</h3>
              <button type="button" onClick={() => setShowForm(false)}>
                <X className="w-5 h-5 text-neutral-400" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">
                  Product
                </span>
                <select
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
                  value={form.product_id}
                  onChange={(e) => setForm((f) => ({ ...f, product_id: e.target.value }))}
                >
                  <option value="">Select…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.sku ? `(${p.sku})` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">
                  Work cell
                </span>
                <select
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
                  value={form.work_center_id}
                  onChange={(e) => setForm((f) => ({ ...f, work_center_id: e.target.value }))}
                >
                  <option value="">Unassigned</option>
                  {workCenters.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.code} — {w.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">
                    Qty planned
                  </span>
                  <input
                    type="number"
                    className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
                    value={form.qty_planned}
                    onChange={(e) => setForm((f) => ({ ...f, qty_planned: e.target.value }))}
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">
                    Priority (1=highest)
                  </span>
                  <input
                    type="number"
                    className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
                    value={form.priority}
                    onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">
                  Scheduled start
                </span>
                <input
                  type="datetime-local"
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
                  value={form.scheduled_start}
                  onChange={(e) => setForm((f) => ({ ...f, scheduled_start: e.target.value }))}
                />
              </label>
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
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
                  Create order
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </ManufacturingPage>
  );
}
