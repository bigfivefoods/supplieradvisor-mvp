'use client';

/**
 * Core · Estimates (Estimate Manager + Mill Group Board support)
 */
import { useMemo, useState } from 'react';
import { FileSpreadsheet, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  FieldgraphWorkbench,
  LoadingBlock,
  useFieldgraph,
} from '@/components/agri/FieldgraphWorkbench';

export default function FieldgraphEstimatesPage() {
  const year = String(new Date().getFullYear());
  const { store, loading, saving, post, summary, analysis } = useFieldgraph();
  const [seasonFilter, setSeasonFilter] = useState(year);
  const [form, setForm] = useState({
    field_id: '',
    season: year,
    tonnes: '',
    quality_pct: '',
    status: 'draft',
    board_ref: '',
    notes: '',
  });
  const [actualForm, setActualForm] = useState({
    field_id: '',
    season: year,
    tonnes: '',
    quality_pct: '',
  });

  const seasons = useMemo(() => {
    if (!store) return [year];
    const s = new Set<string>([year]);
    for (const e of store.estimates) s.add(e.season);
    for (const a of store.yield_actuals || []) s.add(a.season);
    return [...s].sort().reverse();
  }, [store, year]);

  const boardRows = useMemo(() => {
    return (
      (analysis?.millBoard as Array<Record<string, unknown>> | undefined) ||
      []
    ).filter((r) => true);
  }, [analysis]);

  const seasonEstimates = useMemo(() => {
    if (!store) return [];
    return store.estimates.filter((e) => e.season === seasonFilter);
  }, [store, seasonFilter]);

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
    toast.success('Estimate saved (revision history kept)');
  };

  const addActual = async () => {
    if (!actualForm.field_id) {
      toast.error('Select a field');
      return;
    }
    await post({
      entity: 'yield_actuals',
      action: 'upsert',
      record: {
        ...actualForm,
        tonnes: Number(actualForm.tonnes) || 0,
        quality_pct: actualForm.quality_pct
          ? Number(actualForm.quality_pct)
          : null,
      },
    });
    toast.success('Actual yield recorded for season analysis');
  };

  const submitBoard = async (id: string) => {
    const est = store?.estimates.find((e) => e.id === id);
    if (!est) return;
    await post({
      entity: 'estimates',
      action: 'upsert',
      record: {
        ...est,
        status: 'board',
        board_ref: est.board_ref || `MGB-${est.season}-${est.field_id.slice(-4)}`,
      },
    });
    toast.success('Marked for Mill Group Board submission');
  };

  const exportBoardCsv = () => {
    if (!store) return;
    const rows = seasonEstimates.map((e) => {
      const f = store.fields.find((x) => x.id === e.field_id);
      return [
        f?.code,
        f?.name,
        f?.crop,
        f?.hectares,
        e.tonnes,
        e.tonnes_per_ha,
        e.quality_pct,
        e.status,
        e.board_ref,
        e.revision,
        f?.mill_group,
      ].join(',');
    });
    const header =
      'field_code,field_name,crop,ha,tonnes,t_per_ha,quality,status,board_ref,revision,mill_group';
    const blob = new Blob([[header, ...rows].join('\n')], {
      type: 'text/csv',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fieldgraph-mgb-estimates-${seasonFilter}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Board estimate CSV downloaded');
  };

  const yieldBySeason =
    (analysis?.yieldBySeason as Array<{
      season: string;
      estimate_t: number;
      actual_t: number;
      avg_quality_est: number | null;
    }>) || [];
  const maxY = Math.max(
    1,
    ...yieldBySeason.map((y) => Math.max(y.estimate_t, y.actual_t))
  );

  return (
    <FieldgraphWorkbench
      title="Estimates"
      titleAccent="manager"
      description="Field-level estimate manager: create, revise, and submit estimates. Supports Mill Group Board–style submissions and revision history. Pair with actuals for across-season yield graphs."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-emerald-300 bg-emerald-50 dark:!border-emerald-400 dark:!bg-emerald-950 dark:ring-1 dark:ring-emerald-500/40 px-4 py-3">
              <div className="text-[10px] font-black uppercase text-sky-800/70">
                Est. tonnes (non-draft)
              </div>
              <div className="text-2xl font-black tabular-nums dark:text-white">
                {Number(summary?.estimateTonnes) || 0}
              </div>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-white dark:!border-emerald-400 dark:!bg-emerald-950 dark:ring-1 dark:ring-emerald-500/40 px-4 py-3">
              <div className="text-[10px] font-black uppercase text-slate-400 dark:text-white/70">
                Board / submitted
              </div>
              <div className="text-2xl font-black tabular-nums dark:text-white">
                {Number(summary?.boardEstimates) || 0}
              </div>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-white dark:!border-emerald-400 dark:!bg-emerald-950 dark:ring-1 dark:ring-emerald-500/40 px-4 py-3">
              <div className="text-[10px] font-black uppercase text-slate-400 dark:text-white/70">
                Actual seasons logged
              </div>
              <div className="text-2xl font-black tabular-nums dark:text-white">
                {Number(summary?.yieldActuals) || 0}
              </div>
            </div>
          </div>

          {/* Across-season graph */}
          <div className="rounded-3xl border border-emerald-300 bg-emerald-50 dark:!border-emerald-400 dark:!bg-emerald-950 dark:ring-1 dark:ring-emerald-500/50">
            <h3 className="text-sm font-black text-slate-900 mb-1">
              Yield across seasons
            </h3>
            <p className="text-[11px] text-slate-500 mb-4">
              Estate-level estimate vs actual — decision support within and
              across seasons.
            </p>
            {yieldBySeason.length === 0 ? (
              <p className="text-sm text-slate-400">No season data yet</p>
            ) : (
              <div className="flex items-end gap-3 h-36">
                {yieldBySeason.map((y) => (
                  <div
                    key={y.season}
                    className="flex-1 flex flex-col items-center gap-1 min-w-0"
                  >
                    <div className="flex items-end gap-0.5 h-24 w-full justify-center">
                      <div
                        className="w-3 sm:w-4 rounded-t bg-sky-400"
                        style={{
                          height: `${(y.estimate_t / maxY) * 100}%`,
                          minHeight: y.estimate_t ? 4 : 0,
                        }}
                        title={`Est ${y.estimate_t}t`}
                      />
                      <div
                        className="w-3 sm:w-4 rounded-t bg-emerald-500"
                        style={{
                          height: `${(y.actual_t / maxY) * 100}%`,
                          minHeight: y.actual_t ? 4 : 0,
                        }}
                        title={`Act ${y.actual_t}t`}
                      />
                    </div>
                    <div className="text-[10px] font-bold text-slate-600 truncate w-full text-center">
                      {y.season}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="rounded-3xl border border-emerald-300 bg-emerald-50 dark:!border-emerald-400 dark:!bg-emerald-950 dark:ring-1 dark:ring-emerald-500/50 p-4 space-y-2">
              <h3 className="text-sm font-black">Create / revise estimate</h3>
              <select
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                value={form.field_id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, field_id: e.target.value }))
                }
              >
                <option value="">Field…</option>
                {store.fields.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.code} · {f.name} · {f.crop}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                  placeholder="Season"
                  value={form.season}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, season: e.target.value }))
                  }
                />
                <input
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                  placeholder="Tonnes"
                  type="number"
                  value={form.tonnes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, tonnes: e.target.value }))
                  }
                />
                <input
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                  placeholder="Quality % (RV / moisture)"
                  type="number"
                  value={form.quality_pct}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, quality_pct: e.target.value }))
                  }
                />
                <select
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                  value={form.status}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, status: e.target.value }))
                  }
                >
                  <option value="draft">Draft</option>
                  <option value="submitted">Submitted</option>
                  <option value="revised">Revised</option>
                  <option value="board">Mill board</option>
                  <option value="final">Final</option>
                </select>
              </div>
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                placeholder="Board ref (e.g. MGB-2026-A12)"
                value={form.board_ref}
                onChange={(e) =>
                  setForm((f) => ({ ...f, board_ref: e.target.value }))
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
                Save estimate
              </button>
            </div>

            <div className="rounded-3xl border border-emerald-300 bg-emerald-50 dark:!border-emerald-400 dark:!bg-emerald-950 dark:ring-1 dark:ring-emerald-500/50 p-4 space-y-2">
              <h3 className="text-sm font-black">Record actual yield</h3>
              <p className="text-[11px] text-slate-500">
                Actuals power the multi-season yield graphs on Fields and
                Insights.
              </p>
              <select
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                value={actualForm.field_id}
                onChange={(e) =>
                  setActualForm((f) => ({ ...f, field_id: e.target.value }))
                }
              >
                <option value="">Field…</option>
                {store.fields.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.code} · {f.name}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-3 gap-2">
                <input
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                  placeholder="Season"
                  value={actualForm.season}
                  onChange={(e) =>
                    setActualForm((f) => ({ ...f, season: e.target.value }))
                  }
                />
                <input
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                  placeholder="Tonnes"
                  type="number"
                  value={actualForm.tonnes}
                  onChange={(e) =>
                    setActualForm((f) => ({ ...f, tonnes: e.target.value }))
                  }
                />
                <input
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                  placeholder="Quality %"
                  type="number"
                  value={actualForm.quality_pct}
                  onChange={(e) =>
                    setActualForm((f) => ({
                      ...f,
                      quality_pct: e.target.value,
                    }))
                  }
                />
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() => void addActual()}
                className="btn-secondary !py-2 text-sm w-full"
              >
                Save actual
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">Season</span>
              <select
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm"
                value={seasonFilter}
                onChange={(e) => setSeasonFilter(e.target.value)}
              >
                {seasons.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={exportBoardCsv}
              className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Export Mill Board CSV
            </button>
          </div>

          <div className="overflow-x-auto rounded-3xl border border-emerald-200 bg-white dark:!border-emerald-400 dark:!bg-emerald-950 dark:ring-1 dark:ring-emerald-500/40">
            <table className="w-full text-sm">
              <thead className="bg-emerald-50 text-left text-[10px] font-black uppercase tracking-wider text-emerald-900 dark:text-white dark:bg-emerald-900/50 dark:text-white">
                <tr>
                  <th className="px-3 py-2.5">Field</th>
                  <th className="px-3 py-2.5">t</th>
                  <th className="px-3 py-2.5">t/ha</th>
                  <th className="px-3 py-2.5">Quality</th>
                  <th className="px-3 py-2.5">Status / board</th>
                  <th className="px-3 py-2.5">Rev</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {seasonEstimates.map((e) => {
                  const field = store.fields.find((f) => f.id === e.field_id);
                  return (
                    <tr key={e.id} className="border-t border-slate-100">
                      <td className="px-3 py-2.5 font-semibold">
                        {field?.code || e.field_id}
                        <div className="text-[10px] text-slate-400 font-normal">
                          {field?.mill_group || '—'}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">{e.tonnes}</td>
                      <td className="px-3 py-2.5 tabular-nums">
                        {e.tonnes_per_ha ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">
                        {e.quality_pct != null ? `${e.quality_pct}%` : '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="capitalize font-semibold">
                          {e.status}
                        </span>
                        {e.board_ref ? (
                          <div className="text-[10px] text-slate-500">
                            {e.board_ref}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">
                        {e.revision || 1}
                        {(e.revisions?.length || 0) > 0 ? (
                          <div className="text-[10px] text-slate-400">
                            {e.revisions!.length} hist
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5 text-right space-x-1">
                        {e.status !== 'board' && e.status !== 'final' ? (
                          <button
                            type="button"
                            onClick={() => void submitBoard(e.id)}
                            className="text-[10px] font-bold text-sky-700 hover:underline"
                          >
                            Board
                          </button>
                        ) : null}
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
          {boardRows.length > 0 ? (
            <p className="text-[11px] text-slate-500">
              Mill board export for season {seasonFilter} includes{' '}
              {seasonEstimates.length} field estimate
              {seasonEstimates.length === 1 ? '' : 's'}.
            </p>
          ) : null}
        </div>
      )}
    </FieldgraphWorkbench>
  );
}
