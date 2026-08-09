'use client';

import { useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  FieldgraphWorkbench,
  LoadingBlock,
  useFieldgraph,
} from '@/components/agri/FieldgraphWorkbench';

export default function FieldgraphFleetPage() {
  const { store, loading, saving, post } = useFieldgraph();
  const [form, setForm] = useState({
    field_id: '',
    date: new Date().toISOString().slice(0, 10),
    vehicle: '',
    activity: '',
    hours: '',
    fuel_l: '',
  });

  const add = async () => {
    if (!form.vehicle.trim()) {
      toast.error('Vehicle required');
      return;
    }
    await post({
      entity: 'fleet_logs',
      action: 'upsert',
      record: {
        ...form,
        field_id: form.field_id || null,
        hours: form.hours ? Number(form.hours) : null,
        fuel_l: form.fuel_l ? Number(form.fuel_l) : null,
      },
    });
    toast.success('Fleet log saved');
  };

  return (
    <FieldgraphWorkbench
      title="Fleet"
      titleAccent="by field"
      description="Vehicle activity, hours and fuel against fields — utilisation without a separate estate system."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 grid sm:grid-cols-3 gap-2">
            <select
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
              value={form.field_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, field_id: e.target.value }))
              }
            >
              <option value="">Field (optional)…</option>
              {store.fields.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.code}
                </option>
              ))}
            </select>
            <input
              type="date"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            />
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
              placeholder="Vehicle"
              value={form.vehicle}
              onChange={(e) =>
                setForm((f) => ({ ...f, vehicle: e.target.value }))
              }
            />
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
              placeholder="Activity"
              value={form.activity}
              onChange={(e) =>
                setForm((f) => ({ ...f, activity: e.target.value }))
              }
            />
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
              placeholder="Hours"
              type="number"
              value={form.hours}
              onChange={(e) => setForm((f) => ({ ...f, hours: e.target.value }))}
            />
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
              placeholder="Fuel L"
              type="number"
              value={form.fuel_l}
              onChange={(e) =>
                setForm((f) => ({ ...f, fuel_l: e.target.value }))
              }
            />
            <button
              type="button"
              disabled={saving}
              onClick={() => void add()}
              className="btn-primary !py-2 text-sm sm:col-span-3 inline-flex justify-center gap-1.5"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Log activity
            </button>
          </div>
          <ul className="space-y-2">
            {store.fleet_logs.map((l) => (
              <li
                key={l.id}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 flex justify-between gap-3 text-sm"
              >
                <div>
                  <div className="font-bold">
                    {l.vehicle} · {l.activity}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {l.date}
                    {l.hours != null ? ` · ${l.hours}h` : ''}
                    {l.fuel_l != null ? ` · ${l.fuel_l}L` : ''}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    void post({
                      entity: 'fleet_logs',
                      action: 'delete',
                      id: l.id,
                    })
                  }
                  className="text-rose-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </FieldgraphWorkbench>
  );
}
