'use client';

import { useState } from 'react';
import { Target, Watch } from 'lucide-react';
import {
  MEMBER_GOAL_PRESETS,
  type MemberGoalView,
} from '@/lib/fitness/member-goals';
import { FIT_GOAL_CATEGORIES } from '@/lib/fitness/fitgraph-relationship';
import type { GoalPeriodKey } from '@/lib/fitness/goal-chart';
import { GoalPeriodPicker, GoalSparkline } from '@/components/fitness/GoalTrendChart';
import { GymExpandSection } from '@/components/fitness/GymMemberPwaUi';
import { gymPwaFieldClass } from '@/lib/fitness/gym-pwa-theme';

const CATEGORY_LABEL: Record<string, string> = {
  physical: 'Physical',
  consistency: 'Consistency',
  lifestyle: 'Lifestyle',
  performance: 'Performance',
  other: 'Other',
};

export function MemberGoalsPanel({
  goals,
  wearable,
  watchSessions,
  pastClasses,
  busy,
  onSaveGoal,
  onDeleteGoal,
  onLogActual,
  onWatchLog,
  onGarminConnect,
  onGarminImport,
  onGarminDisconnect,
  color = '#E8E830',
  showHeading = true,
}: {
  goals: MemberGoalView[];
  wearable?: {
    garmin_available?: boolean;
    garmin_connected?: boolean;
    last_sync_at?: string | null;
  } | null;
  watchSessions?: Array<{
    id: string;
    source: string;
    started_at: string;
    duration_min?: number | null;
    distance_km?: number | null;
    calories?: number | null;
    avg_hr?: number | null;
    activity_type?: string | null;
  }>;
  pastClasses?: Array<{
    booking_id: string;
    class_name: string;
    date: string;
    start_time: string;
  }>;
  busy?: boolean;
  onSaveGoal: (v: {
    kind: string;
    title: string;
    category: string;
    start_value: string;
    target_value: string;
    target_date: string;
    unit: string;
    direction: string;
  }) => void | Promise<void>;
  onDeleteGoal?: (goalId: string) => void | Promise<void>;
  onLogActual: (goalId: string, value: string, at: string) => void | Promise<void>;
  onWatchLog: (v: {
    booking_id: string;
    source: string;
    duration_min: string;
    distance_km: string;
    calories: string;
    avg_hr: string;
  }) => void | Promise<void>;
  onGarminConnect: () => void | Promise<void>;
  onGarminImport: () => void | Promise<void>;
  onGarminDisconnect: () => void | Promise<void>;
  color?: string;
  showHeading?: boolean;
}) {
  const [kind, setKind] = useState('weight');
  const preset = MEMBER_GOAL_PRESETS.find((p) => p.kind === kind) || MEMBER_GOAL_PRESETS[0];
  const [category, setCategory] = useState<string>(preset.category);
  const [title, setTitle] = useState<string>(preset.title);
  const [startValue, setStartValue] = useState('');
  const [targetValue, setTargetValue] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [unit, setUnit] = useState(preset.unit);
  const [actualDraft, setActualDraft] = useState<Record<string, string>>({});
  const [actualDate, setActualDate] = useState<Record<string, string>>({});
  const [watchBooking, setWatchBooking] = useState(pastClasses?.[0]?.booking_id || '');
  const [watchSource, setWatchSource] = useState('garmin');
  const [watchDur, setWatchDur] = useState('');
  const [watchKm, setWatchKm] = useState('');
  const [watchCal, setWatchCal] = useState('');
  const [watchHr, setWatchHr] = useState('');
  const [period, setPeriod] = useState<GoalPeriodKey>('3m');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [watchOpen, setWatchOpen] = useState(false);
  const [goalsOpen, setGoalsOpen] = useState(true);
  const activeCount = goals.filter((g) => g.status !== 'abandoned').length;

  return (
    <div className="space-y-3">
      <GymExpandSection
        title={showHeading ? 'Your goals' : 'Goals'}
        hint={
          goalsOpen
            ? undefined
            : activeCount
              ? `${activeCount} goal${activeCount === 1 ? '' : 's'}`
              : 'Set a target and log actuals as you go'
        }
        icon={<Target className="h-4 w-4" />}
        open={goalsOpen}
        onToggle={() => setGoalsOpen((v) => !v)}
      >
      {goals.length === 0 ? (
        <p className="text-sm text-slate-500">No goals yet. Pick one below.</p>
      ) : (
        <div className="space-y-3">
          <GoalPeriodPicker
            period={period}
            onPeriod={setPeriod}
            customFrom={customFrom}
            customTo={customTo}
            onCustomFrom={setCustomFrom}
            onCustomTo={setCustomTo}
            color={color}
          />
        <ul className="space-y-3">
          {goals.map((g) => (
            <li
              key={g.id}
              className="space-y-3 rounded-3xl border border-yellow-200/90 bg-white p-3.5 text-slate-900 shadow-sm dark:border-yellow-500/20 dark:bg-neutral-900 dark:text-white"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-black text-slate-900">{g.title}</p>
                  <p className="text-[11px] text-slate-500">
                    {g.category
                      ? `${CATEGORY_LABEL[g.category] || g.category} · `
                      : ''}
                    {g.status}
                    {g.target_date ? ` · by ${g.target_date}` : ''}
                  </p>
                </div>
                {g.progress_pct != null ? (
                  <span className="text-xs font-black text-yellow-800">
                    {g.progress_pct}%
                  </span>
                ) : null}
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-yellow-50 px-2 py-1.5">
                  <p className="text-[9px] font-black uppercase text-slate-400">
                    Start
                  </p>
                  <p className="text-sm font-black">
                    {g.start_value ?? '—'}
                    {g.unit ? ` ${g.unit}` : ''}
                  </p>
                </div>
                <div className="rounded-xl bg-yellow-50 px-2 py-1.5">
                  <p className="text-[9px] font-black uppercase text-yellow-700">
                    Actual
                  </p>
                  <p className="text-sm font-black">
                    {g.actual ?? '—'}
                    {g.unit ? ` ${g.unit}` : ''}
                  </p>
                </div>
                <div className="rounded-xl bg-yellow-50 px-2 py-1.5">
                  <p className="text-[9px] font-black uppercase text-slate-400">
                    Target
                  </p>
                  <p className="text-sm font-black">
                    {g.target_value ?? '—'}
                    {g.unit ? ` ${g.unit}` : ''}
                  </p>
                </div>
              </div>
              {g.progress_pct != null ? (
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden dark:bg-white/10">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${g.progress_pct}%`,
                      background: color,
                    }}
                  />
                </div>
              ) : null}
              <GoalSparkline
                goal={g}
                period={period}
                customFrom={customFrom}
                customTo={customTo}
                color={color}
              />
              {g.status === 'active' ? (
                <div className="space-y-2">
                  <input
                    className={`${gymPwaFieldClass} w-full py-2`}
                    inputMode="decimal"
                    placeholder={`Actual${g.unit ? ` (${g.unit})` : ''}`}
                    value={actualDraft[g.id] || ''}
                    onChange={(e) =>
                      setActualDraft((cur) => ({ ...cur, [g.id]: e.target.value }))
                    }
                  />
                  <input
                    type="date"
                    className={`${gymPwaFieldClass} w-full py-2`}
                    value={actualDate[g.id] || ''}
                    onChange={(e) =>
                      setActualDate((cur) => ({ ...cur, [g.id]: e.target.value }))
                    }
                  />
                  <button
                    type="button"
                    disabled={busy || !String(actualDraft[g.id] || '').trim()}
                    onClick={() => {
                      const v = actualDraft[g.id];
                      const d = actualDate[g.id] || '';
                      void Promise.resolve(onLogActual(g.id, v, d))
                        .then(() => {
                          setActualDraft((cur) => ({ ...cur, [g.id]: '' }));
                        })
                        .catch(() => undefined);
                    }}
                    className="w-full min-h-11 rounded-xl bg-slate-900 px-3 py-2 text-sm font-black text-white disabled:opacity-50"
                  >
                    {busy ? 'Saving…' : 'Save'}
                  </button>
                </div>
              ) : null}
              {(g.check_ins || []).length ? (
                <ol className="space-y-0.5 text-[11px] text-slate-500">
                  {[...g.check_ins]
                    .slice(-6)
                    .reverse()
                    .map((c) => (
                      <li key={c.id} className="flex justify-between gap-2">
                        <span>
                          {String(c.at || '').slice(0, 10)}
                          {c.source ? ` · ${c.source}` : ''}
                        </span>
                        <span className="font-black tabular-nums text-slate-800 dark:text-slate-100">
                          {c.metric_value ?? '—'}
                          {g.unit ? ` ${g.unit}` : ''}
                        </span>
                      </li>
                    ))}
                </ol>
              ) : null}
              {onDeleteGoal ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (
                      confirm(
                        `Delete “${g.title}”? This removes the goal and its logs.`
                      )
                    ) {
                      void onDeleteGoal(g.id);
                    }
                  }}
                  className="text-[11px] font-bold text-rose-700 underline"
                >
                  Delete
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-3 space-y-2">
        <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
          New goal
        </p>
        <label className="block text-[10px] font-black uppercase tracking-wide text-slate-500">
          Category
          <select
            className={`${gymPwaFieldClass} mt-1 font-semibold`}
            value={category}
            onChange={(e) => {
              const next = e.target.value;
              setCategory(next);
              const match = MEMBER_GOAL_PRESETS.find((p) => p.category === next);
              if (match) {
                setKind(match.kind);
                setTitle(match.title);
                setUnit(match.unit);
              } else {
                setKind('custom');
              }
            }}
          >
            {FIT_GOAL_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c] || c}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-1.5">
          {MEMBER_GOAL_PRESETS.filter(
            (p) => p.category === category || p.kind === 'custom'
          ).map((p) => (
            <button
              key={p.kind}
              type="button"
              onClick={() => {
                setKind(p.kind);
                setTitle(p.title);
                setUnit(p.unit);
                setCategory(p.category);
              }}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                kind === p.kind
                  ? 'border-yellow-600 bg-[#E8E830] text-slate-900'
                  : 'border-slate-200 bg-white text-slate-700'
              }`}
            >
              {p.title}
            </button>
          ))}
        </div>
        <input
          className={gymPwaFieldClass}
          placeholder="Goal name"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            className={gymPwaFieldClass}
            inputMode="decimal"
            placeholder={`Start ${unit || ''}`.trim()}
            value={startValue}
            onChange={(e) => setStartValue(e.target.value)}
          />
          <input
            className={gymPwaFieldClass}
            inputMode="decimal"
            placeholder={`Target ${unit || ''}`.trim()}
            value={targetValue}
            onChange={(e) => setTargetValue(e.target.value)}
          />
        </div>
        <input
          type="date"
          className={gymPwaFieldClass}
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
        />
        <button
          type="button"
          disabled={busy || !title.trim()}
          onClick={() =>
            void Promise.resolve(
              onSaveGoal({
                kind,
                title,
                category,
                start_value: startValue,
                target_value: targetValue,
                target_date: targetDate,
                unit,
                direction: preset.direction,
              })
            ).then(() => {
              setStartValue('');
              setTargetValue('');
            })
          }
          className="w-full rounded-xl bg-[#E8E830] py-2 text-sm font-black text-slate-900 disabled:opacity-50"
        >
          Save goal
        </button>
      </div>
      </GymExpandSection>

      <GymExpandSection
        title="Watch after class"
        hint={
          watchOpen
            ? undefined
            : (watchSessions || []).length
              ? `${(watchSessions || []).length} logged`
              : 'Garmin, Apple Watch, or log stats after class'
        }
        icon={<Watch className="h-4 w-4" />}
        open={watchOpen}
        onToggle={() => setWatchOpen((v) => !v)}
      >
        <p className="text-[11px] text-slate-500">
          Garmin Connect can send the session automatically when the gym has
          connected Garmin. Apple Watch and Wear OS cannot be read from this
          PWA — log duration, distance and heart rate here after class.
        </p>
        {wearable?.garmin_connected ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void onGarminImport()}
              className="rounded-xl bg-slate-900 px-3 py-2 text-[11px] font-black text-white disabled:opacity-50"
            >
              Import from Garmin
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void onGarminDisconnect()}
              className="rounded-xl border border-slate-200 px-3 py-2 text-[11px] font-bold"
            >
              Disconnect
            </button>
            {wearable.last_sync_at ? (
              <span className="text-[10px] text-slate-400 self-center">
                Last sync {wearable.last_sync_at.slice(0, 16).replace('T', ' ')}
              </span>
            ) : null}
          </div>
        ) : wearable?.garmin_available ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void onGarminConnect()}
            className="rounded-xl bg-slate-900 px-3 py-2 text-[11px] font-black text-white disabled:opacity-50"
          >
            Connect Garmin
          </button>
        ) : (
          <p className="text-[11px] text-slate-500">
            Garmin Connect is ready when the gym adds Garmin developer
            credentials. You can still log watch stats below.
          </p>
        )}

        {(pastClasses || []).length > 0 ? (
          <>
            <select
              className={gymPwaFieldClass}
              value={watchBooking}
              onChange={(e) => setWatchBooking(e.target.value)}
            >
              {(pastClasses || []).map((c) => (
                <option key={c.booking_id} value={c.booking_id}>
                  {c.date} {c.start_time.slice(0, 5)} · {c.class_name}
                </option>
              ))}
            </select>
            <select
              className={gymPwaFieldClass}
              value={watchSource}
              onChange={(e) => setWatchSource(e.target.value)}
            >
              <option value="garmin">Garmin</option>
              <option value="apple_watch">Apple Watch</option>
              <option value="wear_os">Wear OS / Pixel Watch</option>
              <option value="manual">Other / manual</option>
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input
                className={gymPwaFieldClass}
                placeholder="Minutes"
                inputMode="decimal"
                value={watchDur}
                onChange={(e) => setWatchDur(e.target.value)}
              />
              <input
                className={gymPwaFieldClass}
                placeholder="Distance km"
                inputMode="decimal"
                value={watchKm}
                onChange={(e) => setWatchKm(e.target.value)}
              />
              <input
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Calories"
                inputMode="decimal"
                value={watchCal}
                onChange={(e) => setWatchCal(e.target.value)}
              />
              <input
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Avg HR"
                inputMode="decimal"
                value={watchHr}
                onChange={(e) => setWatchHr(e.target.value)}
              />
            </div>
            <button
              type="button"
              disabled={busy || !watchBooking}
              onClick={() =>
                void onWatchLog({
                  booking_id:
                    watchBooking || pastClasses?.[0]?.booking_id || '',
                  source: watchSource,
                  duration_min: watchDur,
                  distance_km: watchKm,
                  calories: watchCal,
                  avg_hr: watchHr,
                })
              }
              className="w-full rounded-xl border border-yellow-300 bg-yellow-50 py-2 text-sm font-black text-yellow-950 disabled:opacity-50"
            >
              Save watch session
            </button>
          </>
        ) : (
          <p className="text-[11px] text-slate-500">
            After you attend a class, log the watch numbers here.
          </p>
        )}

        {(watchSessions || []).length > 0 ? (
          <ul className="space-y-1 pt-1">
            {(watchSessions || []).slice(0, 5).map((w) => (
              <li key={w.id} className="text-[11px] text-slate-600">
                {w.started_at.slice(0, 16).replace('T', ' ')} · {w.source}
                {w.duration_min != null ? ` · ${w.duration_min} min` : ''}
                {w.distance_km != null ? ` · ${w.distance_km} km` : ''}
                {w.avg_hr != null ? ` · ${w.avg_hr} bpm` : ''}
              </li>
            ))}
          </ul>
        ) : null}
      </GymExpandSection>
    </div>
  );
}
