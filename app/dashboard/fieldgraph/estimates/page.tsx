'use client';

import { useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  FieldgraphWorkbench,
  LoadingBlock,
  useFieldgraph,
} from '@/components/agri/FieldgraphWorkbench';

export default function FieldgraphEstimatesPage() {
  const year = String(new Date().getFullYear());
  const { store, loading, saving, post } = useFieldgraph();
  const [form, setForm] = useState({
    field_id: '',
    season: year,
    tonnes: '',
    quality_pct: '',
    status: 'draft',
  });

  const add = async () => {
    if (!form.field_id) {
      toast.error('Select a field');
      return;
    }
    await post({
      entity: 'estimates',
      action: 'upsert',
      record: {
        ...form,
        tonnes: Number(form.tonnes) || 0,
        quality_pct: form.quality_pct ? Number(form.quality_pct) : null,
      },
    });
    toast.success('Estimate saved');
  };

  return (
    <FieldgraphWorkbench
      title="Estimates"
      titleAccent="season"
      description="Field-level yield and quality estimates — revise through the season. Works for cane RV%, grain moisture, fruit packs, and more."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <div className="rounded-3xl border border-sky-100 bg-sky-50/40 p-4 grid sm:grid-cols-2 lg:grid-cols-5 gap-2">
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
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Season"
              value={form.season}
              onChange={(e) =>
                setForm((f) => ({ ...f, season: e.target.value }))
              }
            />
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Tonnes"
              type="number"
              value={form.tonnes}
              onChange={(e) =>
                setForm((f) => ({ ...f, tonnes: e.target.value }))
              }
            />
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Quality % (RV / moisture…)"
              type="number"
              value={form.quality_pct}
              onChange={(e) =>
                setForm((f) => ({ ...f, quality_pct: e.target.value }))
              }
            />
            <select
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={form.status}
              onChange={(e) =>
                setForm((f) => ({ ...f, status: e.target.value }))
              }
            >
              <option value="draft">Draft</option>
              <option value="submitted">Submitted</option>
              <option value="revised">Revised</option>
              <option value="final">Final</option>
            </select>
            <button
              type="button"
              disabled={saving}
              onClick={() => void add()}
              className="btn-primary !py-2 text-sm sm:col-span-2 lg:col-span-5 inline-flex items-center justify-center gap-1.5"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Save estimate
            </button>
          </div>

          <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-[10px] font-black uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-2.5">Field</th>
                  <th className="px-3 py-2.5">Season</th>
                  <th className="px-3 py-2.5">t</th>
                  <th className="px-3 py-2.5">t/ha</th>
                  <th className="px-3 py-2.5">Quality</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {store.estimates.map((e) => {
                  const field = store.fields.find((f) => f.id === e.field_id);
                  return (
                    <tr key={e.id} className="border-t border-slate-100">
                      <td className="px-3 py-2.5 font-semibold">
                        {field?.code || e.field_id}
                      </td>
                      <td className="px-3 py-2.5">{e.season}</td>
                      <td className="px-3 py-2.5 tabular-nums">{e.tonnes}</td>
                      <td className="px-3 py-2.5 tabular-nums">
                        {e.tonnes_per_ha ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">
                        {e.quality_pct != null ? `${e.quality_pct}%` : '—'}
                      </td>
                      <td className="px-3 py-2.5 capitalize">{e.status}</td>
                      <td className="px-3 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            void post({
                              entity: 'estimates',
                              action: 'delete',
                              id: e.id,
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
