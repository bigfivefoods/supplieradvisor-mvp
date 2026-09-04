'use client';

/**
 * Edit Mon–Sun open/close hours for a practice or gym.
 * Collapsible so the diary stays the focus on calendar pages.
 */
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Clock } from 'lucide-react';
import {
  WEEKDAY_LABELS,
  defaultWorkingHours,
  normalizeWorkingHours,
  summarizeWorkingHours,
  type WorkingHours,
} from '@/lib/schedule/working-hours';

type Props = {
  value?: WorkingHours | null;
  onChange?: (next: WorkingHours) => void;
  onSave?: (next: WorkingHours) => void | Promise<void>;
  saving?: boolean;
  title?: string;
  description?: string;
  accentClass?: string;
  /** Compact inline (no outer card chrome if parent provides it) */
  embedded?: boolean;
  /** Start collapsed (default true on calendar pages) */
  defaultCollapsed?: boolean;
  /** When false, parent owns expand/collapse and this editor stays open. */
  collapsible?: boolean;
};

export function WorkingHoursEditor({
  value,
  onChange,
  onSave,
  saving,
  title = 'Working hours',
  description = 'Set which days the practice is open and daily start/end times. The schedule calendar uses this window.',
  accentClass = 'border-slate-200 dark:border-slate-700',
  embedded,
  defaultCollapsed = true,
  collapsible = true,
}: Props) {
  const [hours, setHours] = useState<WorkingHours>(() =>
    normalizeWorkingHours(value)
  );
  const [collapsed, setCollapsed] = useState(defaultCollapsed && collapsible);

  useEffect(() => {
    setHours(normalizeWorkingHours(value));
  }, [value]);

  const patchDay = (
    day: number,
    patch: Partial<{ closed: boolean; open: string; close: string }>
  ) => {
    const next: WorkingHours = {
      ...hours,
      days: {
        ...(hours.days || {}),
        [String(day)]: {
          ...(hours.days?.[String(day)] || {}),
          ...patch,
        },
      },
    };
    setHours(next);
    onChange?.(next);
  };

  const applyWeekdays = () => {
    const mon = hours.days?.['1'] || {
      closed: false,
      open: '08:00',
      close: '17:00',
    };
    const next: WorkingHours = {
      ...hours,
      days: { ...(hours.days || {}) },
    };
    for (const d of [1, 2, 3, 4, 5]) {
      next.days![String(d)] = { ...mon, closed: false };
    }
    setHours(next);
    onChange?.(next);
  };

  const resetDefaults = () => {
    const next = defaultWorkingHours();
    setHours(next);
    onChange?.(next);
  };

  const summary = summarizeWorkingHours(hours);

  const header = (
    <button
      type="button"
      onClick={() => setCollapsed((c) => !c)}
      className="w-full flex items-start justify-between gap-3 text-left"
      aria-expanded={!collapsed}
    >
      <div className="min-w-0">
        <p className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-slate-500 shrink-0" />
          {title}
        </p>
        {collapsed ? (
          <p className="text-[11px] text-slate-500 mt-1 leading-snug line-clamp-2">
            {summary}
          </p>
        ) : description ? (
          <p className="text-xs text-slate-500 mt-0.5 max-w-xl">{description}</p>
        ) : null}
      </div>
      <span className="inline-flex items-center gap-1 shrink-0 rounded-xl border border-slate-200 dark:border-slate-600 px-2.5 py-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300">
        {collapsed ? (
          <>
            Expand <ChevronDown className="w-3.5 h-3.5" />
          </>
        ) : (
          <>
            Collapse <ChevronUp className="w-3.5 h-3.5" />
          </>
        )}
      </span>
    </button>
  );

  const body = (
    <div className="space-y-3">
      {collapsible ? header : null}

      {!collapsible || !collapsed ? (
        <>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={applyWeekdays}
              className="rounded-xl border border-slate-200 dark:border-slate-600 px-2.5 py-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Copy Mon → Fri
            </button>
            <button
              type="button"
              onClick={resetDefaults}
              className="rounded-xl border border-slate-200 dark:border-slate-600 px-2.5 py-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Defaults
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wide text-slate-400 text-left">
                  <th className="py-1.5 font-bold">Day</th>
                  <th className="py-1.5 font-bold">Open</th>
                  <th className="py-1.5 font-bold">Opens</th>
                  <th className="py-1.5 font-bold">Closes</th>
                </tr>
              </thead>
              <tbody>
                {WEEKDAY_LABELS.map(({ day, label }) => {
                  const d = hours.days?.[String(day)] || {
                    closed: false,
                    open: hours.default_open || '08:00',
                    close: hours.default_close || '17:00',
                  };
                  const closed = d.closed === true;
                  return (
                    <tr
                      key={day}
                      className="border-t border-slate-100 dark:border-slate-800"
                    >
                      <td className="py-2 pr-3 font-semibold text-slate-800 dark:text-slate-100">
                        {label}
                      </td>
                      <td className="py-2 pr-3">
                        <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                          <input
                            type="checkbox"
                            checked={!closed}
                            onChange={(e) =>
                              patchDay(day, { closed: !e.target.checked })
                            }
                          />
                          {closed ? 'Closed' : 'Open'}
                        </label>
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          type="time"
                          disabled={closed}
                          className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs disabled:opacity-40"
                          value={(d.open || '08:00').slice(0, 5)}
                          onChange={(e) =>
                            patchDay(day, { open: e.target.value })
                          }
                        />
                      </td>
                      <td className="py-2">
                        <input
                          type="time"
                          disabled={closed}
                          className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs disabled:opacity-40"
                          value={(d.close || '17:00').slice(0, 5)}
                          onChange={(e) =>
                            patchDay(day, { close: e.target.value })
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {onSave ? (
            <button
              type="button"
              disabled={saving}
              onClick={async () => {
                await onSave(hours);
                if (collapsible) setCollapsed(true);
              }}
              className="rounded-xl bg-slate-900 dark:bg-white dark:text-slate-900 text-white px-4 py-2 text-sm font-bold disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save working hours'}
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );

  if (embedded) return body;

  return (
    <div
      className={`rounded-3xl border ${accentClass} bg-white dark:bg-slate-950 p-4 sm:p-5`}
    >
      {body}
    </div>
  );
}
