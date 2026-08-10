'use client';

import { useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  FieldgraphWorkbench,
  LoadingBlock,
  useFieldgraph,
} from '@/components/agri/FieldgraphWorkbench';

export default function FieldgraphInputsPage() {
  const { store, loading, saving, post } = useFieldgraph();
  const [form, setForm] = useState({
    field_id: '',
    date: new Date().toISOString().slice(0, 10),
    product: '',
    category: 'fertiliser',
    quantity: '',
    unit: 'kg',
    n_kg_ha: '',
    p_kg_ha: '',
    k_kg_ha: '',
    cost_zar: '',
  });

  const add = async () => {
    if (!form.field_id || !form.product.trim()) {
      toast.error('Field and product required');
      return;
    }
    await post({
      entity: 'applications',
      action: 'upsert',
      record: {
        ...form,
        quantity: Number(form.quantity) || 0,
        n_kg_ha: form.n_kg_ha ? Number(form.n_kg_ha) : null,
        p_kg_ha: form.p_kg_ha ? Number(form.p_kg_ha) : null,
        k_kg_ha: form.k_kg_ha ? Number(form.k_kg_ha) : null,
        cost_zar: form.cost_zar ? Number(form.cost_zar) : null,
      },
    });
    toast.success('Application logged');
  };

  return (
    <FieldgraphWorkbench
      title="Inputs"
      titleAccent="& nutrients"
      description="Field applications with N-P-K / ha — fertiliser, chemicals, seed. Tracks cost and nutrient intensity for yield and regen decisions."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <div className="rounded-3xl border border-amber-300 bg-amber-50 dark:!border-amber-400 dark:!bg-amber-950 dark:ring-1 dark:ring-amber-500/50 p-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <select
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={form.field_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, field_id: e.target.value }))
              }
            >
              <option value="">Field…</option>
              {store.fields.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.code} · {f.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            />
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Product"
              value={form.product}
              onChange={(e) =>
                setForm((f) => ({ ...f, product: e.target.value }))
              }
            />
            <select
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={form.category}
              onChange={(e) =>
                setForm((f) => ({ ...f, category: e.target.value }))
              }
            >
              <option value="fertiliser">Fertiliser</option>
              <option value="chemical">Chemical</option>
              <option value="seed">Seed</option>
              <option value="other">Other</option>
            </select>
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Qty"
              type="number"
              value={form.quantity}
              onChange={(e) =>
                setForm((f) => ({ ...f, quantity: e.target.value }))
              }
            />
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Unit"
              value={form.unit}
              onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
            />
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="N kg/ha"
              type="number"
              value={form.n_kg_ha}
              onChange={(e) =>
                setForm((f) => ({ ...f, n_kg_ha: e.target.value }))
              }
            />
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="P kg/ha"
              type="number"
              value={form.p_kg_ha}
              onChange={(e) =>
                setForm((f) => ({ ...f, p_kg_ha: e.target.value }))
              }
            />
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="K kg/ha"
              type="number"
              value={form.k_kg_ha}
              onChange={(e) =>
                setForm((f) => ({ ...f, k_kg_ha: e.target.value }))
              }
            />
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Cost ZAR"
              type="number"
              value={form.cost_zar}
              onChange={(e) =>
                setForm((f) => ({ ...f, cost_zar: e.target.value }))
              }
            />
            <button
              type="button"
              disabled={saving}
              onClick={() => void add()}
              className="btn-primary !py-2 text-sm sm:col-span-2 inline-flex items-center justify-center gap-1.5"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Log application
            </button>
          </div>

          <div className="overflow-x-auto rounded-3xl border border-amber-200 bg-white dark:!border-amber-400 dark:!bg-amber-950 dark:ring-1 dark:ring-amber-500/40">
            <table className="w-full text-sm">
              <thead className="bg-amber-50 text-left text-[10px] font-black uppercase tracking-wider text-amber-900 dark:bg-amber-900/50 dark:text-amber-200">
                <tr>
                  <th className="px-3 py-2.5">Date</th>
                  <th className="px-3 py-2.5">Field</th>
                  <th className="px-3 py-2.5">Product</th>
                  <th className="px-3 py-2.5">N-P-K</th>
                  <th className="px-3 py-2.5">Cost</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {store.applications.map((a) => {
                  const field = store.fields.find((f) => f.id === a.field_id);
                  return (
                    <tr key={a.id} className="border-t border-slate-100">
                      <td className="px-3 py-2.5">{a.date}</td>
                      <td className="px-3 py-2.5 font-semibold">
                        {field?.code || a.field_id}
                      </td>
                      <td className="px-3 py-2.5">
                        {a.product}{' '}
                        <span className="text-[11px] text-slate-500">
                          {a.quantity} {a.unit}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-xs">
                        {a.n_kg_ha ?? '—'} / {a.p_kg_ha ?? '—'} /{' '}
                        {a.k_kg_ha ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">
                        {a.cost_zar != null ? `R${a.cost_zar}` : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            void post({
                              entity: 'applications',
                              action: 'delete',
                              id: a.id,
                            })
                          }
                          className="text-rose-600 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
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
    </FieldgraphWorkbench>
  );
}
