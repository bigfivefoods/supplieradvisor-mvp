'use client';

import { useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import {
  FieldgraphWorkbench,
  LoadingBlock,
  useFieldgraph,
} from '@/components/agri/FieldgraphWorkbench';

export default function FieldgraphRegenPage() {
  const { store, loading, saving, post } = useFieldgraph();
  const [form, setForm] = useState({
    field_id: '',
    date: new Date().toISOString().slice(0, 10),
    soil_organic_carbon_pct: '',
    moisture_pct: '',
    cover_pct: '',
    water_used_mm: '',
    biodiversity_notes: '',
  });

  const add = async () => {
    if (!form.field_id) {
      toast.error('Select a field');
      return;
    }
    await post({
      entity: 'regen_samples',
      action: 'upsert',
      record: {
        ...form,
        soil_organic_carbon_pct: form.soil_organic_carbon_pct
          ? Number(form.soil_organic_carbon_pct)
          : null,
        moisture_pct: form.moisture_pct ? Number(form.moisture_pct) : null,
        cover_pct: form.cover_pct ? Number(form.cover_pct) : null,
        water_used_mm: form.water_used_mm ? Number(form.water_used_mm) : null,
      },
    });
    toast.success('Regen sample saved');
  };

  return (
    <FieldgraphWorkbench
      title="Regen"
      titleAccent="metrics"
      description="Soil organic carbon, cover, moisture and water use by field — proof for buyers and ESG packs, not a separate spreadsheet."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <p className="text-xs text-slate-500">
            Deep ESG packs also live under{' '}
            <Link
              href="/dashboard/sustainability"
              className="font-bold text-emerald-700 dark:text-white underline"
            >
              Impact
            </Link>
            .
          </p>
          <div className="rounded-3xl border border-amber-300 bg-amber-50 dark:!border-amber-400 dark:!bg-amber-950 dark:ring-1 dark:ring-amber-500/50 p-4 grid sm:grid-cols-3 gap-2">
            <select
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
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
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            />
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
              placeholder="SOC %"
              type="number"
              step="0.01"
              value={form.soil_organic_carbon_pct}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  soil_organic_carbon_pct: e.target.value,
                }))
              }
            />
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
              placeholder="Moisture %"
              type="number"
              value={form.moisture_pct}
              onChange={(e) =>
                setForm((f) => ({ ...f, moisture_pct: e.target.value }))
              }
            />
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
              placeholder="Cover %"
              type="number"
              value={form.cover_pct}
              onChange={(e) =>
                setForm((f) => ({ ...f, cover_pct: e.target.value }))
              }
            />
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
              placeholder="Water mm"
              type="number"
              value={form.water_used_mm}
              onChange={(e) =>
                setForm((f) => ({ ...f, water_used_mm: e.target.value }))
              }
            />
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 sm:col-span-2"
              placeholder="Biodiversity / practice notes"
              value={form.biodiversity_notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, biodiversity_notes: e.target.value }))
              }
            />
            <button
              type="button"
              disabled={saving}
              onClick={() => void add()}
              className="btn-primary !py-2 text-sm inline-flex justify-center gap-1.5"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Save sample
            </button>
          </div>
          <ul className="space-y-2">
            {store.regen_samples.map((r) => {
              const field = store.fields.find((f) => f.id === r.field_id);
              return (
                <li
                  key={r.id}
                  className="rounded-2xl border border-amber-200 bg-white dark:!border-amber-400 dark:!bg-amber-950 dark:ring-1 dark:ring-amber-500/40 px-4 py-3 flex justify-between text-sm"
                >
                  <div>
                    <div className="font-bold">
                      {field?.code || r.field_id} · {r.date}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      SOC {r.soil_organic_carbon_pct ?? '—'}% · Cover{' '}
                      {r.cover_pct ?? '—'}% · Water {r.water_used_mm ?? '—'} mm
                    </div>
                    {r.biodiversity_notes ? (
                      <div className="text-[11px] text-slate-600 mt-0.5">
                        {r.biodiversity_notes}
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      void post({
                        entity: 'regen_samples',
                        action: 'delete',
                        id: r.id,
                      })
                    }
                    className="text-rose-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </FieldgraphWorkbench>
  );
}
