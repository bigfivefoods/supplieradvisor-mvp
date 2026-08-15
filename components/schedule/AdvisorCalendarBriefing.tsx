'use client';

/**
 * Day briefing rail — advisor ops intelligence Outlook/Google do not have.
 */

import type { ScheduleEvent } from '@/components/schedule/PracticeScheduleCalendar';
import type { WorkingHours } from '@/lib/schedule/working-hours';
import { buildDayBriefing } from '@/lib/services/advisor-calendar-intelligence';
import { AlertTriangle, Clock, Sparkles, TrendingUp } from 'lucide-react';

type Props = {
  date: string;
  events: ScheduleEvent[];
  workingHours?: WorkingHours | null;
  people?: Array<{ id: string; name: string }>;
  peopleLabel?: string;
};

export function AdvisorCalendarBriefing({
  date,
  events,
  workingHours,
  people,
  peopleLabel = 'Clinician',
}: Props) {
  const briefing = buildDayBriefing(date, events, workingHours, people);
  const { stats } = briefing;

  return (
    <aside className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-amber-600" />
        <div>
          <h3 className="text-sm font-black text-slate-900 dark:text-slate-50">
            Day briefing
          </h3>
          <p className="text-[11px] text-slate-500">{briefing.headline}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl border border-slate-100 dark:border-slate-800 px-2.5 py-2">
          <div className="text-[10px] font-bold uppercase text-slate-400">
            Utilisation
          </div>
          <div className="font-black text-slate-900 dark:text-slate-50 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" />
            {stats.utilisation_pct != null ? `${stats.utilisation_pct}%` : '—'}
          </div>
        </div>
        <div className="rounded-xl border border-slate-100 dark:border-slate-800 px-2.5 py-2">
          <div className="text-[10px] font-bold uppercase text-slate-400">
            Sessions
          </div>
          <div className="font-black text-slate-900 dark:text-slate-50">
            {stats.event_count}
          </div>
        </div>
        <div className="rounded-xl border border-slate-100 dark:border-slate-800 px-2.5 py-2">
          <div className="text-[10px] font-bold uppercase text-slate-400">
            Largest gap
          </div>
          <div className="font-black text-slate-900 dark:text-slate-50 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {stats.largest_gap_minutes ? `${stats.largest_gap_minutes}m` : '—'}
          </div>
        </div>
        <div className="rounded-xl border border-slate-100 dark:border-slate-800 px-2.5 py-2">
          <div className="text-[10px] font-bold uppercase text-slate-400">
            Care risk
          </div>
          <div className="font-black text-slate-900 dark:text-slate-50 flex items-center gap-1">
            {stats.risk_events > 0 ? (
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            ) : null}
            {stats.risk_events}
          </div>
        </div>
      </div>

      {briefing.priorities.length > 0 ? (
        <ul className="space-y-1.5">
          {briefing.priorities.map((p) => (
            <li
              key={p.code}
              className={`rounded-xl border px-2.5 py-1.5 text-xs ${
                p.severity === 'high'
                  ? 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40'
                  : p.severity === 'medium'
                    ? 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40'
                    : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900'
              }`}
            >
              <div className="font-bold text-slate-900 dark:text-slate-50">
                {p.title}
              </div>
              {p.detail ? (
                <div className="text-[11px] text-slate-600 dark:text-slate-300">
                  {p.detail}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-slate-500">
          Day looks steady — no urgent flags.
        </p>
      )}

      {stats.by_person.length > 0 ? (
        <div>
          <p className="text-[10px] font-black uppercase tracking-wide text-slate-400 mb-1">
            By {peopleLabel}
          </p>
          <ul className="space-y-1">
            {stats.by_person.slice(0, 6).map((p) => (
              <li
                key={p.person_id}
                className="flex justify-between text-[11px] text-slate-700 dark:text-slate-200"
              >
                <span className="font-semibold truncate">{p.person_name}</span>
                <span>
                  {p.events} ·{' '}
                  {p.utilisation_pct != null ? `${p.utilisation_pct}%` : '—'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {stats.gaps.slice(0, 3).map((g) => (
        <p key={`${g.start}-${g.end}`} className="text-[11px] text-slate-500">
          Open slot {g.start}–{g.end} ({g.minutes} min)
        </p>
      ))}
    </aside>
  );
}

export default AdvisorCalendarBriefing;
