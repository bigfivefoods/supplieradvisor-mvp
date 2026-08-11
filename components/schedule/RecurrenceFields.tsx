'use client';

/**
 * Shared “Repeat” controls for Fit + clinic Advisor calendars.
 * One-off | Daily | Weekly | Monthly, interval, weekday picker, ends after N / on date.
 */

import { Repeat } from 'lucide-react';

export type RepeatFreq = 'none' | 'daily' | 'weekly' | 'monthly';
export type EndMode = 'count' | 'until';

export type RecurrenceFormValue = {
  frequency: RepeatFreq;
  interval: string;
  count: string;
  until: string;
  end_mode: EndMode;
  weekdays: number[];
};

export const emptyRecurrenceForm = (): RecurrenceFormValue => ({
  frequency: 'none',
  interval: '1',
  count: '8',
  until: '',
  end_mode: 'count',
  weekdays: [],
});

const WEEKDAYS = [
  { v: 1, l: 'Mon' },
  { v: 2, l: 'Tue' },
  { v: 3, l: 'Wed' },
  { v: 4, l: 'Thu' },
  { v: 5, l: 'Fri' },
  { v: 6, l: 'Sat' },
  { v: 0, l: 'Sun' },
];

const REPEAT_OPTIONS: { v: RepeatFreq; l: string }[] = [
  { v: 'none', l: 'One-off' },
  { v: 'daily', l: 'Daily' },
  { v: 'weekly', l: 'Weekly' },
  { v: 'monthly', l: 'Monthly' },
];

function intervalUnit(freq: RepeatFreq): string {
  if (freq === 'daily') return 'day(s)';
  if (freq === 'weekly') return 'week(s)';
  if (freq === 'monthly') return 'month(s)';
  return '';
}

function defaultUntilDate(startDate: string, freq: RepeatFreq): string {
  const d = new Date((startDate || new Date().toISOString().slice(0, 10)) + 'T12:00:00');
  d.setDate(
    d.getDate() +
      (freq === 'daily' ? 14 : freq === 'monthly' ? 180 : 56)
  );
  return d.toISOString().slice(0, 10);
}

/** Payload for create_*_series APIs. null when one-off. */
export function recurrenceApiPayload(
  form: RecurrenceFormValue,
  startDate: string
): {
  frequency: RepeatFreq;
  repeat: RepeatFreq;
  interval: number;
  count: number | null;
  until: string | null;
  weekdays?: number[];
} | null {
  if (form.frequency === 'none') return null;
  return {
    frequency: form.frequency,
    repeat: form.frequency,
    interval: Math.max(1, Number(form.interval) || 1),
    count:
      form.end_mode === 'count'
        ? Math.max(1, Number(form.count) || 8)
        : null,
    until:
      form.end_mode === 'until' && form.until ? form.until : null,
    weekdays:
      form.frequency === 'weekly'
        ? form.weekdays.length > 0
          ? form.weekdays
          : [new Date(startDate + 'T12:00:00').getDay()]
        : undefined,
  };
}

export function validateRecurrenceForm(
  form: RecurrenceFormValue
): string | null {
  if (form.frequency === 'none') return null;
  if (form.end_mode === 'until' && !form.until) {
    return 'Pick an end date for the series, or switch to “After N”';
  }
  return null;
}

type Accent =
  | 'violet'
  | 'sky'
  | 'amber'
  | 'emerald'
  | 'teal'
  | 'rose'
  | 'indigo';

const ACCENT: Record<
  Accent,
  {
    active: string;
    border: string;
    panel: string;
    label: string;
    muted: string;
  }
> = {
  violet: {
    active: 'bg-violet-600 text-white border-violet-600',
    border: 'border-slate-200 dark:border-violet-600',
    panel:
      'border-slate-200 dark:border-violet-800/60 bg-slate-50/60 dark:bg-violet-950/20',
    label: 'text-slate-500 dark:text-violet-300',
    muted: 'text-slate-500',
  },
  sky: {
    active: 'bg-sky-600 text-white border-sky-600',
    border: 'border-slate-200 dark:border-sky-600',
    panel:
      'border-sky-200 dark:border-sky-800/60 bg-sky-50/50 dark:bg-sky-950/20',
    label: 'text-slate-500 dark:text-sky-300',
    muted: 'text-slate-500',
  },
  amber: {
    active: 'bg-amber-600 text-white border-amber-600',
    border: 'border-slate-200 dark:border-amber-600',
    panel:
      'border-amber-200/80 dark:border-amber-800/50 bg-amber-50/40 dark:bg-amber-950/20',
    label: 'text-amber-800 dark:text-amber-300',
    muted: 'text-slate-500 dark:text-amber-200/80',
  },
  emerald: {
    active: 'bg-emerald-600 text-white border-emerald-600',
    border: 'border-slate-200 dark:border-emerald-600',
    panel:
      'border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/50 dark:bg-emerald-950/20',
    label: 'text-slate-500 dark:text-emerald-300',
    muted: 'text-slate-500',
  },
  teal: {
    active: 'bg-teal-600 text-white border-teal-600',
    border: 'border-slate-200 dark:border-teal-600',
    panel:
      'border-teal-200 dark:border-teal-800/60 bg-teal-50/50 dark:bg-teal-950/20',
    label: 'text-slate-500 dark:text-teal-300',
    muted: 'text-slate-500',
  },
  rose: {
    active: 'bg-rose-600 text-white border-rose-600',
    border: 'border-slate-200 dark:border-rose-600',
    panel:
      'border-rose-200 dark:border-rose-800/60 bg-rose-50/50 dark:bg-rose-950/20',
    label: 'text-slate-500 dark:text-rose-300',
    muted: 'text-slate-500',
  },
  indigo: {
    active: 'bg-indigo-600 text-white border-indigo-600',
    border: 'border-slate-200 dark:border-indigo-600',
    panel:
      'border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/50 dark:bg-indigo-950/20',
    label: 'text-slate-500 dark:text-indigo-300',
    muted: 'text-slate-500',
  },
};

type Props = {
  value: RecurrenceFormValue;
  onChange: (next: RecurrenceFormValue) => void;
  /** Start date used to seed weekly weekdays and default until */
  startDate: string;
  /** Input class helper from module forms (fc()) */
  inputClass: string;
  accent?: Accent;
  /** “After N classes” vs “After N appointments” */
  unitLabel?: string;
  className?: string;
};

export function RecurrenceFields({
  value,
  onChange,
  startDate,
  inputClass,
  accent = 'sky',
  unitLabel = 'appointments',
  className = '',
}: Props) {
  const a = ACCENT[accent] || ACCENT.sky;
  const set = (patch: Partial<RecurrenceFormValue>) =>
    onChange({ ...value, ...patch });

  return (
    <div
      className={`sm:col-span-2 lg:col-span-3 space-y-3 rounded-xl border p-3 ${a.panel} ${className}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`text-[10px] font-black uppercase tracking-wide inline-flex items-center gap-1 ${a.label}`}
        >
          <Repeat className="w-3 h-3" /> Repeat
        </span>
        {REPEAT_OPTIONS.map((opt) => (
          <button
            key={opt.v}
            type="button"
            className={`rounded-xl border px-3 py-1.5 text-xs font-bold ${
              value.frequency === opt.v
                ? a.active
                : `${a.border} bg-white dark:bg-transparent`
            }`}
            onClick={() =>
              set({
                frequency: opt.v,
                weekdays:
                  opt.v === 'weekly' && value.weekdays.length === 0
                    ? [
                        new Date(
                          (startDate || value.until || new Date().toISOString().slice(0, 10)) +
                            'T12:00:00'
                        ).getDay(),
                      ]
                    : value.weekdays,
              })
            }
          >
            {opt.l}
          </button>
        ))}
      </div>

      {value.frequency !== 'none' ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block space-y-1">
            <span className="text-[10px] font-bold uppercase text-slate-500">
              Every
            </span>
            <div className="flex items-center gap-2">
              <input
                className={inputClass}
                type="number"
                min={1}
                max={12}
                value={value.interval}
                onChange={(e) => set({ interval: e.target.value })}
              />
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">
                {intervalUnit(value.frequency)}
              </span>
            </div>
            <span className={`text-[10px] ${a.muted}`}>
              e.g. every 2 weeks = biweekly
            </span>
          </label>

          <div className="space-y-1 sm:col-span-2">
            <span className="text-[10px] font-bold uppercase text-slate-500">
              Ends
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold ${
                  value.end_mode === 'count' ? a.active : a.border
                }`}
                onClick={() => set({ end_mode: 'count' })}
              >
                After N {unitLabel}
              </button>
              <button
                type="button"
                className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold ${
                  value.end_mode === 'until' ? a.active : a.border
                }`}
                onClick={() =>
                  set({
                    end_mode: 'until',
                    until:
                      value.until ||
                      defaultUntilDate(startDate, value.frequency),
                  })
                }
              >
                On date
              </button>
            </div>
            {value.end_mode === 'count' ? (
              <input
                className={inputClass + ' mt-1 max-w-[10rem]'}
                type="number"
                min={1}
                max={
                  value.frequency === 'daily'
                    ? 60
                    : value.frequency === 'monthly'
                      ? 24
                      : 52
                }
                placeholder="Count"
                value={value.count}
                onChange={(e) => set({ count: e.target.value })}
              />
            ) : (
              <input
                className={inputClass + ' mt-1 max-w-[12rem]'}
                type="date"
                value={value.until}
                min={startDate}
                onChange={(e) => set({ until: e.target.value })}
              />
            )}
          </div>

          {value.frequency === 'weekly' ? (
            <div className="sm:col-span-2 lg:col-span-3 space-y-1">
              <span className="text-[10px] font-bold uppercase text-slate-500">
                On days
              </span>
              <div className="flex flex-wrap gap-1">
                {WEEKDAYS.map((w) => {
                  const on = value.weekdays.includes(w.v);
                  return (
                    <button
                      key={w.v}
                      type="button"
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${
                        on ? a.active : a.border
                      }`}
                      onClick={() =>
                        set({
                          weekdays: on
                            ? value.weekdays.filter((x) => x !== w.v)
                            : [...value.weekdays, w.v],
                        })
                      }
                    >
                      {w.l}
                    </button>
                  );
                })}
              </div>
              <p className={`text-[10px] ${a.muted}`}>
                Leave empty to use the weekday of the start date. Interval
                &gt; 1 skips weeks (e.g. every 2 weeks on Mon/Wed).
              </p>
            </div>
          ) : null}

          {value.frequency === 'monthly' ? (
            <p
              className={`sm:col-span-2 lg:col-span-3 text-[10px] ${a.muted}`}
            >
              Repeats on the same calendar day each month. Short months clamp
              to the last day (31 → 28/29 Feb).
            </p>
          ) : null}
        </div>
      ) : (
        <p className={`text-[10px] ${a.muted}`}>
          One-off creates a single slot. Choose Daily, Weekly, or Monthly to
          schedule a repeating series in one step.
        </p>
      )}
    </div>
  );
}
