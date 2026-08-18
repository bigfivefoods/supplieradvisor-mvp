/**
 * Book the next open consult slot as a follow-up visit.
 */
import { SYS_PERSONAL_SERVICE_ID } from '@/lib/clinic/appointment-kind';
import { findNextBookableAppointment } from '@/lib/services/advisor-clinical';

export type FollowUpBooking = {
  id: string;
  appointment_id: string;
  patient_id: string;
  status: 'booked';
  booked_at: string;
  source: 'follow_up';
  notes?: string;
};

export function clinicBookFollowUpSlot(opts: {
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
  patientId: string;
  serviceId?: string | null;
  fromDate?: string;
  now: string;
  newBookingId: () => string;
  note?: string;
}):
  | {
      ok: true;
      booking: FollowUpBooking;
      appointment: { id: string; date: string; start_time: string };
    }
  | { ok: false; error: string } {
  const consults = opts.appointments.filter(
    (a) =>
      a.appointment_kind !== 'personal' &&
      a.service_id !== SYS_PERSONAL_SERVICE_ID
  );
  let appointmentId = findNextBookableAppointment({
    appointments: consults,
    bookings: opts.bookings,
    serviceId: opts.serviceId,
    fromDate: opts.fromDate,
  });
  if (!appointmentId && opts.serviceId) {
    appointmentId = findNextBookableAppointment({
      appointments: consults,
      bookings: opts.bookings,
      fromDate: opts.fromDate,
    });
  }
  if (!appointmentId) {
    return {
      ok: false,
      error:
        'No open diary slot for a follow-up — add a consult on the calendar, or send a check-in notification instead',
    };
  }
  const already = opts.bookings.find(
    (b) =>
      b.appointment_id === appointmentId &&
      b.patient_id === opts.patientId &&
      b.status !== 'cancelled'
  );
  if (already) {
    return { ok: false, error: 'Patient is already booked on the next open slot' };
  }
  const appointment = consults.find((a) => a.id === appointmentId);
  if (!appointment) {
    return { ok: false, error: 'Follow-up slot not found' };
  }
  return {
    ok: true,
    booking: {
      id: opts.newBookingId(),
      appointment_id: appointmentId,
      patient_id: opts.patientId,
      status: 'booked',
      booked_at: opts.now,
      source: 'follow_up',
      notes: opts.note,
    },
    appointment: {
      id: appointment.id,
      date: appointment.date,
      start_time: appointment.start_time,
    },
  };
}
