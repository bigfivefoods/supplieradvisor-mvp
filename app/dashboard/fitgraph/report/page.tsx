'use client';

import {
  FitgraphWorkbench,
  LoadingBlock,
  useFitgraph,
} from '@/components/fitness/FitgraphWorkbench';
import { DataTable, StatRow } from '@/components/fitness/FitForm';

export default function FitReportPage() {
  const { store, loading, summary, analysis } = useFitgraph();
  const attendance =
    (analysis?.attendanceByClass as Array<{
      class_name: string;
      sessions: number;
      bookings: number;
      attended: number;
    }>) || [];

  return (
    <FitgraphWorkbench
      title="Reports"
      titleAccent="gym pulse"
      description="Membership, attendance by class, PT pack remaining and check-in volume."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <StatRow tone="owner"
            items={[
              { label: 'Active members', value: Number(summary?.activeMembers) || 0 },
              { label: 'Coaches', value: Number(summary?.coachCount) || 0 },
              { label: 'Sessions today', value: Number(summary?.sessionsToday) || 0 },
              { label: 'Check-ins today', value: Number(summary?.checkInsToday) || 0 },
              { label: 'Open bookings', value: Number(summary?.bookingsOpen) || 0 },
              { label: 'PT sessions left', value: Number(summary?.ptSessionsRemaining) || 0 },
            ]}
          />
          <DataTable tone="owner"
            headers={['Class', 'Sessions', 'Bookings', 'Attended', 'Show-up %']}
            rows={attendance.map((r, i) => ({
              id: String(i),
              cells: [
                r.class_name,
                r.sessions,
                r.bookings,
                r.attended,
                r.bookings > 0
                  ? `${Math.round((r.attended / r.bookings) * 100)}%`
                  : '—',
              ],
            }))}
          />
          <DataTable tone="owner"
            headers={['Member', 'Plan', 'Status', 'Coach']}
            rows={store.clients.map((c) => {
              const plan = store.membership_plans.find(
                (p) => p.id === c.membership_plan_id
              );
              const coach = store.coaches.find((x) => x.id === c.coach_id);
              return {
                id: c.id,
                cells: [
                  c.name,
                  plan?.name || '—',
                  c.membership_status || '—',
                  coach?.name || '—',
                ],
              };
            })}
          />
          <DataTable tone="owner"
            headers={['Client', 'PT used / total', 'Remaining']}
            rows={store.pt_packs.map((p) => {
              const client = store.clients.find((c) => c.id === p.client_id);
              const rem = Math.max(0, p.sessions_total - p.sessions_used);
              return {
                id: p.id,
                cells: [
                  client?.name || p.client_id,
                  `${p.sessions_used} / ${p.sessions_total}`,
                  rem,
                ],
              };
            })}
          />
        </div>
      )}
    </FitgraphWorkbench>
  );
}
