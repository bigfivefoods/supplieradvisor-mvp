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
  notifyBookingReminderPush,
  notifyLinkedMember,
} from '@/lib/b2c/member-push';
import { notifyFollowUpCheckIn } from '@/lib/clinic/notify-follow-up';
import { logoUrlFromSettings } from '@/lib/business/company-logo';
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
  feedback_token?: string | null;
  feedback_requested_at?: string | null;
  feedback_submitted_at?: string | null;
  feedback_id?: string | null;
  post_session_emailed_at?: string | null;
};

export type ClinicAppointmentRow = {
  id: string;
  service_id: string;
  date: string;
  start_time: string;
  end_time?: string | null;
  status: string;
  location?: string;
  duration_min?: number | null;
  practitioner_id?: string | null;
};

export type ClinicPatientRow = {
  id: string;
  name: string;
  email?: string;
  active?: boolean;
  portal_token?: string | null;
  platform_user_id?: string | null;
  follow_ups?: import('@/lib/clinic/patient-follow-up').PatientFollowUp[];
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
  settings?: {
    brand_name?: string;
    company_logo_url?: string | null;
  } | null;
  practitioners?: Array<{ id: string; name: string }>;
};

export type ClinicModuleConfig = {
  moduleLabel: string;
  /** e.g. dentalgraph | physiograph */
  portalPath: string;
  brandFallback: string;
  recallAfterDays?: number;
  companyId?: number;
  logoUrl?: string | null;
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
    const uid = patient?.platform_user_id;
    if (!email && !uid) {
      skipped++;
      continue;
    }
    const svc = store.services.find((s) => s.id === appt.service_id);
    const manageUrl = patient?.portal_token
      ? `/member/${cfg.portalPath}/${patient.portal_token}`
      : undefined;
    let emailed = false;
    if (email) {
      const result = await sendBookingReminderEmail({
        to: email,
        personName: b.family_member_name || patient?.name || 'Patient',
        brand: store.settings?.brand_name || cfg.brandFallback,
        eventTitle: svc?.name || 'Appointment',
        date: appt.date,
        start_time: appt.start_time,
        location: appt.location,
        manageUrl,
        moduleLabel: cfg.moduleLabel,
        moduleKey: cfg.portalPath,
        logoUrl:
          cfg.logoUrl ||
          logoUrlFromSettings(store.settings) ||
          null,
        practitionerName: store.practitioners?.find(
          (p) => p.id === appt.practitioner_id
        )?.name,
      });
      emailed = result.ok;
    }
    const pushed = uid
      ? (
          await notifyBookingReminderPush({
            platformUserId: uid,
            brand: store.settings?.brand_name || cfg.brandFallback,
            title: svc?.name || 'Appointment',
            date: appt.date,
            start_time: appt.start_time,
            portalPath: manageUrl,
          })
        ).sent
      : 0;
    if (emailed || pushed > 0) {
      b.reminded_at = now;
      b.reminder_count = (Number(b.reminder_count) || 0) + 1;
      sent++;
    } else {
      skipped++;
    }
  }
  const { dueFollowUps, saveFollowUpOnPatient } = await import(
    '@/lib/clinic/patient-follow-up'
  );
  const today = now.slice(0, 10);
  const followModule =
    cfg.portalPath === 'physiograph' ||
    cfg.portalPath === 'dentalgraph' ||
    cfg.portalPath === 'psychiatrygraph' ||
    cfg.portalPath === 'medicalgraph'
      ? cfg.portalPath
      : null;
  for (const { patient, follow_up } of dueFollowUps(
    store.patients,
    today
  )) {
    if (followModule) {
      await notifyFollowUpCheckIn({
        companyId: Number(cfg.companyId) || 0,
        module: followModule,
        brand: store.settings?.brand_name || cfg.brandFallback,
        patient,
        followUp: follow_up,
        mode: 'due',
      });
    } else {
      const uid = patient.platform_user_id;
      const portal = patient.portal_token
        ? `/member/${cfg.portalPath}/${patient.portal_token}`
        : '/me';
      if (uid) {
        await notifyLinkedMember({
          platformUserId: uid,
          title:
            follow_up.title ||
            `${store.settings?.brand_name || cfg.brandFallback} care reminder`,
          body: follow_up.message || follow_up.advice,
          url: portal,
          tag: `followup-${follow_up.id}`,
          topic: 'care',
        });
      }
    }
    const pi = store.patients.findIndex((p) => p.id === patient.id);
    if (pi < 0) continue;
    store.patients[pi] = saveFollowUpOnPatient(
      store.patients[pi],
      {
        id: follow_up.id,
        advice: follow_up.advice,
        status: 'sent',
        sent_at: now,
      },
      now
    ).patient;
    sent += 1;
  }
  if (cfg.portalPath === 'medicalgraph') {
    const post = await clinicSendPostSessionEmails(store, cfg, now);
    sent += post.sent;
    skipped += post.skipped;
  }
  return { sent, skipped };
}

export async function clinicSendPostSessionEmails(
  store: ClinicAdvisorStoreLike,
  cfg: ClinicModuleConfig,
  now = new Date().toISOString()
): Promise<{ sent: number; skipped: number }> {
  const { needsPostSessionEmail, sendAdvisorSessionEmail } = await import(
    '@/lib/services/advisor-branded-email'
  );
  const { issueFeedbackPrompt, buildPublicFeedbackPath } = await import(
    '@/lib/services/booking-feedback'
  );
  const companyId = Number(cfg.companyId) || 0;
  let sent = 0;
  let skipped = 0;
  const nowMs = new Date(now).getTime() || Date.now();
  for (const b of store.bookings) {
    const appt = store.appointments.find((a) => a.id === b.appointment_id);
    if (!appt) {
      skipped++;
      continue;
    }
    if (!needsPostSessionEmail(b, appt, nowMs)) {
      skipped++;
      continue;
    }
    const patient = store.patients.find((p) => p.id === b.patient_id);
    if (!patient?.email && !patient?.platform_user_id) {
      skipped++;
      continue;
    }
    const issued = issueFeedbackPrompt(b, now);
    b.feedback_token = issued.feedback_token;
    b.feedback_requested_at = issued.feedback_requested_at;
    const svc = store.services.find((s) => s.id === appt.service_id);
    const feedbackPath =
      companyId > 0 && b.feedback_token
        ? buildPublicFeedbackPath(
            cfg.portalPath as 'medicalgraph',
            companyId,
            b.feedback_token
          )
        : patient.portal_token
          ? `/member/${cfg.portalPath}/${patient.portal_token}`
          : '/me';
    let emailed = false;
    if (patient.email) {
      const result = await sendAdvisorSessionEmail(patient.email, {
        kind: 'post',
        personName: b.family_member_name || patient.name || 'Patient',
        brand: store.settings?.brand_name || cfg.brandFallback,
        eventTitle: svc?.name || 'Appointment',
        date: appt.date,
        start_time: appt.start_time,
        location: appt.location,
        practitionerName: store.practitioners?.find(
          (p) => p.id === appt.practitioner_id
        )?.name,
        logoUrl: cfg.logoUrl || logoUrlFromSettings(store.settings),
        ctaUrl: feedbackPath,
        moduleKey: cfg.portalPath,
        moduleLabel: cfg.moduleLabel,
      });
      emailed = result.ok;
    }
    const pushed = patient.platform_user_id
      ? (
          await notifyLinkedMember({
            platformUserId: patient.platform_user_id,
            title: `How was your visit at ${store.settings?.brand_name || cfg.brandFallback}?`,
            body: 'Rate the session and the practice — it takes a minute.',
            url: feedbackPath,
            tag: `post-session-${b.id}`,
            topic: 'care',
          })
        ).sent
      : 0;
    if (emailed || pushed > 0) {
      b.post_session_emailed_at = now;
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
    if (status === 'attended' && opts.cfg.portalPath === 'medicalgraph') {
      const { issueFeedbackPrompt } = await import(
        '@/lib/services/booking-feedback'
      );
      Object.assign(booking, issueFeedbackPrompt(booking, now));
      await clinicSendPostSessionEmails(store, opts.cfg, now);
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
  const appt = store.appointments.find((a) => a.id === promoted.appointment_id);
  if (!appt) return;
  const svc = store.services.find((s) => s.id === appt.service_id);
  const manageUrl = patient?.portal_token
    ? `/member/${cfg.portalPath}/${patient.portal_token}`
    : undefined;
  if (patient?.email) {
    await sendWaitlistOfferEmail({
      to: patient.email,
      personName: promoted.family_member_name || patient?.name || 'Patient',
      brand: store.settings?.brand_name || cfg.brandFallback,
      eventTitle: svc?.name || 'Appointment',
      date: appt.date,
      start_time: appt.start_time,
      location: appt.location,
      manageUrl,
      moduleLabel: cfg.moduleLabel,
      moduleKey: cfg.portalPath,
      logoUrl: cfg.logoUrl || logoUrlFromSettings(store.settings),
    });
  }
  await notifyLinkedMember({
    platformUserId: patient?.platform_user_id,
    title: 'Spot available',
    body: [
      store.settings?.brand_name || cfg.brandFallback,
      svc?.name || 'Appointment',
      `${appt.date} ${appt.start_time}`,
    ]
      .filter(Boolean)
      .join(' · '),
    url: manageUrl || '/me',
    tag: `waitlist-${promoted.id}`,
    topic: 'bookings',
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
