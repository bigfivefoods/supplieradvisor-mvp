'use client';

/**
 * Member portal — journey, goals, health (read).
 */

import { Target, Activity, BookOpen } from 'lucide-react';

export type MemberRelationshipPayload = {
  health?: {
    score: number;
    level: string;
    label: string;
    metrics?: {
      attended_30d?: number;
      days_since_attended?: number | null;
      active_goals?: number;
    };
    suggested_actions?: Array<{ title: string }>;
  };
  journey_preview?: Array<{
    id: string;
    at: string;
    title: string;
    body?: string;
    kind?: string;
  }>;
  active_goals?: Array<{
    id: string;
    title: string;
    target_date?: string | null;
    status?: string;
    unit?: string | null;
    start_value?: number | null;
    target_value?: number | null;
    current_value?: number | null;
  }>;
  ledger?: {
    member_view?: {
      sessions_attended?: number;
      notes_received?: number;
      goals_achieved?: number;
    };
  };
};

type Props = {
  relationship?: MemberRelationshipPayload | null;
  primaryColor?: string;
};

export function MemberRelationshipSection({
  relationship,
  primaryColor = '#E8E830',
}: Props) {
  if (!relationship) return null;
  const { health, journey_preview, active_goals, ledger } = relationship;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Activity className="w-4 h-4" style={{ color: primaryColor }} />
        <h2 className="text-sm font-black text-slate-900 dark:text-white">
          Your journey
        </h2>
      </div>

      {health ? (
        <div className="rounded-2xl border border-yellow-200 bg-yellow-50/70 dark:border-yellow-800 dark:bg-yellow-950/30 px-3 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-bold text-slate-800 dark:text-yellow-50">
              Connection with your gym
            </p>
            <span className="text-[11px] font-black uppercase tracking-wide text-yellow-900 dark:text-yellow-200">
              {health.label} · {health.score}
            </span>
          </div>
          <p className="text-[11px] text-slate-600 dark:text-yellow-100/80 mt-1">
            {health.metrics?.attended_30d ?? 0} classes in 30 days
            {health.metrics?.days_since_attended != null
              ? ` · last visit ${health.metrics.days_since_attended}d ago`
              : ''}
          </p>
        </div>
      ) : null}

      {active_goals && active_goals.length > 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-slate-500 mb-1.5">
            <Target className="w-3 h-3" /> Active goals
          </div>
          <ul className="space-y-1">
            {active_goals.map((g) => (
              <li
                key={g.id}
                className="text-xs font-semibold text-slate-800 dark:text-slate-100"
              >
                {g.title}
                {g.current_value != null || g.target_value != null ? (
                  <span className="text-slate-400 font-normal">
                    {' '}
                    · {g.current_value ?? '—'}
                    {g.unit ? ` ${g.unit}` : ''} / {g.target_value ?? '—'}
                    {g.unit ? ` ${g.unit}` : ''}
                  </span>
                ) : null}
                {g.target_date ? (
                  <span className="text-slate-400 font-normal">
                    {' '}
                    · by {g.target_date}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {journey_preview && journey_preview.length > 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-slate-500 mb-1.5">
            <BookOpen className="w-3 h-3" /> Recent progress
          </div>
          <ul className="space-y-1.5 max-h-40 overflow-y-auto">
            {journey_preview.slice(0, 8).map((e) => (
              <li key={e.id} className="text-xs">
                <span className="font-semibold text-slate-800 dark:text-slate-100">
                  {e.title}
                </span>
                <span className="text-[10px] text-slate-400 ml-1">
                  {e.at.slice(0, 10)}
                </span>
                {e.body ? (
                  <p className="text-slate-500 line-clamp-2">{e.body}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {ledger?.member_view ? (
        <p className="text-[11px] text-slate-500">
          Last 90 days: {ledger.member_view.sessions_attended ?? 0} sessions ·{' '}
          {ledger.member_view.notes_received ?? 0} coach notes ·{' '}
          {ledger.member_view.goals_achieved ?? 0} goals achieved
        </p>
      ) : null}
    </section>
  );
}

export default MemberRelationshipSection;
