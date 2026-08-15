/**
 * GymAdvisor® — Coach ops: performance, payout snapshot, care queue, private clients.
 */

import type { FitClient, FitgraphStore } from '@/lib/fitness/fitgraph';
import {
  computeRelationshipHealth,
  type RelationshipHealth,
} from '@/lib/fitness/fitgraph-relationship';

export type CoachPayoutLine = {
  session_id: string;
  date: string;
  class_name: string;
  duration_min: number;
  attended: number;
  amount_zar: number | null;
  basis: string;
};

export type CoachPayoutSnapshot = {
  coach_id: string;
  coach_name: string;
  period_days: number;
  rate_zar: number | null;
  rate_basis: string;
  classes_taught: number;
  total_attended: number;
  hours_approx: number;
  estimated_due_zar: number | null;
  lines: CoachPayoutLine[];
  note: string;
  computed_at: string;
};

export type CoachPerformance = {
  coach_id: string;
  coach_name: string;
  period_days: number;
  sessions: number;
  planned_bookings: number;
  attended: number;
  no_shows: number;
  attendance_rate: number | null;
  avg_member_feel: number | null;
  avg_rpe: number | null;
  private_clients: number;
  relationship: {
    strong: number;
    steady: number;
    cooling: number;
    at_risk: number;
    unknown: number;
  };
  computed_at: string;
};

export type CareQueueItem = {
  client_id: string;
  client_name: string;
  coach_id: string | null;
  coach_name: string | null;
  health: RelationshipHealth;
  priority: number;
};

export function computeCoachPayoutSnapshot(
  store: FitgraphStore,
  coachId: string,
  periodDays = 30
): CoachPayoutSnapshot | null {
  const coach = store.coaches.find((c) => c.id === coachId);
  if (!coach) return null;
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - periodDays);
  const fromIso = from.toISOString().slice(0, 10);

  const rate =
    coach.rate_zar != null && Number.isFinite(Number(coach.rate_zar))
      ? Number(coach.rate_zar)
      : null;
  const basis = String(coach.rate_basis || 'per_class');

  const sessions = store.sessions.filter(
    (s) =>
      s.coach_id === coachId &&
      s.status !== 'cancelled' &&
      s.date >= fromIso
  );

  const lines: CoachPayoutLine[] = [];
  let totalAttended = 0;
  let minutes = 0;

  for (const s of sessions) {
    const ct = store.class_types.find((c) => c.id === s.class_type_id);
    const dur = s.duration_min ?? ct?.default_duration_min ?? 45;
    const attended = store.bookings.filter(
      (b) => b.session_id === s.id && b.status === 'attended'
    ).length;
    totalAttended += attended;
    minutes += dur;

    let amount: number | null = null;
    if (rate != null) {
      if (basis === 'hourly') amount = Math.round(rate * (dur / 60) * 100) / 100;
      else if (
        basis === 'per_session' ||
        basis === 'per_class' ||
        basis === 'fixed'
      )
        amount = rate;
      else if (basis === 'monthly') amount = null;
      else amount = rate;
    }

    lines.push({
      session_id: s.id,
      date: s.date,
      class_name: ct?.name || 'Class',
      duration_min: dur,
      attended,
      amount_zar: amount,
      basis,
    });
  }

  let estimated: number | null = null;
  if (rate != null) {
    if (basis === 'hourly') {
      estimated = Math.round(rate * (minutes / 60) * 100) / 100;
    } else if (basis === 'monthly') {
      estimated = rate;
    } else {
      estimated = Math.round(rate * sessions.length * 100) / 100;
    }
  }

  return {
    coach_id: coachId,
    coach_name: coach.name,
    period_days: periodDays,
    rate_zar: rate,
    rate_basis: basis,
    classes_taught: sessions.length,
    total_attended: totalAttended,
    hours_approx: Math.round((minutes / 60) * 10) / 10,
    estimated_due_zar: estimated,
    lines: lines.sort((a, b) => b.date.localeCompare(a.date)),
    note:
      'Tracking only — member/coach fees settle outside SupplierAdvisor. Figures use the rate on the coach profile.',
    computed_at: now.toISOString(),
  };
}

export function computeCoachPerformance(
  store: FitgraphStore,
  coachId: string,
  periodDays = 30
): CoachPerformance | null {
  const coach = store.coaches.find((c) => c.id === coachId);
  if (!coach) return null;
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - periodDays);
  const fromIso = from.toISOString().slice(0, 10);

  const sessions = store.sessions.filter(
    (s) => s.coach_id === coachId && s.date >= fromIso && s.status !== 'cancelled'
  );
  const sessionIds = new Set(sessions.map((s) => s.id));
  const bookings = store.bookings.filter((b) => sessionIds.has(b.session_id));
  const planned = bookings.filter(
    (b) =>
      b.status === 'booked' ||
      b.status === 'attended' ||
      b.status === 'no_show'
  );
  const attended = bookings.filter((b) => b.status === 'attended');
  const noShows = bookings.filter((b) => b.status === 'no_show');

  const fb = (store.class_feedback || []).filter(
    (f) =>
      f.role === 'member' &&
      sessionIds.has(f.session_id) &&
      (f.updated_at || f.created_at).slice(0, 10) >= fromIso
  );
  const avg = (nums: number[]) =>
    nums.length
      ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10
      : null;

  const privateClients = store.clients.filter(
    (c) => c.active !== false && c.private_client && c.coach_id === coachId
  );

  const rel = {
    strong: 0,
    steady: 0,
    cooling: 0,
    at_risk: 0,
    unknown: 0,
  };
  for (const c of privateClients) {
    const h = computeRelationshipHealth(store, c.id, coachId);
    rel[h.level] += 1;
  }

  return {
    coach_id: coachId,
    coach_name: coach.name,
    period_days: periodDays,
    sessions: sessions.length,
    planned_bookings: planned.length,
    attended: attended.length,
    no_shows: noShows.length,
    attendance_rate: planned.length
      ? Math.round((attended.length / planned.length) * 1000) / 10
      : null,
    avg_member_feel: avg(fb.map((f) => f.feeling)),
    avg_rpe: avg(fb.map((f) => f.intensity)),
    private_clients: privateClients.length,
    relationship: rel,
    computed_at: now.toISOString(),
  };
}

export function buildCareQueue(
  store: FitgraphStore,
  opts?: { coachId?: string | null; limit?: number }
): CareQueueItem[] {
  const clients = store.clients.filter((c) => c.active !== false);
  const items: CareQueueItem[] = [];

  for (const c of clients) {
    if (opts?.coachId) {
      const onRoster = store.bookings.some((b) => {
        if (b.client_id !== c.id || b.status === 'cancelled') return false;
        const s = store.sessions.find((x) => x.id === b.session_id);
        return s?.coach_id === opts.coachId;
      });
      if (c.coach_id !== opts.coachId && !onRoster) continue;
    }
    const health = computeRelationshipHealth(store, c.id, c.coach_id);
    if (health.level === 'strong' && health.suggested_actions.length === 0) {
      continue;
    }
    if (
      health.level === 'unknown' &&
      health.metrics.attended_60d === 0 &&
      !health.metrics.last_attended_at
    ) {
      if (!c.booking_soft_block) continue;
    }
    const coach = c.coach_id
      ? store.coaches.find((x) => x.id === c.coach_id)
      : null;
    let priority = 100 - health.score;
    if (health.level === 'at_risk') priority += 40;
    if (health.level === 'cooling') priority += 20;
    if (c.booking_soft_block) priority += 15;
    items.push({
      client_id: c.id,
      client_name: c.name,
      coach_id: c.coach_id || null,
      coach_name: coach?.name || null,
      health,
      priority,
    });
  }

  items.sort((a, b) => b.priority - a.priority);
  return items.slice(0, opts?.limit ?? 40);
}

export function privateClientsForCoach(
  store: FitgraphStore,
  coachId: string
): FitClient[] {
  return store.clients
    .filter(
      (c) =>
        c.active !== false &&
        c.private_client === true &&
        c.coach_id === coachId
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function assignableMembers(
  store: FitgraphStore,
  coachId: string
): FitClient[] {
  return store.clients
    .filter(
      (c) =>
        c.active !== false &&
        (!c.coach_id || c.coach_id === coachId || !c.private_client)
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function formatZar(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `R${n.toLocaleString('en-ZA', {
    minimumFractionDigits: n % 1 ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}
