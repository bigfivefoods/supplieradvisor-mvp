'use client';

import { useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  FieldgraphWorkbench,
  LoadingBlock,
  useFieldgraph,
} from '@/components/agri/FieldgraphWorkbench';
import { CROP_TYPES } from '@/lib/agri/fieldgraph';

export default function FieldgraphFieldsPage() {
  const { store, loading, saving, post } = useFieldgraph();
  const [form, setForm] = useState({
    code: '',
    name: '',
    farm_name: '',
    crop: 'Sugar cane',
    variety: '',
    hectares: '',
    irrigation: 'unknown',
    soil_type: '',
  });

  const add = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      toast.error('Code and name required');
      return;
    }
    await post({
      entity: 'fields',
      action: 'upsert',
      record: {
        ...form,
        hectares: Number(form.hectares) || 0,
      },
    });
    toast.success('Field saved');
    setForm({
      code: '',
      name: '',
      farm_name: '',
      crop: form.crop,
      variety: '',
      hectares: '',
      irrigation: 'unknown',
      soil_type: '',
    });
  };

  const remove = async (id: string) => {
    await post({ entity: 'fields', action: 'delete', id });
    toast.success('Field removed');
  };

  return (
    <FieldgraphWorkbench
      title="Fields"
      titleAccent="book"
      description="Multi-crop field registry — shared across estimates, harvest, inputs, fleet, labour and regen. Not locked to sugarcane."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <div className="rounded-3xl border border-emerald-100 bg-emerald-50/40 p-4 sm:p-5">
            <h3 className="text-sm font-black text-slate-900 mb-3">Add field</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
              <input
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Code (A12)"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              />
              <input
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
              <input
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Farm / estate"
                value={form.farm_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, farm_name: e.target.value }))
                }
              />
              <select
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={form.crop}
                onChange={(e) => setForm((f) => ({ ...f, crop: e.target.value }))}
              >
                {CROP_TYPES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <input
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Variety"
                value={form.variety}
                onChange={(e) =>
                  setForm((f) => ({ ...f, variety: e.target.value }))
                }
              />
              <input
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Hectares"
                type="number"
                value={form.hectares}
                onChange={(e) =>
                  setForm((f) => ({ ...f, hectares: e.target.value }))
                }
              />
              <select
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={form.irrigation}
                onChange={(e) =>
                  setForm((f) => ({ ...f, irrigation: e.target.value }))
                }
              >
                <option value="unknown">Irrigation…</option>
                <option value="dryland">Dryland</option>
                <option value="irrigated">Irrigated</option>
                <option value="partial">Partial</option>
              </select>
              <input
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Soil type"
                value={form.soil_type}
                onChange={(e) =>
                  setForm((f) => ({ ...f, soil_type: e.target.value }))
                }
              />
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={() => void add()}
              className="btn-primary !py-2 !px-4 text-sm mt-3 inline-flex items-center gap-1.5"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Save field
            </button>
          </div>

          <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-[10px] font-black uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-2.5">Code</th>
                  <th className="px-3 py-2.5">Name</th>
                  <th className="px-3 py-2.5">Crop</th>
                  <th className="px-3 py-2.5">Ha</th>
                  <th className="px-3 py-2.5">Irrigation</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {store.fields.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-8 text-center text-slate-500"
                    >
                      No fields yet — add one or load the demo estate from the hub.
                    </td>
                  </tr>
                ) : (
                  store.fields.map((f) => (
                    <tr key={f.id} className="border-t border-slate-100">
                      <td className="px-3 py-2.5 font-mono text-xs font-bold">
                        {f.code}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="font-semibold text-slate-900">
                          {f.name}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {f.farm_name || '—'}
                          {f.variety ? ` · ${f.variety}` : ''}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">{f.crop}</td>
                      <td className="px-3 py-2.5 tabular-nums">{f.hectares}</td>
                      <td className="px-3 py-2.5 capitalize">
                        {f.irrigation || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => void remove(f.id)}
                          className="text-rose-600 hover:text-rose-800 p-1"
                          aria-label="Delete field"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </FieldgraphWorkbench>
  );
}
