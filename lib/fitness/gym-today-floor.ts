/**
 * GymAdvisor Command — today's floor board grouped by class, earliest first.
 */
import type { FitgraphStore } from '@/lib/fitness/fitgraph';
import { sessionRosterRows } from '@/lib/fitness/class-allocate';

export type GymTodayFloorMember = {
  id: string;
  name: string;
  status: string;
};

export type GymTodayFloorClass = {
  id: string;
  time: string;
  title: string;
  person?: string;
  meta?: string;
  href: string;
  members: GymTodayFloorMember[];
};

export function gymTodayFloorClasses(
  store: FitgraphStore,
  today: string
): GymTodayFloorClass[] {
  const day = String(today || '').slice(0, 10);
  const sessions = (store.sessions || [])
    .filter((s) => s.date === day && s.status !== 'cancelled')
    .slice()
    .sort(
      (a, b) =>
        String(a.start_time || '').localeCompare(String(b.start_time || '')) ||
        String(a.id).localeCompare(String(b.id))
    );
  return sessions.map((s) => {
    const ct = (store.class_types || []).find((c) => c.id === s.class_type_id);
    const coach = (store.coaches || []).find((c) => c.id === s.coach_id);
    const members = sessionRosterRows(store, s.id).map((r) => ({
      id: r.booking_id,
      name: r.name,
      status: r.status,
    }));
    return {
      id: s.id,
      time: String(s.start_time || ''),
      title: ct?.name || 'Class',
      person: coach?.name,
      meta: s.location,
      href: '/dashboard/fitgraph/calendar',
      members,
    };
  });
}
