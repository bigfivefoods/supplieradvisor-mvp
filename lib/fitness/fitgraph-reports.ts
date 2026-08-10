/**
 * Fitgraph owner reports — pure slice/dice aggregates over FitgraphStore.
 */
import {
  FEEDBACK_FEELING_LABELS,
  classTypeById,
  coachById,
  clientById,
  formatCoachRate,
  summariseSessionFeedback,
  type FitBooking,
  type FitClassFeedback,
  type FitgraphStore,
  type FitSession,
} from '@/lib/fitness/fitgraph';

export type ReportDatePreset = '7d' | '30d' | '90d' | 'ytd' | 'all' | 'custom';

export type ReportFilters = {
  from: string; // YYYY-MM-DD inclusive
  to: string;
  coachId: string; // '' = all
  classTypeId: string; // '' = all
  specialty: string; // '' = all
  /** member | coach | '' all — for feedback views */
  feedbackRole: '' | 'member' | 'coach';
  sessionStatus: '' | 'scheduled' | 'completed' | 'cancelled' | 'full';
};

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysIso(dateIso: string, days: number): string {
  const d = new Date(dateIso + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function rangeFromPreset(preset: ReportDatePreset): {
  from: string;
  to: string;
} {
  const to = todayIso();
  if (preset === 'all') return { from: '2000-01-01', to };
  if (preset === 'ytd') return { from: `${to.slice(0, 4)}-01-01`, to };
  if (preset === '7d') return { from: addDaysIso(to, -6), to };
  if (preset === '90d') return { from: addDaysIso(to, -89), to };
  if (preset === 'custom') return { from: addDaysIso(to, -29), to };
  return { from: addDaysIso(to, -29), to }; // 30d default
}

function inRange(date: string, from: string, to: string) {
  return date >= from && date <= to;
}

function coachMatchesSpecialty(
  store: FitgraphStore,
  coachId: string | null | undefined,
  specialty: string
): boolean {
  if (!specialty) return true;
  if (!coachId) return false;
  const c = coachById(store, coachId);
  return (c?.specialties || []).some(
    (s) => s.toLowerCase() === specialty.toLowerCase()
  );
}

export function filterSessions(
  store: FitgraphStore,
  f: ReportFilters
): FitSession[] {
  return (store.sessions || []).filter((s) => {
    if (!inRange(s.date, f.from, f.to)) return false;
    if (f.coachId && s.coach_id !== f.coachId) return false;
    if (f.classTypeId && s.class_type_id !== f.classTypeId) return false;
    if (f.sessionStatus && s.status !== f.sessionStatus) return false;
    if (f.specialty && !coachMatchesSpecialty(store, s.coach_id, f.specialty)) {
      return false;
    }
    return true;
  });
}

function bookingsForSession(
  store: FitgraphStore,
  sessionId: string
): FitBooking[] {
  return (store.bookings || []).filter((b) => b.session_id === sessionId);
}

export type SessionFact = {
  session: FitSession;
  class_name: string;
  class_code: string;
  coach_id: string | null;
  coach_name: string;
  coach_code: string;
  capacity: number;
  planned: number; // booked + attended + no_show (on the plan)
  waitlist: number;
  attended: number;
  no_show: number;
  cancelled_bookings: number;
  pending: number; // still booked, not marked
  fill_pct: number | null; // attended / capacity
  plan_fill_pct: number | null; // planned / capacity
  show_up_pct: number | null; // attended / (attended + no_show + pending planned)
  feedback_member: number;
  feedback_coach: number;
  avg_feeling: number | null;
  avg_intensity: number | null;
  avg_enjoyment: number | null;
};

export function buildSessionFacts(
  store: FitgraphStore,
  f: ReportFilters
): SessionFact[] {
  return filterSessions(store, f)
    .map((s) => {
      const ct = classTypeById(store, s.class_type_id);
      const coach = coachById(store, s.coach_id);
      const rows = bookingsForSession(store, s.id);
      const planned = rows.filter(
        (b) =>
          b.status === 'booked' ||
          b.status === 'attended' ||
          b.status === 'no_show'
      ).length;
      const waitlist = rows.filter((b) => b.status === 'waitlist').length;
      const attended = rows.filter((b) => b.status === 'attended').length;
      const no_show = rows.filter((b) => b.status === 'no_show').length;
      const cancelled_bookings = rows.filter(
        (b) => b.status === 'cancelled'
      ).length;
      const pending = rows.filter((b) => b.status === 'booked').length;
      const capacity = s.capacity ?? ct?.capacity ?? 0;
      const decided = attended + no_show;
      const fb = summariseSessionFeedback(store, s.id);
      return {
        session: s,
        class_name: ct?.name || 'Class',
        class_code: ct?.code || '—',
        coach_id: s.coach_id || null,
        coach_name: coach?.name || 'Unassigned',
        coach_code: coach?.code || '—',
        capacity,
        planned,
        waitlist,
        attended,
        no_show,
        cancelled_bookings,
        pending,
        fill_pct:
          capacity > 0 ? Math.round((attended / capacity) * 1000) / 10 : null,
        plan_fill_pct:
          capacity > 0 ? Math.round((planned / capacity) * 1000) / 10 : null,
        show_up_pct:
          decided + pending > 0
            ? Math.round((attended / (decided + pending)) * 1000) / 10
            : null,
        feedback_member: fb.member_count,
        feedback_coach: fb.coach_count,
        avg_feeling: fb.avg_feeling,
        avg_intensity: fb.avg_intensity,
        avg_enjoyment: fb.avg_enjoyment,
      };
    })
    .sort((a, b) =>
      a.session.date === b.session.date
        ? a.session.start_time.localeCompare(b.session.start_time)
        : b.session.date.localeCompare(a.session.date)
    );
}

export type CoachReportRow = {
  coach_id: string;
  code: string;
  name: string;
  specialties: string[];
  active: boolean;
  rate: string;
  sessions: number;
  planned: number;
  attended: number;
  no_show: number;
  waitlist: number;
  capacity_seats: number;
  fill_pct: number | null;
  show_up_pct: number | null;
  member_feedback: number;
  coach_feedback: number;
  avg_member_feeling: number | null;
  avg_member_intensity: number | null;
  avg_coach_feeling: number | null;
  avg_coach_intensity: number | null;
};

export function buildCoachReport(
  store: FitgraphStore,
  f: ReportFilters,
  facts: SessionFact[]
): CoachReportRow[] {
  const byCoach = new Map<string, SessionFact[]>();
  for (const fact of facts) {
    const id = fact.coach_id || '_none';
    if (!byCoach.has(id)) byCoach.set(id, []);
    byCoach.get(id)!.push(fact);
  }

  // Include coaches with no sessions in range if filter is all coaches
  const coachIds = new Set<string>([
    ...byCoach.keys(),
    ...(f.coachId
      ? [f.coachId]
      : (store.coaches || []).map((c) => c.id)),
  ]);

  const rows: CoachReportRow[] = [];
  for (const id of coachIds) {
    if (id === '_none' && f.coachId) continue;
    const coach = id === '_none' ? null : coachById(store, id);
    if (f.specialty && coach) {
      if (
        !(coach.specialties || []).some(
          (s) => s.toLowerCase() === f.specialty.toLowerCase()
        )
      ) {
        continue;
      }
    }
    if (f.coachId && id !== f.coachId) continue;

    const list = byCoach.get(id) || [];
    const planned = list.reduce((n, x) => n + x.planned, 0);
    const attended = list.reduce((n, x) => n + x.attended, 0);
    const no_show = list.reduce((n, x) => n + x.no_show, 0);
    const waitlist = list.reduce((n, x) => n + x.waitlist, 0);
    const capacity_seats = list.reduce((n, x) => n + x.capacity, 0);
    const pending = list.reduce((n, x) => n + x.pending, 0);
    const decided = attended + no_show;

    const feelings = list
      .map((x) => x.avg_feeling)
      .filter((n): n is number => n != null);
    const intensities = list
      .map((x) => x.avg_intensity)
      .filter((n): n is number => n != null);

    // Coach's own feedback in range
    const coachFb = (store.class_feedback || []).filter((fb) => {
      if (fb.role !== 'coach' || fb.coach_id !== id) return false;
      const s = store.sessions.find((x) => x.id === fb.session_id);
      return s && inRange(s.date, f.from, f.to);
    });

    const avg = (arr: number[]) =>
      arr.length
        ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10
        : null;

    rows.push({
      coach_id: id,
      code: coach?.code || '—',
      name: coach?.name || 'Unassigned',
      specialties: coach?.specialties || [],
      active: coach ? coach.active !== false && !coach.end_date : false,
      rate: coach
        ? formatCoachRate(coach.rate_zar, coach.rate_basis)
        : '—',
      sessions: list.length,
      planned,
      attended,
      no_show,
      waitlist,
      capacity_seats,
      fill_pct:
        capacity_seats > 0
          ? Math.round((attended / capacity_seats) * 1000) / 10
          : null,
      show_up_pct:
        decided + pending > 0
          ? Math.round((attended / (decided + pending)) * 1000) / 10
          : null,
      member_feedback: list.reduce((n, x) => n + x.feedback_member, 0),
      coach_feedback: coachFb.length,
      avg_member_feeling: avg(feelings),
      avg_member_intensity: avg(intensities),
      avg_coach_feeling: avg(coachFb.map((x) => x.feeling)),
      avg_coach_intensity: avg(coachFb.map((x) => x.intensity)),
    });
  }

  return rows.sort(
    (a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name)
  );
}

export type ClassReportRow = {
  class_type_id: string;
  code: string;
  name: string;
  category: string;
  sessions: number;
  planned: number;
  attended: number;
  no_show: number;
  waitlist: number;
  capacity_seats: number;
  fill_pct: number | null;
  show_up_pct: number | null;
  member_feedback: number;
  avg_feeling: number | null;
  avg_intensity: number | null;
  avg_enjoyment: number | null;
};

export function buildClassReport(facts: SessionFact[]): ClassReportRow[] {
  const map = new Map<string, SessionFact[]>();
  for (const f of facts) {
    const id = f.session.class_type_id || '_none';
    if (!map.has(id)) map.set(id, []);
    map.get(id)!.push(f);
  }
  const rows: ClassReportRow[] = [];
  for (const [id, list] of map) {
    const first = list[0];
    const planned = list.reduce((n, x) => n + x.planned, 0);
    const attended = list.reduce((n, x) => n + x.attended, 0);
    const no_show = list.reduce((n, x) => n + x.no_show, 0);
    const waitlist = list.reduce((n, x) => n + x.waitlist, 0);
    const capacity_seats = list.reduce((n, x) => n + x.capacity, 0);
    const pending = list.reduce((n, x) => n + x.pending, 0);
    const decided = attended + no_show;
    const feelings = list
      .map((x) => x.avg_feeling)
      .filter((n): n is number => n != null);
    const intensities = list
      .map((x) => x.avg_intensity)
      .filter((n): n is number => n != null);
    const enjoyments = list
      .map((x) => x.avg_enjoyment)
      .filter((n): n is number => n != null);
    const avg = (arr: number[]) =>
      arr.length
        ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10
        : null;
    rows.push({
      class_type_id: id,
      code: first.class_code,
      name: first.class_name,
      category: '', // filled by caller if needed
      sessions: list.length,
      planned,
      attended,
      no_show,
      waitlist,
      capacity_seats,
      fill_pct:
        capacity_seats > 0
          ? Math.round((attended / capacity_seats) * 1000) / 10
          : null,
      show_up_pct:
        decided + pending > 0
          ? Math.round((attended / (decided + pending)) * 1000) / 10
          : null,
      member_feedback: list.reduce((n, x) => n + x.feedback_member, 0),
      avg_feeling: avg(feelings),
      avg_intensity: avg(intensities),
      avg_enjoyment: avg(enjoyments),
    });
  }
  return rows.sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name));
}

export type FeedbackReportRow = FitClassFeedback & {
  session_date: string;
  session_time: string;
  class_name: string;
  coach_name: string;
  author_label: string;
};

export function buildFeedbackReport(
  store: FitgraphStore,
  f: ReportFilters
): FeedbackReportRow[] {
  const sessionIds = new Set(filterSessions(store, f).map((s) => s.id));
  return (store.class_feedback || [])
    .filter((fb) => {
      if (!sessionIds.has(fb.session_id)) return false;
      if (f.feedbackRole && fb.role !== f.feedbackRole) return false;
      return true;
    })
    .map((fb) => {
      const s = store.sessions.find((x) => x.id === fb.session_id);
      const ct = s ? classTypeById(store, s.class_type_id) : undefined;
      const coach = s ? coachById(store, s.coach_id) : undefined;
      let author_label = fb.author_name || fb.author_email || fb.role;
      if (fb.role === 'coach') {
        const c = coachById(store, fb.coach_id);
        author_label = c?.name || author_label;
      } else {
        const client = clientById(store, fb.client_id);
        author_label = client?.name || author_label;
      }
      return {
        ...fb,
        session_date: s?.date || '—',
        session_time: s?.start_time || '—',
        class_name: ct?.name || 'Class',
        coach_name: coach?.name || '—',
        author_label,
      };
    })
    .sort((a, b) =>
      (b.updated_at || b.created_at).localeCompare(a.updated_at || a.created_at)
    );
}

export type OverviewKpis = {
  sessions: number;
  completed: number;
  cancelled: number;
  planned_seats: number;
  attended: number;
  no_show: number;
  waitlist: number;
  pending_actuals: number;
  capacity_seats: number;
  fill_pct: number | null;
  show_up_pct: number | null;
  member_feedback: number;
  coach_feedback: number;
  avg_feeling: number | null;
  avg_intensity: number | null;
  avg_enjoyment: number | null;
  active_members: number;
  check_ins_in_range: number;
  coaches_teaching: number;
  class_types_run: number;
  open_bookings: number;
  pt_remaining: number;
};

export function buildOverview(
  store: FitgraphStore,
  f: ReportFilters,
  facts: SessionFact[]
): OverviewKpis {
  const planned = facts.reduce((n, x) => n + x.planned, 0);
  const attended = facts.reduce((n, x) => n + x.attended, 0);
  const no_show = facts.reduce((n, x) => n + x.no_show, 0);
  const waitlist = facts.reduce((n, x) => n + x.waitlist, 0);
  const pending = facts.reduce((n, x) => n + x.pending, 0);
  const capacity = facts.reduce((n, x) => n + x.capacity, 0);
  const decided = attended + no_show;
  const feelings = facts
    .map((x) => x.avg_feeling)
    .filter((n): n is number => n != null);
  const intensities = facts
    .map((x) => x.avg_intensity)
    .filter((n): n is number => n != null);
  const enjoyments = facts
    .map((x) => x.avg_enjoyment)
    .filter((n): n is number => n != null);
  const avg = (arr: number[]) =>
    arr.length
      ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10
      : null;

  const sessionIds = new Set(facts.map((x) => x.session.id));
  const fb = (store.class_feedback || []).filter((x) =>
    sessionIds.has(x.session_id)
  );

  const check_ins_in_range = (store.check_ins || []).filter((c) =>
    inRange(c.date, f.from, f.to)
  ).length;

  return {
    sessions: facts.length,
    completed: facts.filter((x) => x.session.status === 'completed').length,
    cancelled: filterSessions(store, {
      ...f,
      sessionStatus: 'cancelled',
    }).length,
    planned_seats: planned,
    attended,
    no_show,
    waitlist,
    pending_actuals: pending,
    capacity_seats: capacity,
    fill_pct:
      capacity > 0 ? Math.round((attended / capacity) * 1000) / 10 : null,
    show_up_pct:
      decided + pending > 0
        ? Math.round((attended / (decided + pending)) * 1000) / 10
        : null,
    member_feedback: fb.filter((x) => x.role === 'member').length,
    coach_feedback: fb.filter((x) => x.role === 'coach').length,
    avg_feeling: avg(feelings),
    avg_intensity: avg(intensities),
    avg_enjoyment: avg(enjoyments),
    active_members: (store.clients || []).filter(
      (c) =>
        c.active !== false &&
        (c.membership_status === 'active' || c.membership_status === 'trial')
    ).length,
    check_ins_in_range,
    coaches_teaching: new Set(
      facts.map((x) => x.coach_id).filter(Boolean) as string[]
    ).size,
    class_types_run: new Set(facts.map((x) => x.session.class_type_id)).size,
    open_bookings: (store.bookings || []).filter((b) => {
      if (b.status !== 'booked' && b.status !== 'waitlist') return false;
      const s = store.sessions.find((x) => x.id === b.session_id);
      return s && inRange(s.date, f.from, f.to);
    }).length,
    pt_remaining: (store.pt_packs || []).reduce(
      (n, p) =>
        n +
        Math.max(
          0,
          (Number(p.sessions_total) || 0) - (Number(p.sessions_used) || 0)
        ),
      0
    ),
  };
}

export type MemberReportRow = {
  id: string;
  code: string;
  name: string;
  status: string;
  plan: string;
  coach: string;
  bookings_in_range: number;
  attended_in_range: number;
  no_show_in_range: number;
  check_ins_in_range: number;
  feedback_in_range: number;
};

export function buildMemberReport(
  store: FitgraphStore,
  f: ReportFilters,
  facts: SessionFact[]
): MemberReportRow[] {
  const sessionIds = new Set(facts.map((x) => x.session.id));
  return (store.clients || [])
    .filter((c) => c.active !== false)
    .map((c) => {
      const books = (store.bookings || []).filter(
        (b) => b.client_id === c.id && sessionIds.has(b.session_id)
      );
      const plan = store.membership_plans.find(
        (p) => p.id === c.membership_plan_id
      );
      const coach = coachById(store, c.coach_id);
      return {
        id: c.id,
        code: c.code,
        name: c.name,
        status: String(c.membership_status || '—'),
        plan: plan?.name || '—',
        coach: coach?.name || '—',
        bookings_in_range: books.filter((b) => b.status !== 'cancelled')
          .length,
        attended_in_range: books.filter((b) => b.status === 'attended').length,
        no_show_in_range: books.filter((b) => b.status === 'no_show').length,
        check_ins_in_range: (store.check_ins || []).filter(
          (ci) =>
            ci.client_id === c.id && inRange(ci.date, f.from, f.to)
        ).length,
        feedback_in_range: (store.class_feedback || []).filter(
          (fb) =>
            fb.role === 'member' &&
            fb.client_id === c.id &&
            sessionIds.has(fb.session_id)
        ).length,
      };
    })
    .filter(
      (r) =>
        r.bookings_in_range > 0 ||
        r.check_ins_in_range > 0 ||
        r.feedback_in_range > 0
    )
    .sort(
      (a, b) =>
        b.attended_in_range - a.attended_in_range ||
        a.name.localeCompare(b.name)
    );
}

/** Daily time series for charts (simple bar data) */
export type DailyPoint = {
  date: string;
  sessions: number;
  planned: number;
  attended: number;
  no_show: number;
  feedback: number;
};

export function buildDailySeries(facts: SessionFact[]): DailyPoint[] {
  const map = new Map<string, DailyPoint>();
  for (const f of facts) {
    const d = f.session.date;
    if (!map.has(d)) {
      map.set(d, {
        date: d,
        sessions: 0,
        planned: 0,
        attended: 0,
        no_show: 0,
        feedback: 0,
      });
    }
    const row = map.get(d)!;
    row.sessions += 1;
    row.planned += f.planned;
    row.attended += f.attended;
    row.no_show += f.no_show;
    row.feedback += f.feedback_member + f.feedback_coach;
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function pctLabel(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${n}%`;
}

export function numLabel(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return String(n);
}

export function feelingLabel(n: number | null | undefined): string {
  if (n == null) return '—';
  const rounded = Math.round(n);
  const word = FEEDBACK_FEELING_LABELS[rounded] || '';
  return word ? `${n} (${word})` : String(n);
}

/** Escape CSV cell */
function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>
): string {
  const lines = [
    headers.map(csvCell).join(','),
    ...rows.map((r) => r.map(csvCell).join(',')),
  ];
  return '\uFEFF' + lines.join('\n');
}

export function downloadCsv(filename: string, csv: string) {
  if (typeof window === 'undefined') return;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function buildFullReport(store: FitgraphStore, f: ReportFilters) {
  const facts = buildSessionFacts(store, f);
  // Enrich class categories
  const classRows = buildClassReport(facts).map((r) => {
    const ct = store.class_types.find((c) => c.id === r.class_type_id);
    return { ...r, category: ct?.category || '—' };
  });
  return {
    filters: f,
    overview: buildOverview(store, f, facts),
    sessions: facts,
    coaches: buildCoachReport(store, f, facts),
    classes: classRows,
    planActual: facts,
    feedback: buildFeedbackReport(store, f),
    members: buildMemberReport(store, f, facts),
    daily: buildDailySeries(facts),
  };
}

export type FitFullReport = ReturnType<typeof buildFullReport>;
