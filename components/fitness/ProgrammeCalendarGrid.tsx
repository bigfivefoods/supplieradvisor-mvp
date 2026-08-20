'use client';

import {
  PROGRAMME_WEEKDAYS,
  type FitMovement,
  type FitProgrammeBlock,
} from '@/lib/fitness/movements';
import type { FitProgrammeLog } from '@/lib/fitness/programme-follow';
import { blockCalendarDate } from '@/lib/fitness/programme-follow';

export function ProgrammeCalendarGrid({
  weeks,
  blocks,
  movements,
  startDate,
  today,
  logs,
  selected,
  onSelect,
  mode = 'build',
}: {
  weeks: number;
  blocks: FitProgrammeBlock[];
  movements?: FitMovement[];
  startDate?: string;
  today?: string;
  logs?: FitProgrammeLog[];
  selected?: { week: number; weekday: number } | null;
  onSelect?: (
    week: number,
    weekday: number,
    block: FitProgrammeBlock | null,
    date?: string
  ) => void;
  mode?: 'build' | 'follow' | 'view';
}) {
  const wCount = Math.max(1, Math.min(52, Number(weeks) || 1));
  const logByBlock = new Map((logs || []).map((l) => [l.block_id, l]));
  const nameOf = (id: string) =>
    movements?.find((m) => m.id === id)?.name || 'Movement';

  return (
    <div className="overflow-x-auto rounded-2xl border border-yellow-200 bg-white dark:border-yellow-800 dark:bg-yellow-950/20">
      <table className="w-full min-w-[640px] border-collapse text-xs">
        <thead>
          <tr className="bg-yellow-50 text-[10px] font-black uppercase tracking-wider text-yellow-900 dark:bg-yellow-900/40 dark:text-yellow-100">
            <th className="w-10 px-1.5 py-2 text-left">Wk</th>
            {PROGRAMME_WEEKDAYS.map((d) => (
              <th key={d.n} className="px-1 py-2 text-center">
                {d.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: wCount }, (_, i) => i + 1).map((week) => (
            <tr key={week} className="border-t border-yellow-100 dark:border-yellow-900/50">
              <td className="px-1.5 py-1 font-black text-yellow-800 dark:text-yellow-200">
                {week}
              </td>
              {PROGRAMME_WEEKDAYS.map((d) => {
                const block =
                  blocks.find(
                    (b) => b.week === week && b.weekday === d.n
                  ) || null;
                const date = startDate
                  ? blockCalendarDate(startDate, { week, weekday: d.n })
                  : undefined;
                const log = block ? logByBlock.get(block.id) || null : null;
                const isSel =
                  selected?.week === week && selected?.weekday === d.n;
                const isToday = today && date === today;
                const nMoves = (block?.items || []).length;
                let tone =
                  'bg-slate-50/80 hover:bg-yellow-50 dark:bg-slate-900/40';
                if (nMoves) {
                  tone =
                    'bg-yellow-50 hover:bg-yellow-100 dark:bg-yellow-950/50';
                }
                if (log?.status === 'done') {
                  tone = 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40';
                } else if (log?.status === 'skipped') {
                  tone = 'bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40';
                } else if (log?.status === 'partial') {
                  tone = 'bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40';
                }
                if (isToday) tone += ' ring-2 ring-yellow-400 ring-inset';
                if (isSel) tone += ' outline outline-2 outline-yellow-600';

                const inner = (
                  <>
                    {date && (mode === 'follow' || mode === 'view') ? (
                      <p className="text-[10px] font-bold text-slate-400">
                        {date.slice(8, 10)}
                      </p>
                    ) : null}
                    {block ? (
                      <>
                        <p className="font-bold text-slate-900 dark:text-yellow-50 line-clamp-2">
                          {block.title ||
                            (nMoves
                              ? nameOf(block.items[0].movement_id)
                              : 'Session')}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {nMoves
                            ? `${nMoves} move${nMoves === 1 ? '' : 's'}`
                            : 'Empty'}
                          {log?.feeling
                            ? ` · feel ${log.feeling}/5`
                            : ''}
                          {log?.rpe ? ` · RPE ${log.rpe}` : ''}
                        </p>
                      </>
                    ) : mode === 'build' ? (
                      <p className="text-[10px] font-bold text-slate-400">
                        + add
                      </p>
                    ) : (
                      <p className="text-[10px] text-slate-300">Rest</p>
                    )}
                  </>
                );

                return (
                  <td key={d.n} className="p-0.5 align-top">
                    {onSelect && mode !== 'view' ? (
                      <button
                        type="button"
                        onClick={() =>
                          onSelect(week, d.n, block, date)
                        }
                        className={`min-h-[4.5rem] w-full rounded-xl px-1.5 py-1.5 text-left ${tone}`}
                      >
                        {inner}
                      </button>
                    ) : (
                      <div
                        className={`min-h-[4.5rem] w-full rounded-xl px-1.5 py-1.5 ${tone}`}
                      >
                        {inner}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
