/**
 * Employee / contractor away windows on Advisor diaries.
 * Distinct from coach personal workouts: away means they are not available.
 */
import { addDaysIso } from '@/lib/schedule/recurrence';
import {
  leaveBlocksAssignment,
  type LeaveWindow,
} from '@/lib/core-os/leave';

export const STAFF_AWAY_REASONS = [
  'leave',
  'sick',
  'travel',
  'personal',
  'other',
] as const;
export type StaffAwayReason = (typeof STAFF_AWAY_REASONS)[number];

export const STAFF_AWAY_REASON_OPTIONS: Array<{
  value: StaffAwayReason;
  label: string;
}> = [
  { value: 'leave', label: 'Leave' },
  { value: 'sick', label: 'Sick' },
  { value: 'travel', label: 'Travel' },
  { value: 'personal', label: 'Personal' },
  { value: 'other', label: 'Other' },
];

export function normalizeStaffAwayReason(raw: unknown): StaffAwayReason {
  const v = String(raw || '')
    .trim()
    .toLowerCase();
  if (v === 'sick' || v === 'ill') return 'sick';
  if (v === 'travel' || v === 'trip') return 'travel';
  if (v === 'personal') return 'personal';
  if (v === 'other' || v === 'admin') return 'other';
  if (v === 'leave' || v === 'away' || v === 'off' || v === 'holiday') {
    return 'leave';
  }
  return 'leave';
}

export function staffAwayReasonLabel(reason?: string | null): string {
  const hit = STAFF_AWAY_REASON_OPTIONS.find(
    (o) => o.value === normalizeStaffAwayReason(reason)
  );
  return hit?.label || 'Leave';
}

export function staffAwayTitle(reason?: string | null): string {
  return `Away · ${staffAwayReasonLabel(reason)}`;
}

export function eachInclusiveDate(start: string, end: string): string[] {
  const from = String(start || '').slice(0, 10);
  let to = String(end || from).slice(0, 10);
  if (!from) return [];
  if (!to || to < from) to = from;
  const out: string[] = [];
  let cur = from;
  for (let i = 0; i < 120 && cur <= to; i += 1) {
    out.push(cur);
    cur = addDaysIso(cur, 1);
  }
  return out;
}

/** Daily recurrence through the last day away (inclusive). */
export function awayUntilRecurrence(
  start: string,
  until?: string | null
): {
  frequency: 'daily';
  interval: number;
  until: string;
  count: null;
} | null {
  const from = String(start || '').slice(0, 10);
  const to = String(until || '').slice(0, 10);
  if (!from || !to || to <= from) return null;
  return { frequency: 'daily', interval: 1, until: to, count: null };
}

export function isGymAwayKind(kind?: string | null): boolean {
  const v = String(kind || '').toLowerCase();
  return v === 'away' || v === 'leave' || v === 'off';
}

export function isGymDiaryBlockKind(kind?: string | null): boolean {
  const v = String(kind || '').toLowerCase();
  return v === 'coach_personal' || isGymAwayKind(v);
}

export function isClinicAwayReason(reason?: string | null): boolean {
  const v = String(reason || '').toLowerCase();
  return (
    v === 'leave' ||
    v === 'away' ||
    v === 'sick' ||
    v === 'travel' ||
    v === 'off'
  );
}

export function gymCoachAwayOn(
  sessions: Array<{
    id?: string;
    coach_id?: string | null;
    date?: string;
    status?: string;
    session_kind?: string | null;
  }>,
  coachId: string,
  date: string
): { session_id: string; reason?: string } | null {
  const day = String(date || '').slice(0, 10);
  const id = String(coachId || '');
  if (!id || !day) return null;
  const hit = (sessions || []).find(
    (s) =>
      String(s.coach_id || '') === id &&
      String(s.date || '').slice(0, 10) === day &&
      s.status !== 'cancelled' &&
      isGymAwayKind(s.session_kind)
  );
  if (!hit) return null;
  return { session_id: String(hit.id || ''), reason: 'away' };
}

export function clinicPractitionerAwayOn(
  appointments: Array<{
    id?: string;
    practitioner_id?: string | null;
    date?: string;
    status?: string;
    appointment_kind?: string | null;
    personal_reason?: string | null;
  }>,
  practitionerId: string,
  date: string
): { appointment_id: string; reason?: string } | null {
  const day = String(date || '').slice(0, 10);
  const id = String(practitionerId || '');
  if (!id || !day) return null;
  const hit = (appointments || []).find((a) => {
    if (String(a.practitioner_id || '') !== id) return false;
    if (String(a.date || '').slice(0, 10) !== day) return false;
    if (a.status === 'cancelled') return false;
    const kind = String(a.appointment_kind || '').toLowerCase();
    if (kind !== 'personal' && kind !== 'leave' && kind !== 'away') {
      return false;
    }
    return isClinicAwayReason(a.personal_reason) || kind === 'away';
  });
  if (!hit) return null;
  return {
    appointment_id: String(hit.id || ''),
    reason: String(hit.personal_reason || 'leave'),
  };
}

export function staffAssignmentBlocked(opts: {
  personId: string;
  date: string;
  hrEmployeeId?: number | null;
  hrWindows?: LeaveWindow[];
  diaryAway?: { reason?: string } | null;
}): { blocked: boolean; reason?: string } {
  const hr = leaveBlocksAssignment(
    opts.hrWindows || [],
    opts.personId,
    opts.date,
    opts.hrEmployeeId
  );
  if (hr.blocked) return hr;
  if (opts.diaryAway) {
    const label = staffAwayReasonLabel(opts.diaryAway.reason);
    return {
      blocked: true,
      reason: `is away (${label}) on ${String(opts.date).slice(0, 10)}`,
    };
  }
  return { blocked: false };
}

export function clashTitlesOnAwayDates<
  T extends { date: string; status?: string; title?: string },
>(rows: T[], start: string, until?: string | null): T[] {
  const days = new Set(eachInclusiveDate(start, until || start));
  return (rows || []).filter(
    (r) => r.status !== 'cancelled' && days.has(String(r.date || '').slice(0, 10))
  );
}
