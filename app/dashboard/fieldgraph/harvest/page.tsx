'use client';

import { useState } from 'react';
import { CalendarRange, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  FieldgraphWorkbench,
  LoadingBlock,
  useFieldgraph,
} from '@/components/agri/FieldgraphWorkbench';

export default function FieldgraphHarvestPage() {
  const year = String(new Date().getFullYear());
  const { store, loading, saving, post } = useFieldgraph();
  const [form, setForm] = useState({
    field_id: '',
    season: year,
    sequence: '1',
    destination: '',
  });
  const [project, setProject] = useState({
    season: year,
    startDate: new Date().toISOString().slice(0, 10),
    dailyAllocationT: '120',
  });

  const add = async () => {
    if (!form.field_id) {
      toast.error('Select a field');
      return;
    }
    await post({
      entity: 'harvest_plan',
      action: 'upsert',
      record: {
        ...form,
        sequence: Number(form.sequence) || 1,
      },
    });
    toast.success('Harvest plan row saved');
  };

  const projectDates = async () => {
    await post({
      action: 'project_harvest',
      season: project.season,
      startDate: project.startDate,
      dailyAllocationT: Number(project.dailyAllocationT) || 120,
    });
    toast.success('Projected cut dates from estimates & sequence');
  };

  return (
    <FieldgraphWorkbench
      title="Harvest"
      titleAccent="plan"
      description="Cutting sequence + daily allocation → projected field cut dates. Destinations can be mills, silos, or network buyers — not trapped in a single mill workflow."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="rounded-3xl border border-amber-100 bg-amber-50/40 p-4 space-y-2">
              <h3 className="text-sm font-black">Add to sequence</h3>
              <select
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
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
              <div className="grid grid-cols-2 gap-2">
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
                  placeholder="Sequence #"
                  type="number"
                  value={form.sequence}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, sequence: e.target.value }))
                  }
                />
              </div>
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Destination (mill / silo / buyer)"
                value={form.destination}
                onChange={(e) =>
                  setForm((f) => ({ ...f, destination: e.target.value }))
                }
              />
              <button
                type="button"
                disabled={saving}
                onClick={() => void add()}
                className="btn-primary !py-2 text-sm w-full inline-flex justify-center gap-1.5"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Add field
              </button>
            </div>

            <div className="rounded-3xl border border-emerald-100 bg-emerald-50/40 p-4 space-y-2">
              <h3 className="text-sm font-black inline-flex items-center gap-1.5">
                <CalendarRange className="w-4 h-4" /> Project cut dates
              </h3>
              <p className="text-[11px] text-slate-600">
                Uses sequence order, field estimates (tonnes), and daily
                allocation to compute expected cut dates.
              </p>
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                type="date"
                value={project.startDate}
                onChange={(e) =>
                  setProject((p) => ({ ...p, startDate: e.target.value }))
                }
              />
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Daily allocation (t)"
                type="number"
                value={project.dailyAllocationT}
                onChange={(e) =>
                  setProject((p) => ({
                    ...p,
                    dailyAllocationT: e.target.value,
                  }))
                }
              />
              <button
                type="button"
                disabled={saving}
                onClick={() => void projectDates()}
                className="btn-secondary !py-2 text-sm w-full"
              >
                Run projection
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-[10px] font-black uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-2.5">#</th>
                  <th className="px-3 py-2.5">Field</th>
                  <th className="px-3 py-2.5">Planned</th>
                  <th className="px-3 py-2.5">Destination</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {[...store.harvest_plan]
                  .sort((a, b) => a.sequence - b.sequence)
                  .map((h) => {
                    const field = store.fields.find((f) => f.id === h.field_id);
                    return (
                      <tr key={h.id} className="border-t border-slate-100">
                        <td className="px-3 py-2.5 tabular-nums">
                          {h.sequence}
                        </td>
                        <td className="px-3 py-2.5 font-semibold">
                          {field?.code || h.field_id}
                        </td>
                        <td className="px-3 py-2.5">
                          {h.planned_date || '—'}
                        </td>
                        <td className="px-3 py-2.5">
                          {h.destination || '—'}
                        </td>
                        <td className="px-3 py-2.5 capitalize">{h.status}</td>
                        <td className="px-3 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              void post({
                                entity: 'harvest_plan',
                                action: 'delete',
                                id: h.id,
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
