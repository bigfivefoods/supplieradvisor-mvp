/**
 * GymAdvisor programme follow: enrollments, calendar dates, logs, progress.
 * Stored on fitgraph.programme_enrollments / programme_logs.
 */
import { addDaysIso } from '@/lib/schedule/recurrence';
import {
  hydrateProgrammeBlock,
  programmeBlocksOrLegacy,
  programmeWeekCount,
  type FitHydratedProgrammeBlock,
  type FitMovement,
  type FitProgramme,
  type FitProgrammeBlock,
  type FitProgrammeWeekday,
} from '@/lib/fitness/movements';

export type FitProgrammeEnrollmentSource = 'assigned' | 'purchased' | 'self';
export type FitProgrammeEnrollmentStatus =
  | 'active'
  | 'paused'
  | 'completed'
  | 'cancelled';
export type FitProgrammeLogStatus = 'done' | 'skipped' | 'partial';
export type FitProgrammeLogRole = 'member' | 'coach' | 'desk';

export type FitProgrammeEnrollment = {
  id: string;
  programme_id: string;
  client_id: string;
  coach_id?: string | null;
  source: FitProgrammeEnrollmentSource;
  start_date: string;
  status: FitProgrammeEnrollmentStatus;
  created_at: string;
  updated_at?: string;
};

export type FitProgrammeItemCheck = {
  item_id: string;
  done?: boolean;
  load?: string;
  notes?: string;
};

export type FitProgrammeLog = {
  id: string;
  enrollment_id: string;
  programme_id: string;
  client_id: string;
  block_id: string;
  date: string;
  status: FitProgrammeLogStatus;
  /** 1–5 how they felt (same scale as class feedback) */
  feeling?: number | null;
  /** 1–10 RPE */
  rpe?: number | null;
  comment?: string;
  coach_comment?: string;
  item_checks?: FitProgrammeItemCheck[];
  by_role: FitProgrammeLogRole;
  created_at: string;
  updated_at?: string;
};

export function isoWeekdayMon1(dateIso: string): FitProgrammeWeekday {
  const d = new Date(String(dateIso).slice(0, 10) + 'T12:00:00').getDay();
  return (d === 0 ? 7 : d) as FitProgrammeWeekday;
}

export function mondayOfIso(dateIso: string): string {
  return addDaysIso(dateIso, 1 - isoWeekdayMon1(dateIso));
}

export function blockCalendarDate(
  startDate: string,
  block: { week: number; weekday: number }
): string {
  const monday = mondayOfIso(startDate);
  const week = Math.max(1, Number(block.week) || 1);
  const weekday = Math.max(1, Math.min(7, Number(block.weekday) || 1));
  return addDaysIso(monday, (week - 1) * 7 + (weekday - 1));
}

export function clampFeeling(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return null;
  return Math.max(1, Math.min(5, n));
}

export function clampRpe(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return null;
  return Math.max(1, Math.min(10, n));
}

export function parseItemChecks(raw: unknown): FitProgrammeItemCheck[] {
  if (!Array.isArray(raw)) return [];
  const out: FitProgrammeItemCheck[] = [];
  for (const row of raw) {
    const r = (row || {}) as Record<string, unknown>;
    const itemId = String(r.item_id || '').trim();
    if (!itemId) continue;
    out.push({
      item_id: itemId,
      done: r.done === true || r.done === 'true',
      load:
        r.load != null && String(r.load).trim()
          ? String(r.load).trim()
          : undefined,
      notes:
        r.notes != null && String(r.notes).trim()
          ? String(r.notes).trim()
          : undefined,
    });
  }
  return out;
}

export function normalizeLogStatus(raw: unknown): FitProgrammeLogStatus {
  const v = String(raw || '').toLowerCase();
  if (v === 'skipped' || v === 'skip') return 'skipped';
  if (v === 'partial') return 'partial';
  return 'done';
}

export function scheduledProgrammeBlocks(
  programme: FitProgramme
): FitProgrammeBlock[] {
  return programmeBlocksOrLegacy(programme).filter(
    (b) => (b.items || []).length > 0
  );
}

export type ProgrammeProgress = {
  done: number;
  skipped: number;
  partial: number;
  total: number;
  pct: number;
  avg_feeling: number | null;
  avg_rpe: number | null;
};

export function enrollmentProgress(
  programme: FitProgramme,
  logs: FitProgrammeLog[]
): ProgrammeProgress {
  const scheduled = scheduledProgrammeBlocks(programme);
  const byBlock = new Map(logs.map((l) => [l.block_id, l]));
  let done = 0;
  let skipped = 0;
  let partial = 0;
  for (const b of scheduled) {
    const log = byBlock.get(b.id);
    if (log?.status === 'done') done += 1;
    else if (log?.status === 'skipped') skipped += 1;
    else if (log?.status === 'partial') partial += 1;
  }
  const total = scheduled.length;
  const feelings = logs
    .map((l) => l.feeling)
    .filter((n): n is number => n != null && Number.isFinite(n));
  const rpes = logs
    .map((l) => l.rpe)
    .filter((n): n is number => n != null && Number.isFinite(n));
  const avg = (arr: number[]) =>
    arr.length
      ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10
      : null;
  return {
    done,
    skipped,
    partial,
    total,
    pct: total ? Math.round(((done + partial * 0.5) / total) * 100) : 0,
    avg_feeling: avg(feelings),
    avg_rpe: avg(rpes),
  };
}

export function enrollClientOnProgramme(
  list: FitProgrammeEnrollment[],
  rec: Record<string, unknown>,
  now: string,
  newId: (prefix: string) => string
): FitProgrammeEnrollment {
  const clientId = String(rec.client_id || '').trim();
  const programmeId = String(rec.programme_id || '').trim();
  const startDate = String(rec.start_date || now).slice(0, 10);
  const sourceRaw = String(rec.source || 'assigned');
  const source: FitProgrammeEnrollmentSource =
    sourceRaw === 'purchased' || sourceRaw === 'self' ? sourceRaw : 'assigned';
  const statusRaw = String(rec.status || 'active');
  const status: FitProgrammeEnrollmentStatus =
    statusRaw === 'paused' ||
    statusRaw === 'completed' ||
    statusRaw === 'cancelled'
      ? statusRaw
      : 'active';

  const byId = rec.id
    ? list.find((e) => e.id === String(rec.id))
    : undefined;
  const live = list.find(
    (e) =>
      e.client_id === clientId &&
      e.programme_id === programmeId &&
      e.status !== 'cancelled'
  );
  const cancelled = list.find(
    (e) => e.client_id === clientId && e.programme_id === programmeId
  );
  const prev = byId || live || cancelled || null;
  const row: FitProgrammeEnrollment = {
    id: prev?.id || String(rec.id || newId('pen')),
    programme_id: programmeId || prev?.programme_id || '',
    client_id: clientId || prev?.client_id || '',
    coach_id:
      rec.coach_id !== undefined
        ? rec.coach_id
          ? String(rec.coach_id)
          : null
        : prev?.coach_id ?? null,
    source: rec.source != null ? source : prev?.source || 'assigned',
    start_date: rec.start_date != null ? startDate : prev?.start_date || startDate,
    status: rec.status != null ? status : prev?.status || 'active',
    created_at: prev?.created_at || now,
    updated_at: now,
  };
  const i = list.findIndex((e) => e.id === row.id);
  if (i >= 0) list[i] = row;
  else list.push(row);
  return row;
}

export function upsertProgrammeLog(
  list: FitProgrammeLog[],
  rec: Record<string, unknown>,
  now: string,
  newId: (prefix: string) => string
): FitProgrammeLog {
  const enrollmentId = String(rec.enrollment_id || '').trim();
  const blockId = String(rec.block_id || '').trim();
  const prev =
    (rec.id ? list.find((l) => l.id === String(rec.id)) : undefined) ||
    list.find(
      (l) => l.enrollment_id === enrollmentId && l.block_id === blockId
    ) ||
    null;
  const roleRaw = String(rec.by_role || prev?.by_role || 'member');
  const byRole: FitProgrammeLogRole =
    roleRaw === 'coach' || roleRaw === 'desk' ? roleRaw : 'member';
  const row: FitProgrammeLog = {
    id: prev?.id || String(rec.id || newId('plog')),
    enrollment_id: enrollmentId || prev?.enrollment_id || '',
    programme_id: String(rec.programme_id || prev?.programme_id || ''),
    client_id: String(rec.client_id || prev?.client_id || ''),
    block_id: blockId || prev?.block_id || '',
    date: String(rec.date || prev?.date || now).slice(0, 10),
    status:
      rec.status != null
        ? normalizeLogStatus(rec.status)
        : prev?.status || 'done',
    feeling:
      rec.feeling !== undefined ? clampFeeling(rec.feeling) : prev?.feeling ?? null,
    rpe: rec.rpe !== undefined ? clampRpe(rec.rpe) : prev?.rpe ?? null,
    comment:
      rec.comment !== undefined
        ? String(rec.comment || '').trim() || undefined
        : prev?.comment,
    coach_comment:
      rec.coach_comment !== undefined
        ? String(rec.coach_comment || '').trim() || undefined
        : prev?.coach_comment,
    item_checks:
      rec.item_checks !== undefined
        ? parseItemChecks(rec.item_checks)
        : prev?.item_checks,
    by_role: byRole,
    created_at: prev?.created_at || now,
    updated_at: now,
  };
  const i = list.findIndex((l) => l.id === row.id);
  if (i >= 0) list[i] = row;
  else list.push(row);
  return row;
}

export function copyWeekBlocks(
  blocks: FitProgrammeBlock[],
  fromWeek: number,
  toWeek: number,
  newId: (prefix: string) => string
): FitProgrammeBlock[] {
  const src = blocks.filter((b) => b.week === fromWeek);
  const rest = blocks.filter((b) => b.week !== toWeek);
  const copies = src.map((b) => ({
    ...b,
    id: newId('blk'),
    week: toWeek,
    items: (b.items || []).map((it, i) => ({
      ...it,
      id: newId('itm') + String(i),
    })),
  }));
  return [...rest, ...copies];
}

export function fillWeeksFromWeek1(
  blocks: FitProgrammeBlock[],
  weeks: number,
  newId: (prefix: string) => string
): FitProgrammeBlock[] {
  let next = blocks.filter((b) => b.week === 1);
  for (let w = 2; w <= weeks; w += 1) {
    next = copyWeekBlocks(next, 1, w, newId);
  }
  return next;
}

export type MemberProgrammeDay = {
  date: string;
  week: number;
  weekday: FitProgrammeWeekday;
  label: string;
  block: FitHydratedProgrammeBlock | null;
  log: FitProgrammeLog | null;
  is_today: boolean;
  is_past: boolean;
  before_start: boolean;
};

export type MemberProgrammeFollowView = {
  enrollment_id: string;
  programme_id: string;
  name: string;
  description?: string;
  follow_notes?: string;
  coach_name?: string | null;
  start_date: string;
  status: FitProgrammeEnrollmentStatus;
  source: FitProgrammeEnrollmentSource;
  weeks: number;
  progress: ProgrammeProgress;
  today: MemberProgrammeDay | null;
  days: MemberProgrammeDay[];
  recent_feedback: Array<{
    date: string;
    status: FitProgrammeLogStatus;
    feeling?: number | null;
    rpe?: number | null;
    comment?: string;
    coach_comment?: string;
  }>;
};

const WEEKDAY_LABEL: Record<number, string> = {
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
  7: 'Sun',
};

export function buildMemberProgrammeFollow(
  programme: FitProgramme,
  enrollment: FitProgrammeEnrollment,
  logs: FitProgrammeLog[],
  opts: {
    movements: FitMovement[];
    coachName?: string | null;
    today?: string;
  }
): MemberProgrammeFollowView {
  const today = (opts.today || new Date().toISOString()).slice(0, 10);
  const weeks = programmeWeekCount(programme);
  const blocks = programmeBlocksOrLegacy(programme);
  const logByBlock = new Map(
    logs
      .filter((l) => l.enrollment_id === enrollment.id)
      .map((l) => [l.block_id, l])
  );
  const days: MemberProgrammeDay[] = [];
  for (let week = 1; week <= weeks; week += 1) {
    for (let weekday = 1; weekday <= 7; weekday += 1) {
      const block =
        blocks.find((b) => b.week === week && b.weekday === weekday) || null;
      const date = blockCalendarDate(enrollment.start_date, {
        week,
        weekday,
      });
      const log = block ? logByBlock.get(block.id) || null : null;
      days.push({
        date,
        week,
        weekday: weekday as FitProgrammeWeekday,
        label: WEEKDAY_LABEL[weekday] || '',
        block: block ? hydrateProgrammeBlock(block, opts.movements) : null,
        log,
        is_today: date === today,
        is_past: date < today,
        before_start: date < enrollment.start_date,
      });
    }
  }
  const todayDay = days.find((d) => d.is_today && d.block) || null;
  const mine = logs
    .filter((l) => l.enrollment_id === enrollment.id)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return {
    enrollment_id: enrollment.id,
    programme_id: programme.id,
    name: programme.name,
    description: programme.description,
    follow_notes: programme.follow_notes,
    coach_name: opts.coachName ?? null,
    start_date: enrollment.start_date,
    status: enrollment.status,
    source: enrollment.source,
    weeks,
    progress: enrollmentProgress(programme, mine),
    today: todayDay,
    days,
    recent_feedback: mine.slice(0, 12).map((l) => ({
      date: l.date,
      status: l.status,
      feeling: l.feeling ?? null,
      rpe: l.rpe ?? null,
      comment: l.comment,
      coach_comment: l.coach_comment,
    })),
  };
}

export function buildMemberProgrammeFollows(opts: {
  programmes: FitProgramme[];
  enrollments: FitProgrammeEnrollment[];
  logs: FitProgrammeLog[];
  movements: FitMovement[];
  coaches?: Array<{ id: string; name: string }>;
  clientId: string;
  today?: string;
}): MemberProgrammeFollowView[] {
  const coachName = (id?: string | null) =>
    id ? opts.coaches?.find((c) => c.id === id)?.name || null : null;
  return (opts.enrollments || [])
    .filter(
      (e) =>
        e.client_id === opts.clientId &&
        e.status !== 'cancelled' &&
        e.status !== 'completed'
    )
    .map((e) => {
      const programme = opts.programmes.find((p) => p.id === e.programme_id);
      if (!programme || programme.active === false) return null;
      return buildMemberProgrammeFollow(
        programme,
        e,
        opts.logs.filter((l) => l.enrollment_id === e.id),
        {
          movements: opts.movements,
          coachName: coachName(e.coach_id || programme.coach_id),
          today: opts.today,
        }
      );
    })
    .filter((x): x is MemberProgrammeFollowView => Boolean(x))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export type CoachProgrammeClientRow = {
  enrollment_id: string;
  programme_id: string;
  programme_name: string;
  client_id: string;
  client_name: string;
  coach_id?: string | null;
  start_date: string;
  status: FitProgrammeEnrollmentStatus;
  source: FitProgrammeEnrollmentSource;
  progress: ProgrammeProgress;
  last_log: {
    date: string;
    status: FitProgrammeLogStatus;
    feeling?: number | null;
    rpe?: number | null;
    comment?: string;
    coach_comment?: string;
  } | null;
};

export function buildProgrammeFollowRoster(opts: {
  programmes: FitProgramme[];
  enrollments: FitProgrammeEnrollment[];
  logs: FitProgrammeLog[];
  clients: Array<{ id: string; name: string; coach_id?: string | null }>;
  programmeId?: string | null;
  coachId?: string | null;
}): CoachProgrammeClientRow[] {
  const clientName = (id: string) =>
    opts.clients.find((c) => c.id === id)?.name || 'Member';
  return (opts.enrollments || [])
    .filter((e) => {
      if (e.status === 'cancelled') return false;
      if (opts.programmeId && e.programme_id !== opts.programmeId) return false;
      if (opts.coachId) {
        const programme = opts.programmes.find((p) => p.id === e.programme_id);
        const client = opts.clients.find((c) => c.id === e.client_id);
        if (
          e.coach_id !== opts.coachId &&
          programme?.coach_id !== opts.coachId &&
          client?.coach_id !== opts.coachId
        ) {
          return false;
        }
      }
      return true;
    })
    .map((e) => {
      const programme = opts.programmes.find((p) => p.id === e.programme_id);
      const logs = (opts.logs || []).filter((l) => l.enrollment_id === e.id);
      const last = [...logs].sort((a, b) =>
        (b.date || '').localeCompare(a.date || '')
      )[0];
      return {
        enrollment_id: e.id,
        programme_id: e.programme_id,
        programme_name: programme?.name || 'Programme',
        client_id: e.client_id,
        client_name: clientName(e.client_id),
        coach_id: e.coach_id,
        start_date: e.start_date,
        status: e.status,
        source: e.source,
        progress: programme
          ? enrollmentProgress(programme, logs)
          : {
              done: 0,
              skipped: 0,
              partial: 0,
              total: 0,
              pct: 0,
              avg_feeling: null,
              avg_rpe: null,
            },
        last_log: last
          ? {
              date: last.date,
              status: last.status,
              feeling: last.feeling ?? null,
              rpe: last.rpe ?? null,
              comment: last.comment,
              coach_comment: last.coach_comment,
            }
          : null,
      };
    })
    .sort((a, b) => a.client_name.localeCompare(b.client_name));
}
