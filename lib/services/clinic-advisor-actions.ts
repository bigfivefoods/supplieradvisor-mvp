/**
 * Shared desk actions for Dental / Physio / Medical / Psychiatry Advisors:
 * reminders, outcomes + recalls, mark attendance (no-show stats + waitlist promote).
 */
import {
  applyAttendanceToPersonStats,
  promoteNextWaitlist,
  resolveFamilyAttendee,
  type BookingStatus,
} from '@/lib/services/advisor-booking';
import {
  needsReminder,
  sendBookingReminderEmail,
  sendWaitlistOfferEmail,
} from '@/lib/services/advisor-reminders';
import {
  computeOutcomes,
  recallCandidates,
  type OutcomesSnapshot,
} from '@/lib/services/advisor-outcomes';
import type { FamilyMember } from '@/lib/services/family-members';

export type ClinicBookingRow = {
  id: string;
  appointment_id: string;
  patient_id: string;
  status: string;
  booked_at?: string;
  notes?: string;
  family_member_id?: string | null;
  family_member_name?: string | null;
  reminded_at?: string | null;
  reminder_count?: number;
  waitlist_offered_at?: string | null;
  waitlist_accepted_at?: string | null;
};

export type ClinicAppointmentRow = {
  id: string;
  service_id: string;
  date: string;
  start_time: string;
  status: string;
  location?: string;
  duration_min?: number | null;
};

export type ClinicPatientRow = {
  id: string;
  name: string;
  email?: string;
  active?: boolean;
  portal_token?: string | null;
  family?: FamilyMember[];
  no_show_count?: number;
  last_no_show_at?: string | null;
  attended_count?: number;
  booking_soft_block?: boolean;
};

export type ClinicServiceRow = { id: string; name: string };

export type ClinicFeedbackRow = {
  feeling?: number;
  would_return?: number;
  created_at?: string;
  event_id?: string;
};

export type ClinicAdvisorStoreLike = {
  bookings: ClinicBookingRow[];
  appointments: ClinicAppointmentRow[];
  patients: ClinicPatientRow[];
  services: ClinicServiceRow[];
  appointment_feedback?: ClinicFeedbackRow[];
  treatment_plans?: import('@/lib/services/advisor-clinical').TreatmentPlan[];
  settings?: { brand_name?: string } | null;
};

export type ClinicModuleConfig = {
  moduleLabel: string;
  /** e.g. dentalgraph | physiograph */
  portalPath: string;
  brandFallback: string;
  recallAfterDays?: number;
};

export async function clinicSendReminders(
  store: ClinicAdvisorStoreLike,
  cfg: ClinicModuleConfig,
  now = new Date().toISOString()
): Promise<{ sent: number; skipped: number }> {
  let sent = 0;
  let skipped = 0;
  for (const b of store.bookings) {
    if (b.status !== 'booked') continue;
    const appt = store.appointments.find((a) => a.id === b.appointment_id);
    if (!appt || appt.status === 'cancelled') continue;
    if (!needsReminder(b, appt.date, appt.start_time, 24)) {
      skipped++;
      continue;
    }
    const patient = store.patients.find((p) => p.id === b.patient_id);
    const email = patient?.email;
    if (!email) {
      skipped++;
      continue;
    }
    const svc = store.services.find((s) => s.id === appt.service_id);
    const result = await sendBookingReminderEmail({
      to: email,
      personName: b.family_member_name || patient?.name || 'Patient',
      brand: store.settings?.brand_name || cfg.brandFallback,
      eventTitle: svc?.name || 'Appointment',
      date: appt.date,
      start_time: appt.start_time,
      location: appt.location,
      manageUrl: patient?.portal_token
        ? `/member/${cfg.portalPath}/${patient.portal_token}`
        : undefined,
      moduleLabel: cfg.moduleLabel,
    });
    if (result.ok) {
      b.reminded_at = now;
      b.reminder_count = (Number(b.reminder_count) || 0) + 1;
      sent++;
    } else {
      skipped++;
    }
  }
  return { sent, skipped };
}

export function clinicOutcomesAndRecalls(
  store: ClinicAdvisorStoreLike,
  opts?: { periodDays?: number; recallAfterDays?: number }
): {
  outcomes: OutcomesSnapshot;
  recalls: ReturnType<typeof recallCandidates>;
} {
  const eventNameById: Record<string, string> = {};
  for (const a of store.appointments) {
    const svc = store.services.find((s) => s.id === a.service_id);
    eventNameById[a.id] = svc?.name || 'Visit';
  }
  const outcomes = computeOutcomes({
    bookings: store.bookings.map((b) => ({
      status: b.status,
      booked_at: b.booked_at,
      appointment_id: b.appointment_id,
    })),
    feedback: (store.appointment_feedback || []).map((f) => ({
      feeling: f.feeling,
      would_return: f.would_return,
      created_at: f.created_at,
      event_id: f.event_id,
    })),
    eventNameById,
    peopleSoftBlocked: store.patients.filter((p) => p.booking_soft_block).length,
    periodDays: opts?.periodDays ?? 30,
  });
  const recalls = recallCandidates({
    people: store.patients,
    bookings: store.bookings.map((b) => ({
      patient_id: b.patient_id,
      status: b.status,
      booked_at: b.booked_at,
    })),
    recallAfterDays: opts?.recallAfterDays ?? 180,
  });
  return { outcomes, recalls };
}

export async function clinicMarkAttendance(
  store: ClinicAdvisorStoreLike,
  opts: {
    bookingId: string;
    status: string;
    now?: string;
    cfg: ClinicModuleConfig;
    /** When true, email the promoted waitlist patient */
    notifyPromoted?: boolean;
  }
): Promise<{
  ok: true;
  booking: ClinicBookingRow;
  promoted: ClinicBookingRow | null;
  message?: string;
} | { ok: false; error: string }> {
  const now = opts.now || new Date().toISOString();
  const booking = store.bookings.find((b) => b.id === opts.bookingId);
  if (!booking) return { ok: false, error: 'Booking not found' };

  const status = opts.status as BookingStatus;
  const prev = booking.status;
  booking.status = status;

  if (
    (status === 'attended' || status === 'no_show') &&
    prev !== status
  ) {
    const pi = store.patients.findIndex((p) => p.id === booking.patient_id);
    if (pi >= 0) {
      Object.assign(
        store.patients[pi],
        applyAttendanceToPersonStats(store.patients[pi], status, now)
      );
    }
    if (status === 'attended' && store.treatment_plans?.length) {
      const { progressTreatmentPlanOnAttend } = await import(
        '@/lib/services/advisor-clinical'
      );
      store.treatment_plans = store.treatment_plans.map((tp) =>
        tp.person_id === booking.patient_id && tp.status === 'active'
          ? progressTreatmentPlanOnAttend(tp, now)
          : tp
      );
    }
  }

  let promoted: ClinicBookingRow | null = null;
  if (status === 'cancelled' && booking.appointment_id) {
    promoted = promoteNextWaitlist(
      store.bookings,
      (b) => b.appointment_id === booking.appointment_id,
      now
    );
    if (promoted) {
      promoted.waitlist_offered_at =
        promoted.waitlist_offered_at || now;
      promoted.waitlist_accepted_at = null;
      if (opts.notifyPromoted !== false) {
        await notifyPromotedWaitlist(store, promoted, opts.cfg);
      }
    }
  }

  return {
    ok: true,
    booking,
    promoted,
    message: promoted
      ? 'Cancelled — waitlist promoted'
      : status === 'no_show'
        ? 'No-show recorded'
        : undefined,
  };
}

export async function notifyPromotedWaitlist(
  store: ClinicAdvisorStoreLike,
  promoted: ClinicBookingRow,
  cfg: ClinicModuleConfig
): Promise<void> {
  const patient = store.patients.find((p) => p.id === promoted.patient_id);
  const email = patient?.email;
  if (!email) return;
  const appt = store.appointments.find((a) => a.id === promoted.appointment_id);
  if (!appt) return;
  const svc = store.services.find((s) => s.id === appt.service_id);
  await sendWaitlistOfferEmail({
    to: email,
    personName: promoted.family_member_name || patient?.name || 'Patient',
    brand: store.settings?.brand_name || cfg.brandFallback,
    eventTitle: svc?.name || 'Appointment',
    date: appt.date,
    start_time: appt.start_time,
    location: appt.location,
    manageUrl: patient?.portal_token
      ? `/member/${cfg.portalPath}/${patient.portal_token}`
      : undefined,
    moduleLabel: cfg.moduleLabel,
  });
}

/** Resolve family attendee fields when creating/updating a booking record */
export function resolveBookingFamilyFields(
  patient: ClinicPatientRow | undefined,
  rec: Record<string, unknown>,
  prev?: ClinicBookingRow | null
): {
  family_member_id: string | null;
  family_member_name: string | null;
} {
  let famId =
    rec.family_member_id !== undefined
      ? rec.family_member_id
        ? String(rec.family_member_id)
        : null
      : prev?.family_member_id ?? null;
  let famName = prev?.family_member_name ?? null;
  if (rec.family_member_id) {
    const att = resolveFamilyAttendee(patient?.family, famId);
    famName = att?.label ?? null;
    if (!att) famId = null;
  }
  return { family_member_id: famId, family_member_name: famName };
}
