'use client';

/**
 * Ops outcomes strip for GymAdvisor / clinic Advisor hubs.
 */
import type { OutcomesSnapshot } from '@/lib/services/advisor-outcomes';

type Props = {
  outcomes: OutcomesSnapshot | null;
  loading?: boolean;
  accent?: 'violet' | 'sky' | 'teal' | 'emerald' | 'indigo' | 'yellow';
  title?: string;
  onRefresh?: () => void;
  onSendReminders?: () => void;
  remindersBusy?: boolean;
};

const ACCENT: Record<string, string> = {
  violet: 'border-violet-200 dark:border-violet-800',
  sky: 'border-sky-200 dark:border-sky-800',
  teal: 'border-teal-200 dark:border-teal-800',
  emerald: 'border-emerald-200 dark:border-emerald-800',
  indigo: 'border-indigo-200 dark:border-indigo-800',
  yellow: 'border-yellow-200 dark:border-yellow-800',
};

export function AdvisorOutcomesPanel({
  outcomes,
  loading,
  accent = 'violet',
  title = 'Outcomes (30 days)',
  onRefresh,
  onSendReminders,
  remindersBusy,
}: Props) {
  if (loading && !outcomes) {
    return (
      <div
        className={`rounded-3xl border ${ACCENT[accent]} bg-white dark:bg-slate-950 p-4 text-sm text-slate-500`}
      >
        Loading outcomes…
      </div>
    );
  }
  if (!outcomes) return null;

  const cells = [
    { l: 'Bookings', v: outcomes.bookings_total },
    {
      l: 'Attendance',
      v:
        outcomes.attendance_rate != null
          ? `${outcomes.attendance_rate}%`
          : '—',
    },
    {
      l: 'No-shows',
      v:
        outcomes.no_show_rate != null
          ? `${outcomes.no_shows} (${outcomes.no_show_rate}%)`
          : String(outcomes.no_shows),
    },
    { l: 'Waitlist', v: outcomes.waitlist },
    {
      l: 'Feeling',
      v: outcomes.feeling_avg != null ? `${outcomes.feeling_avg}/5` : '—',
    },
    {
      l: 'Would return',
      v:
        outcomes.rebook_score_avg != null
          ? `${outcomes.rebook_score_avg}/5`
          : '—',
    },
    { l: 'Feedback', v: outcomes.feedback_count },
    { l: 'Soft-blocked', v: outcomes.soft_blocked_people },
  ];

  return (
    <div
      className={`rounded-3xl border ${ACCENT[accent]} bg-white dark:bg-slate-950 p-4 sm:p-5 space-y-3`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-black text-slate-900 dark:text-white">
            {title}
          </p>
          <p className="text-[11px] text-slate-500">
            Attendance, no-shows, feedback — last {outcomes.period_days} days
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onSendReminders ? (
            <button
              type="button"
              disabled={remindersBusy}
              onClick={onSendReminders}
              className="rounded-xl border border-slate-200 dark:border-slate-600 px-3 py-1.5 text-[11px] font-bold hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
            >
              {remindersBusy ? 'Sending…' : 'Send 24h reminders'}
            </button>
          ) : null}
          {onRefresh ? (
            <button
              type="button"
              onClick={onRefresh}
              className="rounded-xl border border-slate-200 dark:border-slate-600 px-3 py-1.5 text-[11px] font-bold hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Refresh
            </button>
          ) : null}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {cells.map((c) => (
          <div
            key={c.l}
            className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50 px-3 py-2"
          >
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              {c.l}
            </p>
            <p className="text-lg font-black text-slate-900 dark:text-white tabular-nums">
              {c.v}
            </p>
          </div>
        ))}
      </div>
      {outcomes.top_events.length > 0 ? (
        <div>
          <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">
            Top by attendance
          </p>
          <ul className="flex flex-wrap gap-2">
            {outcomes.top_events.map((e) => (
              <li
                key={e.name}
                className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200"
              >
                {e.name} · {e.attended}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
