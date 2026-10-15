'use client';

import { useMemo, useRef } from 'react';
import { CalendarRange } from 'lucide-react';
import { TradeEmpty, TradeStat } from '@/components/trades/TradeUi';
import {
  forecastEnd,
  readGantt,
  varianceDays,
  type GanttTask,
} from '@/lib/trades/desk';

const DAY = 86_400_000;

export function GanttChart({
  tasks,
  today = '2026-10-14',
  readOnly = false,
  members = [],
  onShift,
}: {
  tasks: GanttTask[];
  today?: string;
  readOnly?: boolean;
  members?: Array<{ id: string; name: string; colour: string }>;
  onShift?: (taskId: string, days: number) => void;
}) {
  const view = useMemo(() => readGantt(tasks, today), [tasks, today]);
  const bounds = useMemo(() => {
    const days = tasks.flatMap((task) => [task.plan_start, task.plan_end, task.start, forecastEnd(task)]);
    const sorted = days.filter(Boolean).sort();
    const start = sorted[0] || today;
    const end = sorted[sorted.length - 1] || today;
    const span = Math.max(7, Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY) + 3);
    return { start, span };
  }, [tasks, today]);
  const drag = useRef<{ id: string; x: number } | null>(null);

  if (!tasks.length) {
    return (
      <TradeEmpty
        title="No programme yet"
        hint="Accept a quote to lock the plan, or add phases on the job."
        icon={<CalendarRange />}
      />
    );
  }

  const dayWidth = 28;
  const width = bounds.span * dayWidth;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <TradeStat label="Plan end" value={view.project_plan_end || '—'} />
        <TradeStat label="Forecast" value={view.project_forecast_end || '—'} />
        <TradeStat
          label="Variance"
          tone={view.variance_days > 0 ? 'warn' : 'default'}
          value={view.variance_days === 0 ? 'On plan' : `${view.variance_days > 0 ? '+' : ''}${view.variance_days}d`}
        />
      </div>
      <div className="flex flex-wrap gap-2 text-[11px] font-bold text-slate-600">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 shadow-sm ring-1 ring-slate-200"><span className="h-2 w-6 rounded-full bg-slate-300" /> Plan</span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 shadow-sm ring-1 ring-slate-200"><span className="h-2 w-6 rounded-full bg-[#00b4d8]" /> Forecast</span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 shadow-sm ring-1 ring-slate-200"><span className="h-2 w-6 rounded-full bg-amber-500" /> Late</span>
      </div>
      {view.current ? (
        <p className="rounded-2xl bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-950">
          Current phase: {view.current.name} · {view.current.progress_pct}%
        </p>
      ) : null}
      {view.delays.length ? (
        <p className="rounded-2xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-950">
          {view.delays.length} task{view.delays.length === 1 ? '' : 's'} behind the locked plan.
        </p>
      ) : null}
      <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm [scrollbar-width:thin]">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-[9.5rem_1fr] border-b border-slate-100 text-[10px] font-bold uppercase tracking-wide text-slate-500">
            <div className="px-3 py-2">Task</div>
            <div className="relative h-8" style={{ width }}>
              {Array.from({ length: bounds.span }, (_, index) => (
                <span
                  key={index}
                  className="absolute top-2 text-[10px]"
                  style={{ left: index * dayWidth }}
                >
                  {labelDay(bounds.start, index)}
                </span>
              ))}
            </div>
          </div>
          <ul>
            {view.tasks.map((task) => {
              const plan = bar(bounds.start, task.plan_start, task.plan_end, dayWidth);
              const actual = bar(bounds.start, task.actual_start || task.start, forecastEnd(task), dayWidth);
              const variance = varianceDays(task);
              const member = members.find((row) => row.id === task.assignee_id);
              const late = variance > 0;
              return (
                <li key={task.id} className="grid grid-cols-[9.5rem_1fr] border-b border-slate-50" data-testid={`gantt-${task.id}`}>
                  <div className="px-3 py-3">
                    <p className="text-sm font-bold text-slate-900">
                      {task.vo_number ? <span className="mr-1 rounded bg-amber-100 px-1 text-[10px] text-amber-950">{task.vo_number}</span> : null}
                      {task.name}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {member?.name || 'Unassigned'}
                      {task.kind === 'milestone' ? ' · Milestone' : ` · ${task.progress_pct}%`}
                      {variance ? ` · ${variance > 0 ? '+' : ''}${variance}d` : ''}
                    </p>
                    {readOnly ? null : (
                      <div className="mt-1 flex gap-1">
                        <button type="button" className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-bold whitespace-nowrap" onClick={() => onShift?.(task.id, -1)} aria-label={`−1d, move ${task.name} earlier`}>
                          −1d
                        </button>
                        <button type="button" className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-bold whitespace-nowrap" onClick={() => onShift?.(task.id, 1)} aria-label={`+1d, move ${task.name} later`}>
                          +1d
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="relative h-16" style={{ width }}>
                    <div
                      className="absolute top-3 h-3 rounded-full bg-slate-300"
                      style={{ left: plan.left, width: plan.width }}
                      title="Plan"
                    />
                    {task.kind === 'milestone' ? (
                      <span
                        className="absolute top-6 h-3 w-3 rotate-45 border border-slate-700 bg-white"
                        style={{ left: actual.left }}
                        title="Milestone"
                      />
                    ) : (
                      <button
                        type="button"
                        disabled={readOnly}
                        className={`absolute top-7 h-3 rounded-full ${late ? 'bg-amber-500' : 'bg-[#00b4d8]'} ${task.vo_number ? 'ring-2 ring-amber-700 ring-offset-1' : ''} disabled:cursor-default`}
                        style={{ left: actual.left, width: Math.max(actual.width, 12) }}
                        aria-label={`${task.name} actual bar`}
                        onPointerDown={(event) => {
                          if (readOnly) return;
                          drag.current = { id: task.id, x: event.clientX };
                          (event.target as HTMLElement).setPointerCapture(event.pointerId);
                        }}
                        onPointerUp={(event) => {
                          if (!drag.current || drag.current.id !== task.id) return;
                          const days = Math.round((event.clientX - drag.current.x) / dayWidth);
                          drag.current = null;
                          if (days) onShift?.(task.id, days);
                        }}
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      <p className="text-xs text-slate-600">Grey is the locked plan. Colour is actual or forecast. Amber means the finish is later than the plan.</p>
      {view.upcoming.length ? (
        <p className="text-sm text-slate-700">
          Upcoming: {view.upcoming.map((task) => `${task.name} (${task.plan_start})`).join(' · ')}
        </p>
      ) : null}
    </div>
  );
}

function bar(origin: string, start: string, end: string, dayWidth: number) {
  const left = Math.max(0, Math.round((Date.parse(`${start}T00:00:00Z`) - Date.parse(`${origin}T00:00:00Z`)) / DAY)) * dayWidth;
  const days = Math.max(1, Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY) + 1);
  return { left, width: days * dayWidth - 6 };
}

function labelDay(origin: string, index: number) {
  const t = Date.parse(`${origin}T00:00:00Z`) + index * DAY;
  return new Date(t).toISOString().slice(8, 10);
}
