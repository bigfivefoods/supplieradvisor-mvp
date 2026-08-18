/**
 * Post-treatment reminders and lasting advice on the patient record.
 * Shown on the practice chart and on the member portal / SA Member PWA.
 */
import type { SharedAdviceNote } from '@/lib/clinic/medical-share';

export const FOLLOW_UP_STATUSES = [
  'scheduled',
  'sent',
  'done',
  'cancelled',
] as const;

export type PatientFollowUpStatus = (typeof FOLLOW_UP_STATUSES)[number];

export type PatientFollowUp = {
  id: string;
  /** YYYY-MM-DD — when to remind the patient */
  remind_on: string;
  title?: string;
  /** Patient-facing post-treatment advice (stays on the record) */
  advice: string;
  /** Extra message sent with the reminder */
  message?: string | null;
  desk_note?: string | null;
  status: PatientFollowUpStatus;
  appointment_id?: string | null;
  /** Diary slot booked as the follow-up visit */
  next_appointment_id?: string | null;
  created_at: string;
  sent_at?: string | null;
  author_name?: string | null;
};

export function newFollowUpId(): string {
  return `pfu_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function ymd(raw: unknown, fallback: string): string {
  const s = String(raw || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : fallback;
}

export function normalizeFollowUps(raw: unknown): PatientFollowUp[] {
  if (!Array.isArray(raw)) return [];
  const today = new Date().toISOString().slice(0, 10);
  const out: PatientFollowUp[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const advice = String(r.advice || r.body || '').trim();
    if (!advice && !r.id) continue;
    const status = FOLLOW_UP_STATUSES.includes(
      String(r.status) as PatientFollowUpStatus
    )
      ? (r.status as PatientFollowUpStatus)
      : 'scheduled';
    out.push({
      id: String(r.id || newFollowUpId()),
      remind_on: ymd(r.remind_on || r.date, today),
      title: r.title != null ? String(r.title) : undefined,
      advice,
      message: r.message != null ? String(r.message) : null,
      desk_note: r.desk_note != null ? String(r.desk_note) : null,
      status,
      appointment_id: r.appointment_id ? String(r.appointment_id) : null,
      next_appointment_id: r.next_appointment_id
        ? String(r.next_appointment_id)
        : null,
      created_at: String(r.created_at || new Date().toISOString()),
      sent_at: r.sent_at != null ? String(r.sent_at) : null,
      author_name: r.author_name != null ? String(r.author_name) : null,
    });
  }
  return out.sort((a, b) => b.remind_on.localeCompare(a.remind_on));
}

export function upsertPatientFollowUp(
  list: PatientFollowUp[] | undefined,
  rec: Partial<PatientFollowUp> & { advice?: string },
  now = new Date().toISOString()
): PatientFollowUp[] {
  const rows = normalizeFollowUps(list);
  const advice = String(rec.advice || '').trim();
  if (!advice && !rec.id) throw new Error('Advice is required');
  const id = String(rec.id || newFollowUpId());
  const i = rows.findIndex((r) => r.id === id);
  const prev = i >= 0 ? rows[i] : null;
  const next: PatientFollowUp = {
    id,
    remind_on: ymd(rec.remind_on, prev?.remind_on || now.slice(0, 10)),
    title: rec.title !== undefined ? rec.title : prev?.title,
    advice: advice || prev?.advice || '',
    message:
      rec.message !== undefined ? rec.message : prev?.message ?? null,
    desk_note:
      rec.desk_note !== undefined ? rec.desk_note : prev?.desk_note ?? null,
    status: rec.status || prev?.status || 'scheduled',
    appointment_id:
      rec.appointment_id !== undefined
        ? rec.appointment_id
        : prev?.appointment_id ?? null,
    next_appointment_id:
      rec.next_appointment_id !== undefined
        ? rec.next_appointment_id
        : prev?.next_appointment_id ?? null,
    created_at: prev?.created_at || now,
    sent_at: rec.sent_at !== undefined ? rec.sent_at : prev?.sent_at ?? null,
    author_name:
      rec.author_name !== undefined
        ? rec.author_name
        : prev?.author_name ?? null,
  };
  if (!next.advice) throw new Error('Advice is required');
  if (i >= 0) rows[i] = next;
  else rows.unshift(next);
  return rows.sort((a, b) => b.remind_on.localeCompare(a.remind_on));
}

export function patientFacingFollowUps(
  list: PatientFollowUp[] | undefined
): PatientFollowUp[] {
  return (list || []).filter(
    (f) => f.status !== 'cancelled' && Boolean(f.advice.trim())
  );
}

export function followUpsAsAdvice(
  list: PatientFollowUp[] | undefined
): SharedAdviceNote[] {
  return patientFacingFollowUps(list).map((f) => ({
    id: f.id,
    at: f.sent_at || f.created_at,
    body: [f.title, f.advice, f.message].filter(Boolean).join('\n\n'),
    plan: f.remind_on ? `Check-in ${f.remind_on}` : null,
    author_name: f.author_name || null,
  }));
}

export function saveFollowUpOnPatient<
  T extends { follow_ups?: PatientFollowUp[]; updated_at?: string },
>(
  patient: T,
  rec: Partial<PatientFollowUp> & { advice?: string },
  now = new Date().toISOString()
): { patient: T; row: PatientFollowUp } {
  const id = String(rec.id || newFollowUpId());
  const list = upsertPatientFollowUp(patient.follow_ups, { ...rec, id }, now);
  const row = list.find((f) => f.id === id);
  if (!row) throw new Error('Could not save follow-up');
  return {
    patient: { ...patient, follow_ups: list, updated_at: now },
    row,
  };
}

export function dueFollowUps<
  T extends { id: string; follow_ups?: PatientFollowUp[] },
>(
  patients: T[],
  today = new Date().toISOString().slice(0, 10)
): Array<{ patient: T; follow_up: PatientFollowUp }> {
  const out: Array<{ patient: T; follow_up: PatientFollowUp }> = [];
  for (const p of patients) {
    for (const f of p.follow_ups || []) {
      if (f.status !== 'scheduled') continue;
      if (f.remind_on > today) continue;
      out.push({ patient: p, follow_up: f });
    }
  }
  return out;
}
