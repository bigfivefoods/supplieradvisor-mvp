'use client';

import {
  FitgraphWorkbench,
  LoadingBlock,
  useFitgraph,
} from '@/components/fitness/FitgraphWorkbench';
import { DataTable, StatRow } from '@/components/fitness/FitForm';
import {
  FEEDBACK_FEELING_LABELS,
  type FitClassFeedback,
} from '@/lib/fitness/fitgraph';

function sessionLabel(
  store: NonNullable<ReturnType<typeof useFitgraph>['store']>,
  sessionId: string
) {
  const s = store.sessions.find((x) => x.id === sessionId);
  if (!s) return sessionId.slice(0, 8);
  const ct = store.class_types.find((c) => c.id === s.class_type_id);
  return `${s.date} ${s.start_time} · ${ct?.name || 'Class'}`;
}

function authorLabel(
  store: NonNullable<ReturnType<typeof useFitgraph>['store']>,
  f: FitClassFeedback
) {
  if (f.role === 'coach') {
    const c = store.coaches.find((x) => x.id === f.coach_id);
    return c?.name || f.author_name || 'Coach';
  }
  const client = store.clients.find((x) => x.id === f.client_id);
  return client?.name || f.author_name || f.author_email || 'Member';
}

export default function FitFeedbackPage() {
  const { store, loading, summary, analysis } = useFitgraph();
  const recent =
    (analysis?.recentFeedback as FitClassFeedback[] | undefined) ||
    (store?.class_feedback
      ? [...store.class_feedback].sort((a, b) =>
          (b.updated_at || b.created_at).localeCompare(
            a.updated_at || a.created_at
          )
        )
      : []);

  const members = recent.filter((f) => f.role === 'member');
  const coaches = recent.filter((f) => f.role === 'coach');
  const avg = (arr: number[]) =>
    arr.length
      ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10
      : null;

  return (
    <FitgraphWorkbench
      title="Class feedback"
      titleAccent="feel · intensity"
      description="Member and coach check-ins after class: how they feel, intensity (RPE), enjoyment, and comments. Members use the class join link; coaches use their portal."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <StatRow
            tone="owner"
            items={[
              {
                label: 'All feedback',
                value:
                  Number(summary?.feedbackCount) ||
                  (store.class_feedback || []).length,
              },
              {
                label: 'Member',
                value:
                  Number(summary?.memberFeedbackCount) || members.length,
              },
              {
                label: 'Coach',
                value:
                  Number(summary?.coachFeedbackCount) || coaches.length,
              },
              {
                label: 'Avg feel (members)',
                value: avg(members.map((m) => m.feeling)) ?? '—',
              },
              {
                label: 'Avg RPE (members)',
                value: avg(members.map((m) => m.intensity)) ?? '—',
              },
            ]}
          />

          <DataTable
            tone="owner"
            headers={[
              'When',
              'Class',
              'Who',
              'Role',
              'Feel',
              'Intensity',
              'Enjoy',
              'Again',
              'Tags',
              'Comment',
            ]}
            rows={recent.map((f) => ({
              id: f.id,
              cells: [
                (f.updated_at || f.created_at || '').slice(0, 16).replace('T', ' '),
                sessionLabel(store, f.session_id),
                authorLabel(store, f),
                f.role,
                `${f.feeling}/5 ${FEEDBACK_FEELING_LABELS[f.feeling] || ''}`,
                `${f.intensity}/10`,
                f.enjoyment != null ? `${f.enjoyment}/5` : '—',
                f.would_return != null ? `${f.would_return}/5` : '—',
                (f.tags || []).join(', ') || '—',
                f.comment
                  ? f.comment.length > 48
                    ? `${f.comment.slice(0, 48)}…`
                    : f.comment
                  : '—',
              ],
            }))}
          />

          {(store.class_feedback || []).length === 0 && (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              No feedback yet. Members submit from their class join link after
              the session; coaches submit from the coach portal session detail.
            </p>
          )}
        </div>
      )}
    </FitgraphWorkbench>
  );
}
