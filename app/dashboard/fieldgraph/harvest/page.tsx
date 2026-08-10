'use client';

/**
 * Core · Harvest Planner
 * Cutting sequence + field estimates + daily allocation → expected cut dates.
 */
import { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CalendarRange,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  FieldgraphWorkbench,
  LoadingBlock,
  useFieldgraph,
} from '@/components/agri/FieldgraphWorkbench';

export default function FieldgraphHarvestPage() {
  const year = String(new Date().getFullYear());
  const { store, loading, saving, post, summary } = useFieldgraph();
  const [season, setSeason] = useState(year);
  const [form, setForm] = useState({
    field_id: '',
    season: year,
    sequence: '',
    destination: '',
    estimated_tonnes: '',
    status: 'planned',
  });
  const [project, setProject] = useState({
    startDate: new Date().toISOString().slice(0, 10),
    dailyAllocationT: '120',
  });

  const seasons = useMemo(() => {
    if (!store) return [year];
    const s = new Set<string>([year]);
    for (const h of store.harvest_plan) s.add(h.season);
    for (const e of store.estimates) s.add(e.season);
    return [...s].sort().reverse();
  }, [store, year]);

  const plan = useMemo(() => {
    if (!store) return [];
    return [...store.harvest_plan]
      .filter((h) => h.season === season)
      .sort((a, b) => a.sequence - b.sequence);
  }, [store, season]);

  const totals = useMemo(() => {
    let tonnes = 0;
    let days = 0;
    for (const h of plan) {
      tonnes += Number(h.estimated_tonnes) || 0;
      days += Number(h.days_to_cut) || 0;
    }
    return {
      fields: plan.length,
      tonnes: Math.round(tonnes * 10) / 10,
      days,
      open: plan.filter(
        (h) => h.status === 'planned' || h.status === 'cutting'
      ).length,
    };
  }, [plan]);

  const estimateForField = (fieldId: string) => {
    if (!store) return null;
    return (
      store.estimates.find(
        (e) =>
          e.field_id === fieldId &&
          e.season === season &&
          e.status !== 'draft'
      ) ||
      store.estimates.find(
        (e) => e.field_id === fieldId && e.season === season
      ) ||
      null
    );
  };

  const add = async () => {
    if (!form.field_id) {
      toast.error('Select a field');
      return;
    }
    const nextSeq =
      Number(form.sequence) ||
      (plan.length
        ? Math.max(...plan.map((p) => p.sequence)) + 1
        : 1);
    const est = estimateForField(form.field_id);
    await post({
      entity: 'harvest_plan',
      action: 'upsert',
      record: {
        field_id: form.field_id,
        season: form.season || season,
        sequence: nextSeq,
        destination: form.destination || undefined,
        estimated_tonnes: form.estimated_tonnes
          ? Number(form.estimated_tonnes)
          : est?.tonnes ?? null,
        status: form.status || 'planned',
      },
    });
    toast.success('Field added to cutting sequence');
    setForm((f) => ({
      ...f,
      field_id: '',
      destination: '',
      estimated_tonnes: '',
      sequence: '',
    }));
  };

  const projectDates = async () => {
    if (!plan.length) {
      toast.error('Add fields to the sequence first');
      return;
    }
    await post({
      action: 'project_harvest',
      season,
      startDate: project.startDate,
      dailyAllocationT: Number(project.dailyAllocationT) || 120,
    });
    toast.success(
      `Projected cut dates for ${season} at ${project.dailyAllocationT} t/day`
    );
  };

  const move = async (id: string, dir: -1 | 1) => {
    const idx = plan.findIndex((h) => h.id === id);
    const swap = plan[idx + dir];
    if (!swap || idx < 0) return;
    const a = plan[idx];
    await post({
      entity: 'harvest_plan',
      action: 'upsert',
      record: { ...a, sequence: swap.sequence },
    });
    await post({
      entity: 'harvest_plan',
      action: 'upsert',
      record: { ...swap, sequence: a.sequence },
    });
  };

  const setStatus = async (
    id: string,
    status: 'planned' | 'cutting' | 'delivered' | 'done'
  ) => {
    const row = store?.harvest_plan.find((h) => h.id === id);
    if (!row) return;
    await post({
      entity: 'harvest_plan',
      action: 'upsert',
      record: { ...row, status },
    });
  };

  return (
    <FieldgraphWorkbench
      title="Harvest Planner"
      titleAccent="cut dates"
      description="Given your cutting sequence, field estimates and daily allocation for the season, FieldAdvisor calculates expected cut start and end dates for each field — multi-crop destinations (mill, silo, buyer)."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="block text-[10px] font-black uppercase text-slate-400 dark:text-white/70 mb-1">
                Season
              </span>
              <select
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 min-w-[120px]"
                value={season}
                onChange={(e) => {
                  setSeason(e.target.value);
                  setForm((f) => ({ ...f, season: e.target.value }));
                }}
              >
                {seasons.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid sm:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-emerald-300 bg-emerald-50 dark:!border-emerald-400 dark:!bg-emerald-950 dark:ring-1 dark:ring-emerald-500/40 px-4 py-3">
              <div className="text-[10px] font-black uppercase text-amber-900/60">
                In sequence
              </div>
              <div className="text-2xl font-black tabular-nums dark:text-white">
                {totals.fields}
              </div>
              <div className="text-[11px] text-slate-500">
                {totals.open} open · hub {Number(summary?.harvestOpen) || 0}
              </div>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-white dark:!border-emerald-400 dark:!bg-emerald-950 dark:ring-1 dark:ring-emerald-500/40 px-4 py-3">
              <div className="text-[10px] font-black uppercase text-slate-400 dark:text-white/70">
                Planned tonnes
              </div>
              <div className="text-2xl font-black tabular-nums dark:text-white">
                {totals.tonnes}
              </div>
              <div className="text-[11px] text-slate-500">from estimates</div>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-white dark:!border-emerald-400 dark:!bg-emerald-950 dark:ring-1 dark:ring-emerald-500/40 px-4 py-3">
              <div className="text-[10px] font-black uppercase text-slate-400 dark:text-white/70">
                Projected days
              </div>
              <div className="text-2xl font-black tabular-nums dark:text-white">
                {totals.days || '—'}
              </div>
              <div className="text-[11px] text-slate-500">
                @ {project.dailyAllocationT} t/day
              </div>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-white dark:!border-emerald-400 dark:!bg-emerald-950 dark:ring-1 dark:ring-emerald-500/40 px-4 py-3">
              <div className="text-[10px] font-black uppercase text-slate-400 dark:text-white/70">
                Window
              </div>
              <div className="text-sm font-bold text-slate-800 dark:text-white mt-1">
                {plan[0]?.planned_date || '—'}
                {plan.length > 1 && plan[plan.length - 1]?.planned_end_date
                  ? ` → ${plan[plan.length - 1].planned_end_date}`
                  : ''}
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="rounded-3xl border border-emerald-300 bg-emerald-50 dark:!border-emerald-400 dark:!bg-emerald-950 dark:ring-1 dark:ring-emerald-500/50 p-4 space-y-2">
              <h3 className="text-sm font-black">Add to cutting sequence</h3>
              <p className="text-[11px] text-slate-600">
                Sequence order drives projection. Tonnes pull from non-draft
                estimates when available.
              </p>
              <select
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                value={form.field_id}
                onChange={(e) => {
                  const field_id = e.target.value;
                  const est = estimateForField(field_id);
                  setForm((f) => ({
                    ...f,
                    field_id,
                    estimated_tonnes: est
                      ? String(est.tonnes)
                      : f.estimated_tonnes,
                  }));
                }}
              >
                <option value="">Field…</option>
                {store.fields
                  .filter((f) => f.active !== false)
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.code} · {f.name} · {f.crop} ({f.hectares} ha)
                    </option>
                  ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                  placeholder="Sequence #"
                  type="number"
                  value={form.sequence}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, sequence: e.target.value }))
                  }
                />
                <input
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                  placeholder="Est. tonnes"
                  type="number"
                  value={form.estimated_tonnes}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      estimated_tonnes: e.target.value,
                    }))
                  }
                />
              </div>
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                placeholder="Destination (mill / silo / buyer)"
                value={form.destination}
                onChange={(e) =>
                  setForm((f) => ({ ...f, destination: e.target.value }))
                }
              />
              <select
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({ ...f, status: e.target.value }))
                }
              >
                <option value="planned">Planned</option>
                <option value="cutting">Cutting</option>
                <option value="delivered">Delivered</option>
                <option value="done">Done</option>
              </select>
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
                Add field to sequence
              </button>
            </div>

            <div className="rounded-3xl border border-emerald-300 bg-emerald-50 dark:!border-emerald-400 dark:!bg-emerald-950 dark:ring-1 dark:ring-emerald-500/50 p-4 space-y-2">
              <h3 className="text-sm font-black inline-flex items-center gap-1.5">
                <CalendarRange className="w-4 h-4 text-emerald-700 dark:text-white" /> Project
                expected cut dates
              </h3>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Walks the sequence in order: each field&apos;s estimate tonnes ÷
                daily allocation = days on cut. Start date advances for the next
                field so you get a full-season harvest calendar.
              </p>
              <label className="block text-[10px] font-black uppercase text-slate-400 dark:text-white/70">
                Season start (first cut)
              </label>
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                type="date"
                value={project.startDate}
                onChange={(e) =>
                  setProject((p) => ({ ...p, startDate: e.target.value }))
                }
              />
              <label className="block text-[10px] font-black uppercase text-slate-400 dark:text-white/70">
                Daily allocation (tonnes / day)
              </label>
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
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
                disabled={saving || !plan.length}
                onClick={() => void projectDates()}
                className="btn-secondary !py-2 text-sm w-full"
              >
                Run projection for {season}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-3xl border border-emerald-200 bg-white dark:!border-emerald-400 dark:!bg-emerald-950 dark:ring-1 dark:ring-emerald-500/40">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="bg-emerald-50 text-left text-[10px] font-black uppercase tracking-wider text-emerald-900 dark:text-white dark:bg-emerald-900/50 dark:text-white">
                <tr>
                  <th className="px-3 py-2.5">#</th>
                  <th className="px-3 py-2.5">Field</th>
                  <th className="px-3 py-2.5">Crop</th>
                  <th className="px-3 py-2.5">Est. t</th>
                  <th className="px-3 py-2.5">Start</th>
                  <th className="px-3 py-2.5">End</th>
                  <th className="px-3 py-2.5">Days</th>
                  <th className="px-3 py-2.5">Destination</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {plan.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-3 py-10 text-center text-slate-500 text-sm"
                    >
                      No fields in the {season} cutting sequence yet. Add fields
                      above, then run projection.
                    </td>
                  </tr>
                ) : (
                  plan.map((h, i) => {
                    const field = store.fields.find((f) => f.id === h.field_id);
                    const est = estimateForField(h.field_id);
                    const tonnes =
                      h.estimated_tonnes ?? est?.tonnes ?? null;
                    return (
                      <tr key={h.id} className="border-t border-slate-100">
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-0.5">
                            <span className="tabular-nums font-bold w-6">
                              {h.sequence}
                            </span>
                            <button
                              type="button"
                              disabled={i === 0 || saving}
                              onClick={() => void move(h.id, -1)}
                              className="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                              title="Move up"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={i === plan.length - 1 || saving}
                              onClick={() => void move(h.id, 1)}
                              className="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                              title="Move down"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 font-semibold">
                          {field?.code || h.field_id}
                          <div className="text-[11px] font-normal text-slate-500">
                            {field?.name}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-slate-600">
                          {field?.crop || '—'}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums">
                          {tonnes != null ? tonnes : '—'}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums">
                          {h.planned_date || '—'}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums">
                          {h.planned_end_date || '—'}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums">
                          {h.days_to_cut ?? '—'}
                        </td>
                        <td className="px-3 py-2.5">
                          {h.destination || '—'}
                        </td>
                        <td className="px-3 py-2.5">
                          <select
                            className="rounded-lg border border-slate-200 px-2 py-1 text-xs capitalize bg-white"
                            value={h.status}
                            disabled={saving}
                            onChange={(e) =>
                              void setStatus(
                                h.id,
                                e.target.value as typeof h.status
                              )
                            }
                          >
                            <option value="planned">planned</option>
                            <option value="cutting">cutting</option>
                            <option value="delivered">delivered</option>
                            <option value="done">done</option>
                          </select>
                        </td>
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
                  })
                )}
              </tbody>
            </table>
          </div>

          {plan.some((h) => h.planned_date) && (
            <div className="rounded-3xl border border-emerald-300 bg-emerald-50 dark:!border-emerald-400 dark:!bg-emerald-950 dark:ring-1 dark:ring-emerald-500/50/80 p-4">
              <h3 className="text-sm font-black mb-3">Season timeline</h3>
              <div className="space-y-2">
                {plan
                  .filter((h) => h.planned_date)
                  .map((h) => {
                    const field = store.fields.find((f) => f.id === h.field_id);
                    const days = h.days_to_cut || 1;
                    const maxDays = Math.max(
                      ...plan.map((x) => x.days_to_cut || 1),
                      1
                    );
                    const width = Math.max(8, (days / maxDays) * 100);
                    return (
                      <div
                        key={h.id}
                        className="grid grid-cols-[100px_1fr_auto] gap-2 items-center text-sm"
                      >
                        <div className="font-semibold truncate">
                          {field?.code || h.sequence}
                        </div>
                        <div className="h-7 rounded-lg bg-white border border-slate-100 overflow-hidden">
                          <div
                            className="h-full rounded-lg bg-gradient-to-r from-amber-400 to-emerald-500 flex items-center px-2 text-[10px] font-bold text-white"
                            style={{ width: `${width}%` }}
                          >
                            {h.planned_date}
                            {h.planned_end_date
                              ? ` → ${h.planned_end_date}`
                              : ''}
                          </div>
                        </div>
                        <div className="text-[11px] text-slate-500 tabular-nums w-14 text-right">
                          {days}d
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      )}
    </FieldgraphWorkbench>
  );
}
