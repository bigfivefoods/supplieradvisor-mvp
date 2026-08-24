'use client';

import { useId, useMemo } from 'react';
import { advisorBrandInk } from '@/lib/advisors/brand-ink';
import type { MemberGoalView } from '@/lib/fitness/member-goals';
import {
  GOAL_PERIOD_CHIPS,
  buildGoalSeries,
  formatGoalDay,
  formatGoalTick,
  goalPeriodRange,
  goalYDomain,
  sliceGoalSeries,
  type GoalPeriodKey,
} from '@/lib/fitness/goal-chart';

export function GoalPeriodPicker({
  period,
  onPeriod,
  customFrom,
  customTo,
  onCustomFrom,
  onCustomTo,
  color,
}: {
  period: GoalPeriodKey;
  onPeriod: (k: GoalPeriodKey) => void;
  customFrom: string;
  customTo: string;
  onCustomFrom: (v: string) => void;
  onCustomTo: (v: string) => void;
  color: string;
}) {
  const ink = advisorBrandInk(color);
  const range = goalPeriodRange(period, { customFrom, customTo });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
            Over time
          </p>
          {period !== 'custom' ? (
            <p className="text-[11px] font-semibold text-slate-500">
              {formatGoalDay(range.from)} – {formatGoalDay(range.to)}
            </p>
          ) : null}
        </div>
        <div
          className="inline-flex max-w-full shrink-0 overflow-x-auto rounded-full border border-slate-200/90 bg-slate-50/80 p-0.5 shadow-inner dark:border-white/10 dark:bg-white/5"
          role="radiogroup"
          aria-label="Goal period"
        >
          {GOAL_PERIOD_CHIPS.map((k) => {
            const on = period === k.id;
            return (
              <button
                key={k.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => {
                  if (k.id === 'custom' && period !== 'custom') {
                    const cur = goalPeriodRange(period, { customFrom, customTo });
                    if (!customFrom) onCustomFrom(cur.from);
                    if (!customTo) onCustomTo(cur.to);
                  }
                  onPeriod(k.id);
                }}
                className={`min-h-8 shrink-0 rounded-full px-2.5 text-[10px] font-black tracking-wide transition ${
                  on
                    ? 'shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                }`}
                style={on ? { backgroundColor: color, color: ink } : undefined}
              >
                {k.label}
              </button>
            );
          })}
        </div>
      </div>
      {period === 'custom' ? (
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">
              From
            </span>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => onCustomFrom(e.target.value)}
              className="mt-1 min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold tabular-nums dark:border-white/10 dark:bg-neutral-950"
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">
              To
            </span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => onCustomTo(e.target.value)}
              className="mt-1 min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold tabular-nums dark:border-white/10 dark:bg-neutral-950"
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}

export function GoalSparkline({
  goal,
  period,
  customFrom,
  customTo,
  color,
}: {
  goal: MemberGoalView;
  period: GoalPeriodKey;
  customFrom: string;
  customTo: string;
  color: string;
}) {
  const uid = useId().replace(/:/g, '');
  const range = goalPeriodRange(period, { customFrom, customTo });
  const fromMs = new Date(`${range.from}T00:00:00`).getTime();
  const toMs = new Date(`${range.to}T23:59:59`).getTime();

  const sliced = useMemo(() => {
    const all = buildGoalSeries(goal);
    return sliceGoalSeries(all, fromMs, toMs);
  }, [goal, fromMs, toMs]);

  const target =
    goal.target_value != null && Number.isFinite(goal.target_value)
      ? goal.target_value
      : null;
  const domain = goalYDomain(
    sliced.map((p) => p.v),
    target
  );

  const W = 320;
  const H = 132;
  const L = 34;
  const R = 10;
  const T = 12;
  const B = 22;
  const pw = W - L - R;
  const ph = H - T - B;
  const spanX = Math.max(1, toMs - fromMs);
  const spanY = Math.max(1e-9, domain.max - domain.min);
  const xOf = (t: number) => L + ((t - fromMs) / spanX) * pw;
  const yOf = (v: number) => T + ((domain.max - v) / spanY) * ph;

  const line =
    sliced.length >= 1
      ? sliced
          .map((p, i) => `${i === 0 ? 'M' : 'L'}${xOf(p.t).toFixed(1)},${yOf(p.v).toFixed(1)}`)
          .join(' ')
      : '';
  const area = line
    ? `${line} L${xOf(sliced[sliced.length - 1].t).toFixed(1)},${(T + ph).toFixed(1)} L${xOf(sliced[0].t).toFixed(1)},${(T + ph).toFixed(1)} Z`
    : '';
  const targetY = target != null ? yOf(target) : null;
  const unit = goal.unit ? ` ${goal.unit}` : '';
  const last = sliced[sliced.length - 1];
  const first = sliced[0];
  const delta =
    first && last && sliced.length > 1 ? last.v - first.v : null;
  const toGo =
    last && target != null ? target - last.v : null;

  return (
    <div className="space-y-1.5">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-[132px] w-full"
        role="img"
        aria-label={`${goal.title} trend`}
      >
        <defs>
          <linearGradient id={`gfill-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((f) => {
          const y = T + ph * f;
          const v = domain.max - spanY * f;
          return (
            <g key={f}>
              <line
                x1={L}
                x2={W - R}
                y1={y}
                y2={y}
                className="stroke-slate-200 dark:stroke-white/10"
                strokeWidth={1}
              />
              <text
                x={L - 4}
                y={y + 3}
                textAnchor="end"
                className="fill-slate-400"
                fontSize={8}
                fontWeight={700}
              >
                {formatGoalTick(v)}
              </text>
            </g>
          );
        })}
        {targetY != null ? (
          <g>
            <line
              x1={L}
              x2={W - R}
              y1={targetY}
              y2={targetY}
              stroke={color}
              strokeWidth={1.25}
              strokeDasharray="4 3"
              opacity={0.85}
            />
            <text
              x={W - R}
              y={targetY - 4}
              textAnchor="end"
              fill={color}
              fontSize={8}
              fontWeight={800}
            >
              Target {formatGoalTick(target!)}
              {unit}
            </text>
          </g>
        ) : null}
        {area ? (
          <path d={area} fill={`url(#gfill-${uid})`} />
        ) : null}
        {line ? (
          <path
            d={line}
            fill="none"
            stroke={color}
            strokeWidth={2.25}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}
        {sliced.map((p) => (
          <g key={`${p.t}-${p.v}`}>
            <circle cx={xOf(p.t)} cy={yOf(p.v)} r={3.2} fill={color} stroke="#fff" strokeWidth={1.2} />
            <title>
              {formatGoalDay(p.t)} · {formatGoalTick(p.v)}
              {unit}
            </title>
          </g>
        ))}
        <text
          x={L}
          y={H - 6}
          className="fill-slate-400"
          fontSize={8}
          fontWeight={700}
        >
          {formatGoalDay(range.from)}
        </text>
        <text
          x={W - R}
          y={H - 6}
          textAnchor="end"
          className="fill-slate-400"
          fontSize={8}
          fontWeight={700}
        >
          {formatGoalDay(range.to)}
        </text>
      </svg>
      {!sliced.length ? (
        <p className="text-[11px] font-semibold text-slate-500">
          Log an actual to see this goal over time.
        </p>
      ) : (
        <p className="text-[11px] font-semibold text-slate-500">
          {sliced.length} point{sliced.length === 1 ? '' : 's'}
          {delta != null
            ? ` · ${delta > 0 ? '+' : ''}${formatGoalTick(delta)}${unit} in view`
            : ''}
          {toGo != null
            ? ` · ${formatGoalTick(Math.abs(toGo))}${unit} to target`
            : ''}
        </p>
      )}
    </div>
  );
}
