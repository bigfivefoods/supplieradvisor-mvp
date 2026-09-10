'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  ConstructionEmptyHint,
  ConstructionLoadingBlock,
  ConstructionProjectSelect,
  ConstructiongraphWorkbench,
  useConstructiongraph,
} from '@/components/construction/ConstructiongraphWorkbench';
import {
  newConstructionId,
  paymentCashflow,
  projectReport,
} from '@/lib/construction/constructiongraph';

function zar(n: number) {
  return `R ${Number(n || 0).toLocaleString('en-ZA')}`;
}

export default function ConstructiongraphProgrammePage() {
  const { store, loading, saving, post } = useConstructiongraph();
  const [siteId, setSiteId] = useState('');
  const [activity, setActivity] = useState('');
  const [plannedStart, setPlannedStart] = useState('');
  const [plannedEnd, setPlannedEnd] = useState('');
  const [plannedPct, setPlannedPct] = useState('');
  const [actualPct, setActualPct] = useState('');

  const add = async () => {
    const next = activity.trim();
    if (!siteId || !next) {
      toast.error('Project and activity are required');
      return;
    }
    const planned = Number(plannedPct) || 0;
    const actual = Number(actualPct) || 0;
    await post({
      action: 'merge',
      store: {
        programme: [
          {
            id: newConstructionId('prg'),
            site_id: siteId,
            activity: next,
            planned_start: plannedStart || null,
            planned_end: plannedEnd || null,
            start_date: plannedStart || null,
            end_date: plannedEnd || null,
            planned_pct: planned,
            actual_pct: actual,
            pct_complete: actual,
            status: actual >= 100 ? 'complete' : actual > 0 ? 'in_progress' : 'planned',
          },
        ],
      },
    });
    setActivity('');
    setPlannedStart('');
    setPlannedEnd('');
    setPlannedPct('');
    setActualPct('');
    toast.success('Programme activity dated');
  };

  const postActual = async (id: string, value: string) => {
    const row = store?.programme.find((p) => p.id === id);
    if (!row) return;
    const actual = Number(value);
    if (!Number.isFinite(actual)) return;
    await post({
      action: 'merge',
      store: {
        programme: [
          {
            ...row,
            actual_pct: actual,
            pct_complete: actual,
            actual_start: row.actual_start || new Date().toISOString().slice(0, 10),
            actual_end: actual >= 100 ? new Date().toISOString().slice(0, 10) : row.actual_end,
            status: actual >= 100 ? 'complete' : actual > 0 ? 'in_progress' : row.status,
          },
        ],
      },
    });
    toast.success('Actual % posted — project plan updated');
  };

  return (
    <ConstructiongraphWorkbench
      title="Programme"
      description="Dated project plan versus actuals. Progress-payment dates live on Payments — this desk is the work programme."
    >
      {loading || !store ? (
        <ConstructionLoadingBlock />
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-stone-300 bg-white p-4 grid sm:grid-cols-6 gap-2">
            <ConstructionProjectSelect
              store={store}
              value={siteId}
              onChange={setSiteId}
            />
            <input
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm sm:col-span-2"
              placeholder="Activity"
              value={activity}
              onChange={(e) => setActivity(e.target.value)}
            />
            <input
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
              placeholder="Planned %"
              value={plannedPct}
              onChange={(e) => setPlannedPct(e.target.value)}
            />
            <input
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
              placeholder="Actual %"
              value={actualPct}
              onChange={(e) => setActualPct(e.target.value)}
            />
            <button
              type="button"
              disabled={saving}
              onClick={() => void add()}
              className="btn-primary !py-2 text-sm"
            >
              Add
            </button>
            <label className="text-xs text-stone-500 sm:col-span-3">
              Planned start
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                value={plannedStart}
                onChange={(e) => setPlannedStart(e.target.value)}
              />
            </label>
            <label className="text-xs text-stone-500 sm:col-span-3">
              Planned end
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                value={plannedEnd}
                onChange={(e) => setPlannedEnd(e.target.value)}
              />
            </label>
          </div>
          {store.sites.length === 0 ? (
            <ConstructionEmptyHint>Add a project before building the programme.</ConstructionEmptyHint>
          ) : (
            store.sites.map((site) => {
              const rows = store.programme.filter((p) => p.site_id === site.id);
              const report = projectReport(store, site.id);
              const cash = paymentCashflow(store, site.id);
              return (
                <div
                  key={site.id}
                  className="rounded-2xl border border-stone-300 bg-white p-4 text-sm space-y-2"
                >
                  <div className="font-black">
                    {site.code} · {site.name}
                  </div>
                  <div className="text-xs text-stone-500">
                    Plan {Math.round(report?.plannedPct || 0)}% / actual{' '}
                    {Math.round(report?.actualPct || 0)}% · budget{' '}
                    {zar(report?.budget || 0)} · costs {zar(report?.costs || 0)} ·
                    claims planned {zar(cash.planned)} · paid {zar(cash.paid)}
                  </div>
                  {rows.length === 0 ? (
                    <p className="text-xs text-stone-500">No activities on this project yet.</p>
                  ) : (
                    rows.map((row) => (
                      <div
                        key={row.id}
                        className="border-t pt-2 flex flex-wrap items-center gap-2"
                      >
                        <div className="flex-1 min-w-[12rem]">
                          <b>{row.activity}</b> · {row.status || '—'}
                          <div className="text-xs text-stone-500">
                            {row.planned_start || row.start_date || '—'} →{' '}
                            {row.planned_end || row.end_date || '—'}
                            {row.actual_start ? ` · actual start ${row.actual_start}` : ''} ·
                            planned {row.planned_pct ?? 0}% · actual{' '}
                            {row.actual_pct ?? row.pct_complete ?? 0}%
                          </div>
                        </div>
                        <input
                          className="rounded-lg border border-stone-300 px-2 py-1 text-xs w-20"
                          defaultValue={String(
                            row.actual_pct ?? row.pct_complete ?? 0
                          )}
                          aria-label={`Actual percent for ${row.activity}`}
                          onBlur={(e) => void postActual(row.id, e.target.value)}
                        />
                      </div>
                    ))
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </ConstructiongraphWorkbench>
  );
}
