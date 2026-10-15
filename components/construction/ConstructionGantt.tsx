'use client';

import { useMemo, useRef } from 'react';
import { AlertTriangle, Diamond } from 'lucide-react';
import { ConstructionEmpty } from '@/components/construction/ConstructionUi';
import { addDaysIso, type ConstructionProgrammeRow } from '@/lib/construction/constructiongraph';
import { formatSastDate } from '@/lib/construction/format';
import { criticalPathIds, forecastEnd, isDelayed, reviseEnd } from '@/lib/construction/programme-model';

const DAY = 86_400_000;

function parse(iso?: string | null) {
  if (!iso) return null;
  const t = Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
  return Number.isFinite(t) ? t : null;
}

export function ConstructionGantt({
  rows,
  today,
  readOnly = false,
  onShift,
}: {
  rows: ConstructionProgrammeRow[];
  today: string;
  readOnly?: boolean;
  onShift?: (rowId: string, days: number) => void;
}) {
  const drag = useRef<{ id: string; x: number } | null>(null);
  const critical = useMemo(() => new Set(criticalPathIds(rows)), [rows]);
  const layout = useMemo(() => {
    const stamps = rows.flatMap((row) =>
      [row.planned_start, row.planned_end, row.baseline_start, row.baseline_end, row.actual_start, row.actual_end, reviseEnd(row).revisedEnd, forecastEnd(row, today), today]
        .map(parse)
        .filter((value): value is number => value != null)
    );
    const origin = stamps.length ? Math.min(...stamps) : parse(today) || Date.now();
    const end = stamps.length ? Math.max(...stamps) : origin;
    const span = Math.max(14, Math.round((end - origin) / DAY) + 3);
    return { origin, span };
  }, [rows, today]);

  if (!rows.length) {
    return (
      <ConstructionEmpty
        testId="gantt-empty"
        title="No programme yet"
        hint="Add a task to see the plan, the baseline, and any extension of time."
        icon={<Diamond />}
        action={null}
      />
    );
  }

  const byId = new Map(rows.map((row) => [row.id, row]));
  const todayLeft = Math.max(0, Math.min(97, (((parse(today) || layout.origin) - layout.origin) / DAY / layout.span) * 100));

  const bar = (start?: string | null, end?: string | null) => {
    const a = parse(start);
    const b = parse(end || start);
    if (a == null || b == null) return null;
    const left = Math.max(0, Math.min(96, ((a - layout.origin) / DAY / layout.span) * 100));
    const days = Math.max(1, (b - a) / DAY + 1);
    const room = Math.max(0, 98 - left);
    const width = Math.min(Math.max((days / layout.span) * 100, Math.min(1.5, room)), room);
    return { left: `${left}%`, width: `${width}%` };
  };

  return (
    <div className="space-y-3" data-testid="programme-gantt">
      <div className="hidden overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm sm:block" data-testid="gantt-chart">
        <div>
          <div className="grid grid-cols-[11rem_minmax(0,1fr)] border-b border-slate-100 text-[10px] font-bold uppercase tracking-wide text-slate-500">
            <div className="px-3 py-2">Activity</div>
            <div className="relative h-8">
              <span
                data-testid="gantt-today"
                className="absolute top-0 h-full w-px bg-[#00b4d8] text-[#0f172a]"
                style={{ left: `${todayLeft}%` }}
                title="Today"
              />
            </div>
          </div>
          <ul>
            {rows.map((row) => {
              const plan = bar(row.planned_start || row.start_date, row.planned_end || row.end_date);
              const baseline = bar(row.baseline_start, row.baseline_end);
              const actual = bar(row.actual_start || row.planned_start, forecastEnd(row, today));
              const revised = reviseEnd(row);
              const late = isDelayed(row, today);
              const deps = (row.depends_on || []).filter((id) => byId.has(id));
              return (
                <li
                  key={row.id}
                  data-row-id={row.id}
                  data-critical={critical.has(row.id) ? '1' : '0'}
                  className={`grid grid-cols-[11rem_minmax(0,1fr)] border-b border-slate-50 ${critical.has(row.id) ? 'bg-sky-50/40' : ''}`}
                >
                  <div className="px-3 py-3">
                    <p className="text-sm font-bold text-slate-900">{row.activity}</p>
                    <p className="text-[11px] text-slate-500">
                      {row.kind === 'milestone' ? 'Milestone' : `${Math.round(Number(row.actual_pct ?? row.pct_complete ?? 0))}%`}
                      {late ? ' · Delayed' : ''}
                      {revised.eotDays ? ` · +${revised.eotDays}d` : ''}
                    </p>
                    {readOnly ? null : (
                      <div className="mt-1 flex gap-1">
                        <button type="button" className="inline-flex min-h-11 items-center rounded-full border border-slate-200 px-2 text-[10px] font-bold" onClick={() => onShift?.(row.id, -1)} aria-label={`Move ${row.activity} earlier`}>
                          −1d
                        </button>
                        <button type="button" className="inline-flex min-h-11 items-center rounded-full border border-slate-200 px-2 text-[10px] font-bold" onClick={() => onShift?.(row.id, 1)} aria-label={`Move ${row.activity} later`}>
                          +1d
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="relative h-16 overflow-hidden pr-3">
                    {baseline ? (
                      <div data-testid="gantt-baseline" className="absolute top-2 h-2 rounded-full bg-slate-200" style={{ left: baseline.left, width: baseline.width }} title="Baseline" />
                    ) : null}
                    {plan ? (
                      <div className="absolute top-5 h-2 rounded-full bg-slate-300" style={{ left: plan.left, width: plan.width }} title="Plan" />
                    ) : null}
                    {row.kind === 'milestone' ? (
                      <span data-testid="gantt-milestone" className="absolute top-4 inline-flex items-center gap-1 text-[#0f172a]" style={{ left: (plan || actual)?.left || 0 }} title="Milestone">
                        <Diamond className="h-5 w-5 fill-[#00b4d8] text-[#0f172a]" />
                        <span className="text-[11px] font-black">Milestone</span>
                      </span>
                    ) : actual ? (
                      <button
                        type="button"
                        disabled={readOnly}
                        className={`absolute top-8 h-3 max-w-full rounded-full ${late ? 'bg-orange-500 text-[#0f172a]' : 'bg-[#00b4d8] text-[#0f172a]'} disabled:cursor-default`}
                        style={{ left: actual.left, width: actual.width }}
                        aria-label={`${row.activity} actual bar`}
                        onPointerDown={(event) => {
                          if (readOnly) return;
                          drag.current = { id: row.id, x: event.clientX };
                        }}
                        onPointerUp={(event) => {
                          if (!drag.current || drag.current.id !== row.id) return;
                          const track = event.currentTarget.parentElement?.clientWidth || 280;
                          const dayWidth = Math.max(8, track / layout.span);
                          const days = Math.round((event.clientX - drag.current.x) / dayWidth);
                          drag.current = null;
                          if (days) onShift?.(row.id, days);
                        }}
                      />
                    ) : null}
                    {revised.eotDays > 0 ? (
                      <span data-testid="gantt-eot" className="absolute top-1 text-[10px] font-black text-orange-800" style={{ left: plan ? `min(calc(${plan.left} + ${plan.width}), calc(100% - 4.5rem))` : '0%' }}>
                        EOT +{revised.eotDays}d
                      </span>
                    ) : null}
                    {deps.map((dep) => (
                      <span key={dep} data-testid="gantt-dependency" className="sr-only">
                        Depends on {byId.get(dep)?.activity}
                      </span>
                    ))}
                    {late ? <AlertTriangle className="absolute right-2 top-2 h-3 w-3 text-orange-800" aria-label="Delayed" /> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      <ol className="space-y-2 sm:hidden" data-testid="gantt-mobile-list">
        <li data-testid="gantt-today" className="text-xs font-bold text-[#0f172a]">
          Today {today}
        </li>
        {rows.map((row) => {
          const revised = reviseEnd(row);
          const late = isDelayed(row, today);
          return (
            <li key={row.id} data-row-id={row.id} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <p className="text-sm font-black text-slate-900">{row.activity}</p>
              <p className="text-xs text-slate-600">
                {row.planned_start || '—'} → {revised.revisedEnd || row.planned_end || '—'}
                {late ? ' · Delayed' : ''}
              </p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-[#00b4d8] text-[#0f172a]"
                  style={{ width: `${Math.max(6, Math.min(100, Number(row.actual_pct ?? row.pct_complete ?? 0)))}%` }}
                />
              </div>
              {row.baseline_start ? <p data-testid="gantt-baseline" className="mt-1 text-[11px] text-slate-500">Baseline {row.baseline_start}</p> : null}
              {row.kind === 'milestone' ? <p data-testid="gantt-milestone" className="text-[11px] font-bold">Milestone</p> : null}
              {(row.depends_on || []).filter((id) => byId.has(id)).map((id) => (
                <p key={id} data-testid="gantt-dependency" className="text-[11px] text-slate-600">
                  After {byId.get(id)?.activity}
                </p>
              ))}
              {revised.eotDays > 0 ? (
                <p data-testid="gantt-eot" className="text-[11px] font-black text-orange-800">
                  EOT +{revised.eotDays}d · revised end {revised.revisedEnd}
                </p>
              ) : null}
              {readOnly ? null : (
                <div className="mt-2 flex gap-2">
                  <button type="button" className="inline-flex min-h-11 items-center rounded-2xl border border-slate-200 px-3 text-xs font-bold" onClick={() => onShift?.(row.id, -1)}>−1d</button>
                  <button type="button" className="inline-flex min-h-11 items-center rounded-2xl border border-slate-200 px-3 text-xs font-bold" onClick={() => onShift?.(row.id, 1)}>+1d</button>
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-slate-600">
        Grey is the plan. The pale bar is the baseline. Cyan is actual or forecast. An extension of time sits beside the bar and does not move the planned dates.
      </p>
      <p className="sr-only">{addDaysIso(today, 0)}</p>
    </div>
  );
}

export function ConstructionTimeline({ rows }: { rows: ConstructionProgrammeRow[] }) {
  const sorted = rows
    .slice()
    .sort((a, b) => String(a.planned_start || a.start_date || '').localeCompare(String(b.planned_start || b.start_date || '')));
  if (!sorted.length) return null;
  return (
    <ol className="space-y-2" data-testid="schedule-timeline">
      {sorted.map((row) => (
        <li key={row.id} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xs font-black text-[#0f172a]">{formatSastDate(row.planned_start || row.start_date)}</p>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 font-black text-[#0f172a]">
              {row.kind === 'milestone' ? <Diamond className="h-4 w-4 fill-[#00b4d8] text-[#0f172a]" aria-hidden /> : null}
              {row.activity}
            </p>
            <p className="text-xs text-slate-600">
              {row.kind === 'milestone' ? 'Milestone' : 'Task'} · {formatSastDate(row.planned_start || row.start_date)} to {formatSastDate(row.planned_end || row.end_date)}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
