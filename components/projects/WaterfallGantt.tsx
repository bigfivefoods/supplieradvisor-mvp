'use client';

import { ganttPct, isoDay, monthTicks } from '@/lib/projects/waterfall';

export type GanttBar = {
  id: string;
  label: string;
  start: string;
  end: string;
  progress?: number;
  tone?: 'cyan' | 'emerald' | 'amber' | 'rose' | 'slate' | 'violet';
  subtitle?: string;
};

export type GanttGroup = {
  id: string;
  title: string;
  subtitle?: string;
  bars: GanttBar[];
};

const TONE: Record<NonNullable<GanttBar['tone']>, string> = {
  cyan: 'bg-[#00b4d8]',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  slate: 'bg-slate-400',
  violet: 'bg-violet-500',
};

export function WaterfallGantt({
  groups,
  from,
  to,
  onSelect,
}: {
  groups: GanttGroup[];
  from: string;
  to: string;
  onSelect?: (groupId: string, barId?: string) => void;
}) {
  const ticks = monthTicks(from, to);
  const today = isoDay(new Date());
  const todayPct =
    today >= from.slice(0, 10) && today <= to.slice(0, 10)
      ? ganttPct(today, from, to)
      : null;

  if (!groups.length) {
    return (
      <p className="rounded-[1.5rem] border border-white/70 bg-white/90 p-6 text-sm text-neutral-500">
        No projects in this slice. Create one to see the waterfall.
      </p>
    );
  }

  return (
    <div className="rounded-[1.5rem] border border-white/70 bg-white/90 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-neutral-400">
          Waterfall Gantt
        </p>
        <p className="text-[11px] text-neutral-500 tabular-nums">
          {from.slice(0, 10)} → {to.slice(0, 10)}
        </p>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[40rem]">
          <div className="relative h-8 border-b border-slate-100 mx-4">
            {ticks.map((t) => (
              <span
                key={t.iso}
                className="absolute top-1.5 -translate-x-1/2 text-[10px] font-bold uppercase tracking-wider text-neutral-400"
                style={{ left: `${t.pct}%` }}
              >
                {t.label}
              </span>
            ))}
            {todayPct != null ? (
              <span
                className="absolute top-0 bottom-0 w-px bg-rose-400"
                style={{ left: `${todayPct}%` }}
                title="Today"
              />
            ) : null}
          </div>
          <ul className="divide-y divide-slate-50">
            {groups.map((g) => (
              <li key={g.id} className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => onSelect?.(g.id)}
                  className="text-left w-full mb-2"
                >
                  <p className="text-sm font-black text-slate-900 truncate">{g.title}</p>
                  {g.subtitle ? (
                    <p className="text-[11px] text-neutral-500">{g.subtitle}</p>
                  ) : null}
                </button>
                <div
                  className="relative"
                  style={{ height: Math.max(1, g.bars.length) * 26 }}
                >
                  {todayPct != null ? (
                    <span
                      className="absolute inset-y-0 w-px bg-rose-200"
                      style={{ left: `${todayPct}%` }}
                    />
                  ) : null}
                  {g.bars.map((bar, i) => {
                    const left = ganttPct(bar.start, from, to);
                    const right = ganttPct(bar.end, from, to);
                    const width = Math.max(1.5, right - left);
                    return (
                      <button
                        key={bar.id}
                        type="button"
                        title={`${bar.label} · ${bar.start} → ${bar.end}`}
                        onClick={() => onSelect?.(g.id, bar.id)}
                        className="absolute h-5 rounded-full overflow-hidden border border-white/60 shadow-sm text-left"
                        style={{
                          top: i * 26,
                          left: `${left}%`,
                          width: `${width}%`,
                        }}
                      >
                        <span className={`absolute inset-0 ${TONE[bar.tone || 'cyan']} opacity-80`} />
                        {bar.progress != null ? (
                          <span
                            className="absolute inset-y-0 left-0 bg-black/20"
                            style={{ width: `${Math.max(0, Math.min(100, bar.progress))}%` }}
                          />
                        ) : null}
                        <span className="relative z-[1] px-2 text-[10px] font-bold text-white truncate block leading-5">
                          {bar.label}
                          {bar.subtitle ? ` · ${bar.subtitle}` : ''}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
