/**
 * Shared clinic follow-up save + notify + optional next-slot booking.
 */
import {
  newFollowUpId,
  saveFollowUpOnPatient,
  type PatientFollowUp,
} from '@/lib/clinic/patient-follow-up';
import { clinicBookFollowUpSlot } from '@/lib/clinic/book-follow-up';
import {
  notifyFollowUpCheckIn,
  type ClinicFollowUpModule,
  type FollowUpNotifyMode,
} from '@/lib/clinic/notify-follow-up';

const DEFAULT_ADVICE = 'Please check in with the practice after your visit.';

export type ClinicFollowUpStore = {
  patients: Array<{
    id: string;
    name: string;
    email?: string | null;
    platform_user_id?: string | null;
    portal_token?: string | null;
    follow_ups?: PatientFollowUp[];
    updated_at?: string;
  }>;
  appointments: Array<{
    id: string;
    service_id?: string;
    date: string;
    start_time: string;
    status: string;
    appointment_kind?: string;
  }>;
  bookings: Array<{
    id: string;
    appointment_id: string;
    patient_id?: string;
    status: string;
  }>;
  settings?: { brand_name?: string } | null;
};

export async function applyClinicFollowUp(opts: {
  store: ClinicFollowUpStore;
  companyId: number;
  module: ClinicFollowUpModule;
  patientId: string;
  patch: Record<string, unknown>;
  authorName?: string | null;
  sendNow?: boolean;
  bookNext?: boolean;
  notifyOnSchedule?: boolean;
  now?: string;
  newBookingId: () => string;
}): Promise<
  | {
      ok: true;
      patientIndex: number;
      patient: ClinicFollowUpStore['patients'][number];
      row: PatientFollowUp;
      booking?: ReturnType<typeof clinicBookFollowUpSlot> extends infer R
        ? R extends { ok: true; booking: infer B }
          ? B
          : never
        : never;
      appointment?: { id: string; date: string; start_time: string };
      message: string;
    }
  | { ok: false; error: string; status?: number }
> {
  const now = opts.now || new Date().toISOString();
  const pi = opts.store.patients.findIndex((p) => p.id === opts.patientId);
  if (pi < 0) return { ok: false, error: 'Patient not found', status: 404 };
  const patient = opts.store.patients[pi];
  const patch = opts.patch;
  const advice =
    String(patch.advice || '').trim() ||
    (opts.sendNow || opts.bookNext ? DEFAULT_ADVICE : '');
  if (!advice && !patch.id) {
    return { ok: false, error: 'Write the check-in advice first', status: 400 };
  }

  let booked: ReturnType<typeof clinicBookFollowUpSlot> | null = null;
  if (opts.bookNext) {
    const fromDate =
      String(patch.remind_on || '').slice(0, 10) || now.slice(0, 10);
    booked = clinicBookFollowUpSlot({
      appointments: opts.store.appointments,
      bookings: opts.store.bookings,
      patientId: patient.id,
      serviceId: patch.service_id ? String(patch.service_id) : null,
      fromDate,
      now,
      newBookingId: opts.newBookingId,
      note: advice,
    });
    if (!booked.ok) return { ok: false, error: booked.error, status: 400 };
    opts.store.bookings.unshift(booked.booking);
  }

  let saved = saveFollowUpOnPatient(
    patient,
    {
      id: patch.id ? String(patch.id) : newFollowUpId(),
      remind_on: booked?.ok
        ? booked.appointment.date
        : patch.remind_on
          ? String(patch.remind_on)
          : undefined,
      title: patch.title != null ? String(patch.title) : undefined,
      advice,
      message: patch.message != null ? String(patch.message) : undefined,
      desk_note:
        patch.desk_note != null ? String(patch.desk_note) : undefined,
      status: opts.sendNow || opts.bookNext ? 'sent' : (patch.status as PatientFollowUp['status']) || 'scheduled',
      appointment_id: patch.appointment_id
        ? String(patch.appointment_id)
        : undefined,
      next_appointment_id: booked?.ok ? booked.appointment.id : undefined,
      sent_at: opts.sendNow || opts.bookNext ? now : undefined,
      author_name: opts.authorName || undefined,
    },
    now
  );

  const shouldNotify =
    opts.sendNow === true ||
    opts.bookNext === true ||
    opts.notifyOnSchedule === true;
  const mode: FollowUpNotifyMode = opts.bookNext
    ? 'booked'
    : opts.sendNow
      ? 'now'
      : 'scheduled';
  if (shouldNotify) {
    await notifyFollowUpCheckIn({
      companyId: opts.companyId,
      module: opts.module,
      brand: opts.store.settings?.brand_name,
      patient: saved.patient,
      followUp: saved.row,
      mode,
      appointment: booked?.ok ? booked.appointment : null,
    });
    if (opts.sendNow && saved.row.status !== 'sent') {
      saved = saveFollowUpOnPatient(
        saved.patient,
        {
          id: saved.row.id,
          advice: saved.row.advice,
          status: 'sent',
          sent_at: now,
        },
        now
      );
    }
  }

  opts.store.patients[pi] = saved.patient;
  return {
    ok: true,
    patientIndex: pi,
    patient: saved.patient,
    row: saved.row,
    booking: booked?.ok ? booked.booking : undefined,
    appointment: booked?.ok ? booked.appointment : undefined,
    message: opts.bookNext && booked?.ok
      ? `Follow-up booked ${booked.appointment.date} ${String(
          booked.appointment.start_time
        ).slice(0, 5)} — both parties notified`
      : opts.sendNow
        ? 'Check-in sent to the member PWA and the practice desk'
        : 'Check-in scheduled — reminder will notify the member and the desk',
  };
}
