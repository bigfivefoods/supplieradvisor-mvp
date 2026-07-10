'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Network, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  BOM_STATUS_META,
  type BomStatus,
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

type Product = { id: number; name: string; sku?: string | null; product_type?: string | null };
type Bom = {
  id: number;
  bom_number: string;
  name: string;
  revision: string;
  status: BomStatus;
  product_id?: number | null;
  product_name?: string | null;
  product_sku?: string | null;
  line_count?: number;
  yield_pct?: number;
  scrap_pct?: number;
  lead_time_days?: number;
  notes?: string | null;
};
type BomLine = {
  id?: number;
  component_product_id: number;
  qty_per: number;
  uom?: string;
  scrap_pct?: number;
  line_no?: number;
  component_name?: string;
};

export default function BomsPage() {
  return (
    <CompanyRequired>
      <BomsInner />
    </CompanyRequired>
  );
}

function BomsInner() {
  const companyId = getSelectedCompanyId();
  const [boms, setBoms] = useState<Bom[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warning, setWarning] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: '',
    product_id: '',
    revision: 'A',
    status: 'draft' as BomStatus,
    yield_pct: '100',
    scrap_pct: '0',
    lead_time_days: '1',
    notes: '',
  });
  const [lines, setLines] = useState<BomLine[]>([]);

  const productMap = useMemo(
    () => Object.fromEntries(products.map((p) => [p.id, p])),
    [products]
  );

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [bRes, pRes] = await Promise.all([
        fetch(`/api/manufacturing/boms?companyId=${companyId}`),
        fetch(`/api/inventory/products?companyId=${companyId}`),
      ]);
      const bData = await bRes.json();
      const pData = await pRes.json();
      setBoms(bData.boms || []);
      setWarning(bData.warning);
      setProducts(pData.products || []);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const openNew = () => {
    setEditId(null);
    setForm({
      name: '',
      product_id: '',
      revision: 'A',
      status: 'draft',
      yield_pct: '100',
      scrap_pct: '0',
      lead_time_days: '1',
      notes: '',
    });
    setLines([]);
    setEditorOpen(true);
  };

  const openEdit = async (bom: Bom) => {
    if (!companyId) return;
    setEditId(bom.id);
    setForm({
      name: bom.name,
      product_id: bom.product_id ? String(bom.product_id) : '',
      revision: bom.revision || 'A',
      status: bom.status || 'draft',
      yield_pct: String(bom.yield_pct ?? 100),
      scrap_pct: String(bom.scrap_pct ?? 0),
      lead_time_days: String(bom.lead_time_days ?? 1),
      notes: bom.notes || '',
    });
    const res = await fetch(`/api/manufacturing/boms?companyId=${companyId}&id=${bom.id}`);
    const data = await res.json();
    setLines(
      (data.lines || []).map((l: BomLine & { component_product_id: number }) => ({
        ...l,
        component_name: productMap[l.component_product_id]?.name,
      }))
    );
    setEditorOpen(true);
  };

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      {
        component_product_id: products[0]?.id || 0,
        qty_per: 1,
        uom: 'ea',
        scrap_pct: 0,
        line_no: (prev.length + 1) * 10,
      },
    ]);
  };

  const save = async () => {
    if (!companyId || !form.name.trim()) {
      toast.error('Name required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        companyId,
        id: editId || undefined,
        name: form.name.trim(),
        product_id: form.product_id ? Number(form.product_id) : null,
        revision: form.revision,
        status: form.status,
        yield_pct: Number(form.yield_pct),
        scrap_pct: Number(form.scrap_pct),
        lead_time_days: Number(form.lead_time_days),
        notes: form.notes || null,
        lines: lines
          .filter((l) => l.component_product_id)
          .map((l, i) => ({
            component_product_id: Number(l.component_product_id),
            qty_per: Number(l.qty_per),
            uom: l.uom || 'ea',
            scrap_pct: Number(l.scrap_pct || 0),
            line_no: l.line_no ?? (i + 1) * 10,
          })),
      };
      const res = await fetch('/api/manufacturing/boms', {
        method: editId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      toast.success(editId ? 'BOM updated' : 'BOM created');
      setEditorOpen(false);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    if (!companyId || !confirm('Delete this BOM structure?')) return;
    const res = await fetch(`/api/manufacturing/boms?companyId=${companyId}&id=${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      toast.error('Delete failed');
      return;
    }
    toast.success('BOM deleted');
    void load();
  };

  const activate = async (bom: Bom) => {
    if (!companyId) return;
    const res = await fetch('/api/manufacturing/boms', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, id: bom.id, status: 'active' }),
    });
    if (!res.ok) {
      toast.error('Activate failed');
      return;
    }
    toast.success('BOM active — ready for MRP & work orders');
    void load();
  };

  const active = boms.filter((b) => b.status === 'active').length;

  return (
    <ManufacturingPage>
      <ManufacturingHeader
        title="Bills of"
        titleAccent="materials"
        description="Engineering truth for every finished good — components, scrap, yield, and revision control that MRP can trust."
        action={
          <button
            type="button"
            onClick={openNew}
            className="btn-primary !py-2.5 !px-5 text-sm inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> New BOM
          </button>
        }
      />

      <SchemaHint message={warning} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <TelemetryCard label="Structures" value={boms.length} accent="violet" />
        <TelemetryCard label="Active" value={active} accent="emerald" />
        <TelemetryCard
          label="Components"
          value={boms.reduce((s, b) => s + (b.line_count || 0), 0)}
          sub="total BOM lines"
          accent="cyan"
        />
        <TelemetryCard label="Catalogue SKUs" value={products.length} accent="slate" />
      </div>

      {loading ? (
        <div className="py-20 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : boms.length === 0 && !editorOpen ? (
        <EmptyMission
          title="No BOMs defined"
          body="Define the DNA of your products — raw materials, packaging, and sub-assemblies per finished good. Active BOMs power MRP explosion."
          action={
            <button type="button" onClick={openNew} className="btn-primary !py-2.5 !px-6 text-sm">
              <Plus className="w-4 h-4 inline mr-1" /> Create first BOM
            </button>
          }
        />
      ) : (
        <div className="rounded-3xl border border-neutral-200 bg-white overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 bg-slate-50/80 text-left text-[10px] font-black uppercase tracking-wider text-neutral-400">
                  <th className="px-4 py-3">BOM</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Rev</th>
                  <th className="px-4 py-3">Lines</th>
                  <th className="px-4 py-3">Yield</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {boms.map((b) => {
                  const meta = BOM_STATUS_META[b.status] || BOM_STATUS_META.draft;
                  return (
                    <tr
                      key={b.id}
                      className="border-b border-neutral-50 hover:bg-sky-50/40 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="font-mono text-xs font-bold text-[#0077b6]">
                          {b.bom_number}
                        </div>
                        <div className="font-semibold text-slate-800">{b.name}</div>
                      </td>
                      <td className="px-4 py-3 text-neutral-600">
                        {b.product_name || '—'}
                        {b.product_sku && (
                          <div className="text-[11px] font-mono text-neutral-400">{b.product_sku}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold">{b.revision}</td>
                      <td className="px-4 py-3 tabular-nums font-semibold">{b.line_count ?? 0}</td>
                      <td className="px-4 py-3 tabular-nums">{b.yield_pct ?? 100}%</td>
                      <td className="px-4 py-3">
                        <StatusPill label={meta.label} className={meta.tone} />
                      </td>
                      <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => void openEdit(b)}
                          className="text-xs font-bold text-[#00b4d8] hover:underline"
                        >
                          Edit
                        </button>
                        {b.status !== 'active' && (
                          <button
                            type="button"
                            onClick={() => void activate(b)}
                            className="text-xs font-bold text-emerald-600 hover:underline"
                          >
                            Activate
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void remove(b.id)}
                          className="text-neutral-400 hover:text-rose-600 inline-flex align-middle"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editorOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-neutral-200 bg-white shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between gap-3 border-b border-neutral-100 bg-white px-5 py-4">
              <div className="flex items-center gap-2">
                <Network className="w-5 h-5 text-[#00b4d8]" />
                <h3 className="font-black text-slate-800">
                  {editId ? 'Edit BOM' : 'New BOM structure'}
                </h3>
              </div>
              <button type="button" onClick={() => setEditorOpen(false)} className="p-1 text-neutral-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="block sm:col-span-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">
                    Name
                  </span>
                  <input
                    className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Premium Trail Mix FG"
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">
                    Parent product (finished good)
                  </span>
                  <select
                    className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
                    value={form.product_id}
                    onChange={(e) => setForm((f) => ({ ...f, product_id: e.target.value }))}
                  >
                    <option value="">Select product…</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.sku ? `(${p.sku})` : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">
                    Revision
                  </span>
                  <input
                    className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm font-mono"
                    value={form.revision}
                    onChange={(e) => setForm((f) => ({ ...f, revision: e.target.value }))}
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">
                    Status
                  </span>
                  <select
                    className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
                    value={form.status}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, status: e.target.value as BomStatus }))
                    }
                  >
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="obsolete">Obsolete</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">
                    Yield %
                  </span>
                  <input
                    type="number"
                    className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
                    value={form.yield_pct}
                    onChange={(e) => setForm((f) => ({ ...f, yield_pct: e.target.value }))}
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">
                    Lead time (days)
                  </span>
                  <input
                    type="number"
                    className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
                    value={form.lead_time_days}
                    onChange={(e) => setForm((f) => ({ ...f, lead_time_days: e.target.value }))}
                  />
                </label>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">
                    Component lines
                  </span>
                  <button
                    type="button"
                    onClick={addLine}
                    className="text-xs font-bold text-[#00b4d8] inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add line
                  </button>
                </div>
                {lines.length === 0 ? (
                  <p className="text-xs text-neutral-400 py-4 text-center border border-dashed border-neutral-200 rounded-2xl">
                    No components yet — add raw materials or sub-assemblies.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {lines.map((line, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-[1fr_80px_70px_36px] gap-2 items-center"
                      >
                        <select
                          className="rounded-xl border border-neutral-200 px-2 py-2 text-xs"
                          value={line.component_product_id || ''}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            setLines((prev) =>
                              prev.map((l, i) =>
                                i === idx ? { ...l, component_product_id: v } : l
                              )
                            );
                          }}
                        >
                          <option value="">Component…</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          step="any"
                          className="rounded-xl border border-neutral-200 px-2 py-2 text-xs tabular-nums"
                          value={line.qty_per}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            setLines((prev) =>
                              prev.map((l, i) => (i === idx ? { ...l, qty_per: v } : l))
                            );
                          }}
                          placeholder="Qty"
                        />
                        <input
                          className="rounded-xl border border-neutral-200 px-2 py-2 text-xs"
                          value={line.uom || 'ea'}
                          onChange={(e) => {
                            const v = e.target.value;
                            setLines((prev) =>
                              prev.map((l, i) => (i === idx ? { ...l, uom: v } : l))
                            );
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                          className="text-neutral-400 hover:text-rose-600 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditorOpen(false)}
                  className="btn-secondary !py-2.5 !px-5 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void save()}
                  className="btn-primary !py-2.5 !px-6 text-sm inline-flex items-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Save structure
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </ManufacturingPage>
  );
}
