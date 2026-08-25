/**
 * Goal trend series and period windows for the member PWA chart.
 */

export type GoalPeriodKey = '1w' | '1m' | '3m' | '6m' | '12m' | 'custom';

export const GOAL_PERIOD_CHIPS: Array<{ id: GoalPeriodKey; label: string }> = [
  { id: '1w', label: '1W' },
  { id: '1m', label: '1M' },
  { id: '3m', label: '3M' },
  { id: '6m', label: '6M' },
  { id: '12m', label: '12M' },
  { id: 'custom', label: 'Custom' },
];

const PERIOD_DAYS: Record<Exclude<GoalPeriodKey, 'custom'>, number> = {
  '1w': 7,
  '1m': 30,
  '3m': 90,
  '6m': 183,
  '12m': 365,
};

export type GoalChartPoint = { t: number; v: number };

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function parseIsoDay(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '').trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
  return Number.isFinite(d.getTime()) ? d : null;
}

export function shiftIsoDay(iso: string, days: number): string {
  const d = parseIsoDay(iso) || new Date();
  d.setDate(d.getDate() + days);
  return isoDay(d);
}

export function goalPeriodRange(
  key: GoalPeriodKey,
  opts?: { now?: Date; customFrom?: string; customTo?: string }
): { from: string; to: string } {
  const now = opts?.now || new Date();
  const to = isoDay(now);
  if (key === 'custom') {
    const from = parseIsoDay(opts?.customFrom || '')
      ? String(opts?.customFrom)
      : shiftIsoDay(to, -89);
    const end = parseIsoDay(opts?.customTo || '') ? String(opts?.customTo) : to;
    return from <= end ? { from, to: end } : { from: end, to: from };
  }
  const days = PERIOD_DAYS[key];
  return { from: shiftIsoDay(to, -(days - 1)), to };
}

export function parseStamp(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = parseIsoDay(s);
    return d ? d.getTime() : null;
  }
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

export function buildStampSeries(
  rows: Array<{ at?: string | null; value?: number | null }>
): GoalChartPoint[] {
  return rows
    .map((r) => ({
      t: parseStamp(r.at),
      v:
        r.value != null && Number.isFinite(Number(r.value))
          ? Number(r.value)
          : null,
    }))
    .filter((p): p is GoalChartPoint => p.t != null && p.v != null)
    .sort((a, b) => a.t - b.t);
}

export function buildGoalSeries(goal: {
  start_value?: number | null;
  start_date?: string | null;
  actual?: number | null;
  check_ins?: Array<{ at: string; metric_value?: number | null }>;
}): GoalChartPoint[] {
  const pts: GoalChartPoint[] = [];
  const checks = [...(goal.check_ins || [])]
    .map((c) => ({
      t: parseStamp(c.at),
      v:
        c.metric_value != null && Number.isFinite(Number(c.metric_value))
          ? Number(c.metric_value)
          : null,
    }))
    .filter((p): p is { t: number; v: number } => p.t != null && p.v != null)
    .sort((a, b) => a.t - b.t);

  if (goal.start_value != null && Number.isFinite(Number(goal.start_value))) {
    const startT =
      parseStamp(goal.start_date) ??
      (checks[0] ? checks[0].t : Date.now());
    pts.push({ t: startT, v: Number(goal.start_value) });
  }
  for (const c of checks) pts.push(c);

  if (
    goal.actual != null &&
    Number.isFinite(Number(goal.actual)) &&
    (pts.length === 0 || pts[pts.length - 1].v !== Number(goal.actual))
  ) {
    pts.push({ t: Date.now(), v: Number(goal.actual) });
  }

  pts.sort((a, b) => a.t - b.t);
  const out: GoalChartPoint[] = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (last && last.t === p.t) out[out.length - 1] = p;
    else out.push(p);
  }
  return out;
}

/** Points in [from,to], with a carry-in from the last value before `from`. */
export function sliceGoalSeries(
  points: GoalChartPoint[],
  fromMs: number,
  toMs: number
): GoalChartPoint[] {
  if (!points.length || fromMs > toMs) return [];
  const inRange = points.filter((p) => p.t >= fromMs && p.t <= toMs);
  const before = points.filter((p) => p.t < fromMs);
  const carry = before.length ? before[before.length - 1] : null;
  const out: GoalChartPoint[] = [];
  if (carry) out.push({ t: fromMs, v: carry.v });
  for (const p of inRange) {
    const last = out[out.length - 1];
    if (last && last.t === p.t) out[out.length - 1] = p;
    else out.push(p);
  }
  return out;
}

export function goalYDomain(
  values: number[],
  target?: number | null
): { min: number; max: number } {
  const nums = values.filter((n) => Number.isFinite(n));
  if (target != null && Number.isFinite(target)) nums.push(Number(target));
  if (!nums.length) return { min: 0, max: 1 };
  let min = Math.min(...nums);
  let max = Math.max(...nums);
  if (min === max) {
    const pad = Math.abs(min) * 0.08 || 1;
    return { min: min - pad, max: max + pad };
  }
  const pad = (max - min) * 0.12;
  return { min: min - pad, max: max + pad };
}

export function formatGoalTick(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  const d = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
  return n.toFixed(d);
}

export function formatGoalDay(isoOrMs: string | number): string {
  const d =
    typeof isoOrMs === 'number'
      ? new Date(isoOrMs)
      : parseIsoDay(isoOrMs) || new Date(isoOrMs);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
