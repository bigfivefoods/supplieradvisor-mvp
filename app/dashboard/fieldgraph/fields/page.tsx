'use client';

/**
 * Core · Field & agronomic data
 * Shared field master used by estimates, harvest, inputs, fleet, labour, regen.
 */
import { useMemo, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  FieldgraphWorkbench,
  LoadingBlock,
  useFieldgraph,
} from '@/components/agri/FieldgraphWorkbench';
import { CROP_TYPES, fieldYieldSeries } from '@/lib/agri/fieldgraph';

export default function FieldgraphFieldsPage() {
  const { store, loading, saving, post, summary } = useFieldgraph();
  const [selectedId, setSelectedId] = useState<string>('');
  const [form, setForm] = useState({
    code: '',
    name: '',
    farm_name: '',
    crop: 'Sugar cane',
    variety: '',
    hectares: '',
    irrigation: 'unknown',
    soil_type: '',
    plant_date: '',
    row_spacing_m: '',
    population_per_ha: '',
    mill_group: '',
    district: '',
    ratoon: '',
    notes: '',
  });

  const selected = store?.fields.find((f) => f.id === selectedId);
  const series = useMemo(() => {
    if (!store || !selectedId) return [];
    return fieldYieldSeries(store, selectedId);
  }, [store, selectedId]);

  const maxBar = useMemo(() => {
    let m = 1;
    for (const s of series) {
      m = Math.max(m, s.estimate_t || 0, s.actual_t || 0);
    }
    return m;
  }, [series]);

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
        row_spacing_m: form.row_spacing_m
          ? Number(form.row_spacing_m)
          : null,
        population_per_ha: form.population_per_ha
          ? Number(form.population_per_ha)
          : null,
        ratoon: form.ratoon ? Number(form.ratoon) : undefined,
        plant_date: form.plant_date || null,
      },
    });
    toast.success('Field agronomic record saved — shared across Fieldgraph');
    setForm((f) => ({
      ...f,
      code: '',
      name: '',
      variety: '',
      hectares: '',
      notes: '',
    }));
  };

  return (
    <FieldgraphWorkbench
      title="Field & agronomic data"
      titleAccent="shared master"
      description="Core field information is the single source of truth for estimates, harvest planning, inputs, fleet, labour and regen. Multi-crop — not cane-only. Analyse yield and quality across seasons per field."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-emerald-300 bg-emerald-50 dark:!border-emerald-400 dark:!bg-emerald-950 dark:ring-1 dark:ring-emerald-500/40 px-4 py-3">
              <div className="text-[10px] font-black uppercase text-emerald-800/70">
                Fields in book
              </div>
              <div className="text-2xl font-black tabular-nums">
                {Number(summary?.fieldCount) || store.fields.length}
              </div>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-white dark:!border-emerald-400 dark:!bg-emerald-950 dark:ring-1 dark:ring-emerald-500/40 px-4 py-3">
              <div className="text-[10px] font-black uppercase text-slate-400">
                Hectares
              </div>
              <div className="text-2xl font-black tabular-nums">
                {Number(summary?.hectares) || 0}
              </div>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-white dark:!border-emerald-400 dark:!bg-emerald-950 dark:ring-1 dark:ring-emerald-500/40 px-4 py-3">
              <div className="text-[10px] font-black uppercase text-slate-400">
                Crops
              </div>
              <div className="text-sm font-bold text-slate-800 mt-1">
                {(summary?.crops as string[] | undefined)?.join(' · ') || '—'}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-emerald-300 bg-emerald-50 dark:!border-emerald-400 dark:!bg-emerald-950 dark:ring-1 dark:ring-emerald-500/50 p-4 sm:p-5">
            <h3 className="text-sm font-black text-slate-900 mb-1">
              Add / update field (agronomic master)
            </h3>
            <p className="text-[11px] text-slate-500 mb-3">
              Variety, ratoon, irrigation, soil, plant date and mill group are
              reused by Estimates and Harvest Planner automatically.
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {(
                [
                  ['code', 'Code (A12)'],
                  ['name', 'Field name'],
                  ['farm_name', 'Farm / estate'],
                  ['variety', 'Variety / cultivar'],
                  ['hectares', 'Hectares'],
                  ['plant_date', 'Plant date', 'date'],
                  ['row_spacing_m', 'Row spacing (m)'],
                  ['population_per_ha', 'Population / ha'],
                  ['ratoon', 'Ratoon #'],
                  ['soil_type', 'Soil type'],
                  ['district', 'District'],
                  ['mill_group', 'Mill / board group'],
                ] as Array<[string, string, string?]>
              ).map(([key, ph, type]) => (
                <input
                  key={key}
                  type={type || (key.includes('ha') || key.includes('ratoon') || key.includes('spacing') || key.includes('population') ? 'number' : 'text')}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                  placeholder={ph}
                  value={(form as Record<string, string>)[key]}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, [key]: e.target.value }))
                  }
                />
              ))}
              <select
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                value={form.crop}
                onChange={(e) => setForm((f) => ({ ...f, crop: e.target.value }))}
              >
                {CROP_TYPES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
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
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 sm:col-span-2"
                placeholder="Notes"
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
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
              Save field master
            </button>
          </div>

          <div className="grid lg:grid-cols-5 gap-4">
            <div className="lg:col-span-3 overflow-x-auto rounded-3xl border border-emerald-200 bg-white dark:!border-emerald-400 dark:!bg-emerald-950 dark:ring-1 dark:ring-emerald-500/40">
              <table className="w-full text-sm">
                <thead className="bg-emerald-50 text-left text-[10px] font-black uppercase tracking-wider text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-200">
                  <tr>
                    <th className="px-3 py-2.5">Code</th>
                    <th className="px-3 py-2.5">Agronomy</th>
                    <th className="px-3 py-2.5">Ha</th>
                    <th className="px-3 py-2.5">Water / soil</th>
                    <th className="px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {store.fields.map((f) => (
                    <tr
                      key={f.id}
                      className={`border-t border-slate-100 cursor-pointer ${
                        selectedId === f.id ? 'bg-emerald-50/60' : ''
                      }`}
                      onClick={() => setSelectedId(f.id)}
                    >
                      <td className="px-3 py-2.5 font-mono text-xs font-bold">
                        {f.code}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="font-semibold">{f.name}</div>
                        <div className="text-[11px] text-slate-500">
                          {f.crop}
                          {f.variety ? ` · ${f.variety}` : ''}
                          {f.ratoon != null ? ` · R${f.ratoon}` : ''}
                          {f.mill_group ? ` · ${f.mill_group}` : ''}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">{f.hectares}</td>
                      <td className="px-3 py-2.5 text-[11px] capitalize">
                        {f.irrigation || '—'}
                        {f.soil_type ? ` · ${f.soil_type}` : ''}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void post({
                              entity: 'fields',
                              action: 'delete',
                              id: f.id,
                            }).then(() => toast.success('Removed'));
                          }}
                          className="text-rose-600 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="lg:col-span-2 rounded-3xl border border-emerald-300 bg-emerald-50 dark:!border-emerald-400 dark:!bg-emerald-950 dark:ring-1 dark:ring-emerald-500/50">
              <h3 className="text-sm font-black text-slate-900">
                Yield & quality · seasons
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5 mb-3">
                {selected
                  ? `${selected.code} · ${selected.name} — estimate vs actual`
                  : 'Select a field to analyse yield and quality across seasons.'}
              </p>
              {!selected ? (
                <p className="text-sm text-slate-400 py-8 text-center">
                  Click a field row
                </p>
              ) : series.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No estimate/actual yield rows yet for this field. Add estimates
                  and actuals under Estimates.
                </p>
              ) : (
                <div className="space-y-3">
                  {series.map((s) => (
                    <div key={s.season}>
                      <div className="flex justify-between text-[11px] font-bold text-slate-600 mb-1">
                        <span>{s.season}</span>
                        <span className="tabular-nums">
                          Est {s.estimate_t ?? '—'}t
                          {s.actual_t != null ? ` · Act ${s.actual_t}t` : ''}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-sky-400"
                            style={{
                              width: `${Math.min(
                                100,
                                ((s.estimate_t || 0) / maxBar) * 100
                              )}%`,
                            }}
                            title="Estimate"
                          />
                        </div>
                        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-500"
                            style={{
                              width: `${Math.min(
                                100,
                                ((s.actual_t || 0) / maxBar) * 100
                              )}%`,
                            }}
                            title="Actual"
                          />
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Quality est {s.quality_est ?? '—'}% · act{' '}
                        {s.quality_act ?? '—'}% · t/ha est {s.t_per_ha_est ?? '—'}{' '}
                        · act {s.t_per_ha_act ?? '—'}
                      </div>
                    </div>
                  ))}
                  <div className="flex gap-3 text-[10px] font-bold pt-1">
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />{' '}
                      Estimate
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />{' '}
                      Actual
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </FieldgraphWorkbench>
  );
}
