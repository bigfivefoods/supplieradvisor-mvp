/** Generic waterfall phases for joint customer / supplier projects. */

export const WATERFALL_PHASES = [
  {
    key: 'initiate',
    label: 'Initiate',
    short: '1',
    desc: 'Scope, sponsor, kick-off',
  },
  {
    key: 'plan',
    label: 'Plan',
    short: '2',
    desc: 'Work breakdown, dates, resources',
  },
  {
    key: 'execute',
    label: 'Execute',
    short: '3',
    desc: 'Build and deliver the work',
  },
  {
    key: 'verify',
    label: 'Verify',
    short: '4',
    desc: 'Acceptance, quality, OTIFEF',
  },
  {
    key: 'close',
    label: 'Close',
    short: '5',
    desc: 'Handover, lessons, sign-off',
  },
] as const;

export type WaterfallPhaseKey = (typeof WATERFALL_PHASES)[number]['key'];

export const WATERFALL_PHASE_KEYS = WATERFALL_PHASES.map((p) => p.key);

export function isWaterfallPhase(v: unknown): v is WaterfallPhaseKey {
  return typeof v === 'string' && WATERFALL_PHASE_KEYS.includes(v as WaterfallPhaseKey);
}

export function waterfallPhaseMeta(key: string) {
  return WATERFALL_PHASES.find((p) => p.key === key) || WATERFALL_PHASES[0];
}

function parseDay(iso: string): Date {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number): string {
  const d = parseDay(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return isoDay(d);
}

export function daysBetween(from: string, to: string): number {
  const a = parseDay(from).getTime();
  const b = parseDay(to).getTime();
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

export function dateRangeOverlaps(
  start: string | null | undefined,
  end: string | null | undefined,
  from: string,
  to: string
): boolean {
  const s = (start || from).slice(0, 10);
  const e = (end || to).slice(0, 10);
  return s <= to && e >= from;
}

export type WaterfallWindow = {
  key: WaterfallPhaseKey;
  label: string;
  start: string;
  end: string;
  sort_order: number;
};

/** Split a project window into sequential waterfall phases. */
export function waterfallWindows(startIso: string, endIso: string): WaterfallWindow[] {
  let start = startIso.slice(0, 10);
  let end = endIso.slice(0, 10);
  if (end < start) {
    const tmp = start;
    start = end;
    end = tmp;
  }
  const n = WATERFALL_PHASES.length;
  const span = Math.max(n, daysBetween(start, end) + 1);
  const chunk = Math.max(1, Math.floor(span / n));
  return WATERFALL_PHASES.map((p, i) => {
    const s = addDays(start, i * chunk);
    const e = i === n - 1 ? end : addDays(start, (i + 1) * chunk - 1);
    return {
      key: p.key,
      label: p.label,
      start: s,
      end: e < s ? s : e,
      sort_order: i,
    };
  });
}

export type SeededWaterfallTask = {
  title: string;
  phase_key: WaterfallPhaseKey;
  start_date: string;
  due_date: string;
  sort_order: number;
  column_key: 'todo';
  status: 'todo';
};

export function seedWaterfallTasks(startIso: string, endIso: string): SeededWaterfallTask[] {
  return waterfallWindows(startIso, endIso).map((w) => ({
    title: w.label,
    phase_key: w.key,
    start_date: w.start,
    due_date: w.end,
    sort_order: w.sort_order,
    column_key: 'todo' as const,
    status: 'todo' as const,
  }));
}

/** 0–100 position of a date on a timeline. */
export function ganttPct(iso: string, from: string, to: string): number {
  const t = parseDay(iso).getTime();
  const a = parseDay(from).getTime();
  const b = parseDay(to).getTime();
  if (b <= a) return 0;
  return Math.max(0, Math.min(100, ((t - a) / (b - a)) * 100));
}

export function monthTicks(from: string, to: string): Array<{ iso: string; label: string; pct: number }> {
  const ticks: Array<{ iso: string; label: string; pct: number }> = [];
  const start = parseDay(from);
  const end = parseDay(to);
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  while (cursor.getTime() <= end.getTime()) {
    const iso = isoDay(cursor);
    if (iso >= from.slice(0, 10) && iso <= to.slice(0, 10)) {
      ticks.push({
        iso,
        label: cursor.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' }),
        pct: ganttPct(iso, from, to),
      });
    }
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  if (!ticks.length) {
    ticks.push({ iso: from.slice(0, 10), label: from.slice(0, 7), pct: 0 });
  }
  return ticks;
}
