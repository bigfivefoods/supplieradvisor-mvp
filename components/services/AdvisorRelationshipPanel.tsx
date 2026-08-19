'use client';

/**
 * Shared advisor–member relationship surface for GymAdvisor (and reusable patterns).
 * Shows relationship health, journey preview, active goals, suggested care actions,
 * and a compact value ledger.
 */

import { useMemo, useState } from 'react';
import {
  Activity,
  Flag,
  HeartHandshake,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react';
import type { FitgraphStore } from '@/lib/fitness/fitgraph';
import {
  buildRelationshipSummary,
  createCoachNoteEvent,
  createGoal,
  relationshipLevelTone,
  type FitGoal,
  type RelationshipHealth,
} from '@/lib/fitness/fitgraph-relationship';

type Props = {
  store: FitgraphStore;
  clientId: string;
  clientName?: string;
  coachId?: string | null;
  /** Persist journey event / goal back to store */
  onPersist?: (next: FitgraphStore) => Promise<void> | void;
  accentClass?: string;
};

const LEVEL_STYLES: Record<
  RelationshipHealth['level'],
  string
> = {
  strong:
    'bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-100 dark:border-emerald-800',
  steady:
    'bg-sky-100 text-sky-900 border-sky-200 dark:bg-sky-950 dark:text-sky-100 dark:border-sky-800',
  cooling:
    'bg-amber-100 text-amber-950 border-amber-200 dark:bg-amber-950 dark:text-amber-100 dark:border-amber-800',
  at_risk:
    'bg-rose-100 text-rose-900 border-rose-200 dark:bg-rose-950 dark:text-rose-100 dark:border-rose-800',
  unknown:
    'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:border-slate-700',
};

export function AdvisorRelationshipPanel({
  store,
  clientId,
  clientName,
  coachId,
  onPersist,
  accentClass = 'border-yellow-200 dark:border-yellow-800',
}: Props) {
  const summary = useMemo(
    () => buildRelationshipSummary(store, clientId, coachId),
    [store, clientId, coachId]
  );
  const { health, journey_preview, active_goals, ledger } = summary;
  const [note, setNote] = useState('');
  const [goalTitle, setGoalTitle] = useState('');
  const [busy, setBusy] = useState(false);

  const saveNote = async () => {
    if (!note.trim() || !onPersist) return;
    setBusy(true);
    try {
      const event = createCoachNoteEvent({
        client_id: clientId,
        coach_id: coachId,
        body: note.trim(),
      });
      const journey_events = [event, ...(store.journey_events || [])];
      await onPersist({ ...store, journey_events });
      setNote('');
    } finally {
      setBusy(false);
    }
  };

  const saveGoal = async () => {
    if (!goalTitle.trim() || !onPersist) return;
    setBusy(true);
    try {
      const goal: FitGoal = createGoal({
        client_id: clientId,
        coach_id: coachId,
        title: goalTitle.trim(),
        created_by_role: 'coach',
      });
      const goals = [goal, ...(store.goals || [])];
      await onPersist({ ...store, goals });
      setGoalTitle('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`rounded-2xl border ${accentClass} bg-white/80 dark:bg-slate-950/60 p-4 space-y-4`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-slate-50">
            <HeartHandshake className="w-4 h-4 text-yellow-600" />
            Relationship
            {clientName ? (
              <span className="font-semibold text-slate-500">· {clientName}</span>
            ) : null}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5 max-w-xl">
            Shared journey, health signals, goals and value ledger — both sides
            of the advisor–member partnership.
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ${
            LEVEL_STYLES[health.level]
          }`}
          title={`Score ${health.score}/100`}
        >
          <Activity className="w-3 h-3" />
          {health.label} · {health.score}
        </span>
      </div>

      {/* Metrics strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          {
            label: 'Attended 30d',
            value: String(health.metrics.attended_30d),
            icon: TrendingUp,
          },
          {
            label: 'Days since train',
            value:
              health.metrics.days_since_attended != null
                ? String(health.metrics.days_since_attended)
                : '—',
            icon: Flag,
          },
          {
            label: 'Avg feel',
            value:
              health.metrics.avg_feel_30d != null
                ? `${health.metrics.avg_feel_30d}/5`
                : '—',
            icon: Sparkles,
          },
          {
            label: 'Active goals',
            value: String(health.metrics.active_goals),
            icon: Target,
          },
        ].map((m) => (
          <div
            key={m.label}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50 px-3 py-2"
          >
            <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              <m.icon className="w-3 h-3" />
              {m.label}
            </div>
            <div className="text-lg font-black text-slate-900 dark:text-slate-50 mt-0.5">
              {m.value}
            </div>
          </div>
        ))}
      </div>

      {/* Suggested actions */}
      {health.suggested_actions.length > 0 ? (
        <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/30 px-3 py-2.5">
          <p className="text-[10px] font-black uppercase tracking-wide text-amber-900 dark:text-amber-200 mb-1.5">
            Suggested care
          </p>
          <ul className="space-y-1">
            {health.suggested_actions.map((a) => (
              <li key={a.code} className="text-xs text-slate-800 dark:text-slate-100">
                <span className="font-bold">{a.title}</span>
                {a.detail ? (
                  <span className="text-slate-500 dark:text-slate-400">
                    {' '}
                    — {a.detail}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Journey preview */}
      <div>
        <p className="text-[10px] font-black uppercase tracking-wide text-slate-500 mb-1.5">
          Journey (recent)
        </p>
        {journey_preview.length === 0 ? (
          <p className="text-xs text-slate-500">
            No shared events yet — attendance, feedback and notes will appear
            here.
          </p>
        ) : (
          <ul className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {journey_preview.slice(0, 8).map((e) => (
              <li
                key={e.id}
                className="text-xs rounded-lg border border-slate-100 dark:border-slate-800 px-2.5 py-1.5"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    {e.title}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {e.at.slice(0, 16).replace('T', ' ')}
                  </span>
                </div>
                {e.body ? (
                  <p className="text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                    {e.body}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Goals */}
      <div>
        <p className="text-[10px] font-black uppercase tracking-wide text-slate-500 mb-1.5">
          Active goals
        </p>
        {active_goals.length === 0 ? (
          <p className="text-xs text-slate-500 mb-2">No active goals yet.</p>
        ) : (
          <ul className="space-y-1 mb-2">
            {active_goals.map((g) => (
              <li
                key={g.id}
                className="text-xs font-medium text-slate-800 dark:text-slate-100 flex items-center gap-2"
              >
                <Target className="w-3 h-3 text-yellow-600 shrink-0" />
                <span>
                  {g.title}
                  {g.current_value != null || g.target_value != null ? (
                    <span className="text-slate-400 font-normal">
                      {' '}
                      · {g.current_value ?? g.start_value ?? '—'}
                      {g.unit ? ` ${g.unit}` : ''} → {g.target_value ?? '—'}
                      {g.unit ? ` ${g.unit}` : ''}
                    </span>
                  ) : null}
                </span>
                {g.target_date ? (
                  <span className="text-[10px] text-slate-400">
                    by {g.target_date}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {onPersist ? (
          <div className="flex flex-wrap gap-2">
            <input
              className="flex-1 min-w-[10rem] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs"
              placeholder="New goal title…"
              value={goalTitle}
              onChange={(e) => setGoalTitle(e.target.value)}
              disabled={busy}
            />
            <button
              type="button"
              disabled={busy || !goalTitle.trim()}
              onClick={() => void saveGoal()}
              className="rounded-xl bg-yellow-500/90 hover:bg-yellow-500 text-slate-900 text-xs font-bold px-3 py-1.5 disabled:opacity-50"
            >
              Add goal
            </button>
          </div>
        ) : null}
      </div>

      {/* Coach note */}
      {onPersist ? (
        <div>
          <p className="text-[10px] font-black uppercase tracking-wide text-slate-500 mb-1.5">
            Add coach note
          </p>
          <textarea
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs min-h-[64px]"
            placeholder="Shared note the member will also see on their journey…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={busy}
          />
          <button
            type="button"
            disabled={busy || !note.trim()}
            onClick={() => void saveNote()}
            className="mt-1.5 rounded-xl border border-slate-300 dark:border-slate-600 text-xs font-bold px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            Save note to journey
          </button>
        </div>
      ) : null}

      {/* Value ledger */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2.5">
        <p className="text-[10px] font-black uppercase tracking-wide text-slate-500 mb-1.5">
          Value ledger (90 days)
        </p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <p className="font-bold text-slate-700 dark:text-slate-200">Member sees</p>
            <p className="text-slate-500">
              {ledger.member_view.sessions_attended} sessions ·{' '}
              {ledger.member_view.notes_received} notes ·{' '}
              {ledger.member_view.goals_achieved} goals achieved
            </p>
          </div>
          <div>
            <p className="font-bold text-slate-700 dark:text-slate-200">Coach sees</p>
            <p className="text-slate-500">
              ~{ledger.coach_view.hours_delivered}h delivered ·{' '}
              {ledger.coach_view.retention_hint}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdvisorRelationshipPanel;
