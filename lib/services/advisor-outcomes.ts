/**
 * Outcomes / ops KPIs for Advisor modules from store bookings + feedback.
 */

export type OutcomesSnapshot = {
  period_days: number;
  bookings_total: number;
  attended: number;
  no_shows: number;
  cancelled: number;
  waitlist: number;
  attendance_rate: number | null;
  no_show_rate: number | null;
  rebook_score_avg: number | null;
  feeling_avg: number | null;
  feedback_count: number;
  soft_blocked_people: number;
  /** Top classes / services by attendance */
  top_events: Array<{ name: string; attended: number }>;
};

type BookingLike = {
  status: string;
  booked_at?: string;
  session_id?: string;
  appointment_id?: string;
};

type FeedbackLike = {
  feeling?: number;
  would_return?: number;
  created_at?: string;
  event_id?: string;
};

export function computeOutcomes(opts: {
  bookings: BookingLike[];
  feedback?: FeedbackLike[];
  eventNameById?: Record<string, string>;
  peopleSoftBlocked?: number;
  periodDays?: number;
}): OutcomesSnapshot {
  const days = opts.periodDays ?? 30;
  const cutoff = Date.now() - days * 86400000;
  const recent = opts.bookings.filter((b) => {
    const t = b.booked_at ? new Date(b.booked_at).getTime() : 0;
    return !t || t >= cutoff;
  });
  const attended = recent.filter((b) => b.status === 'attended').length;
  const no_shows = recent.filter((b) => b.status === 'no_show').length;
  const cancelled = recent.filter((b) => b.status === 'cancelled').length;
  const waitlist = recent.filter((b) => b.status === 'waitlist').length;
  const completed = attended + no_shows;
  const feedback = (opts.feedback || []).filter((f) => {
    if (!f.created_at) return true;
    return new Date(f.created_at).getTime() >= cutoff;
  });
  const feelingVals = feedback
    .map((f) => Number(f.feeling))
    .filter((n) => Number.isFinite(n) && n > 0);
  const rebookVals = feedback
    .map((f) => Number(f.would_return))
    .filter((n) => Number.isFinite(n) && n > 0);

  const byEvent: Record<string, number> = {};
  for (const b of recent) {
    if (b.status !== 'attended') continue;
    const eid = b.session_id || b.appointment_id || '';
    if (!eid) continue;
    byEvent[eid] = (byEvent[eid] || 0) + 1;
  }
  const top_events = Object.entries(byEvent)
    .map(([id, n]) => ({
      name: opts.eventNameById?.[id] || id.slice(0, 12),
      attended: n,
    }))
    .sort((a, b) => b.attended - a.attended)
    .slice(0, 5);

  return {
    period_days: days,
    bookings_total: recent.length,
    attended,
    no_shows,
    cancelled,
    waitlist,
    attendance_rate:
      completed > 0 ? Math.round((attended / completed) * 1000) / 10 : null,
    no_show_rate:
      completed > 0 ? Math.round((no_shows / completed) * 1000) / 10 : null,
    rebook_score_avg: rebookVals.length
      ? Math.round(
          (rebookVals.reduce((a, b) => a + b, 0) / rebookVals.length) * 10
        ) / 10
      : null,
    feeling_avg: feelingVals.length
      ? Math.round(
          (feelingVals.reduce((a, b) => a + b, 0) / feelingVals.length) * 10
        ) / 10
      : null,
    feedback_count: feedback.length,
    soft_blocked_people: opts.peopleSoftBlocked || 0,
    top_events,
  };
}

/** Patients/clients due for recall (last attended > N days ago) */
export function recallCandidates(opts: {
  people: Array<{
    id: string;
    name: string;
    email?: string;
    active?: boolean;
  }>;
  bookings: Array<{
    patient_id?: string;
    client_id?: string;
    status: string;
    booked_at?: string;
  }>;
  recallAfterDays?: number;
}): Array<{
  id: string;
  name: string;
  email?: string;
  last_attended: string | null;
  days_since: number | null;
}> {
  const after = opts.recallAfterDays ?? 180;
  const lastByPerson: Record<string, string> = {};
  for (const b of opts.bookings) {
    if (b.status !== 'attended') continue;
    const pid = b.patient_id || b.client_id;
    if (!pid || !b.booked_at) continue;
    if (!lastByPerson[pid] || b.booked_at > lastByPerson[pid]) {
      lastByPerson[pid] = b.booked_at;
    }
  }
  const now = Date.now();
  const out: Array<{
    id: string;
    name: string;
    email?: string;
    last_attended: string | null;
    days_since: number | null;
  }> = [];
  for (const p of opts.people) {
    if (p.active === false) continue;
    const last = lastByPerson[p.id] || null;
    if (!last) {
      out.push({
        id: p.id,
        name: p.name,
        email: p.email,
        last_attended: null,
        days_since: null,
      });
      continue;
    }
    const days = Math.floor(
      (now - new Date(last).getTime()) / 86400000
    );
    if (days >= after) {
      out.push({
        id: p.id,
        name: p.name,
        email: p.email,
        last_attended: last.slice(0, 10),
        days_since: days,
      });
    }
  }
  return out.sort(
    (a, b) => (b.days_since || 9999) - (a.days_since || 9999)
  );
}
