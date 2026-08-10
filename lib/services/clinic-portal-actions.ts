/**
 * Patient portal actions: confirm waitlist promotion + self-serve reschedule.
 */
import {
  evaluateReschedule,
  type ReschedulePolicy,
} from '@/lib/services/advisor-reschedule';

export type PortalBooking = {
  id: string;
  appointment_id: string;
  patient_id: string;
  status: string;
  waitlist_offered_at?: string | null;
  waitlist_accepted_at?: string | null;
  family_member_id?: string | null;
  family_member_name?: string | null;
};

export type PortalAppointment = {
  id: string;
  date: string;
  start_time: string;
  status: string;
  public?: boolean;
  service_id?: string;
};

/**
 * Confirm a promoted waitlist place (or accept a waitlisted slot that was offered).
 */
export function portalConfirmWaitlistPlace(
  bookings: PortalBooking[],
  opts: { bookingId: string; patientId: string; now?: string }
):
  | { ok: true; booking: PortalBooking; message: string }
  | { ok: false; error: string } {
  const now = opts.now || new Date().toISOString();
  const b = bookings.find(
    (x) => x.id === opts.bookingId && x.patient_id === opts.patientId
  );
  if (!b) return { ok: false, error: 'Booking not found' };
  if (b.status === 'cancelled') {
    return { ok: false, error: 'Booking was cancelled' };
  }
  if (b.status === 'waitlist' && !b.waitlist_offered_at) {
    return {
      ok: false,
      error: 'Still on the waitlist — the practice will contact you when a place opens',
    };
  }
  if (b.status === 'booked' || b.status === 'waitlist') {
    b.status = 'booked';
    b.waitlist_accepted_at = now;
    if (!b.waitlist_offered_at) b.waitlist_offered_at = now;
    return {
      ok: true,
      booking: b,
      message: 'Place confirmed — see you then',
    };
  }
  return { ok: false, error: 'Cannot confirm this booking' };
}

/**
 * Move a booked appointment to another open public slot within reschedule policy.
 */
export function portalRescheduleBooking(opts: {
  bookings: PortalBooking[];
  appointments: PortalAppointment[];
  bookingId: string;
  patientId: string;
  newAppointmentId: string;
  policy?: Partial<ReschedulePolicy> | null;
  personSoftBlocked?: boolean;
  isSlotOpen: (appointmentId: string) => boolean;
  now?: string;
}):
  | { ok: true; booking: PortalBooking; message: string; fee_note?: string }
  | { ok: false; error: string } {
  const b = opts.bookings.find(
    (x) => x.id === opts.bookingId && x.patient_id === opts.patientId
  );
  if (!b) return { ok: false, error: 'Booking not found' };
  if (b.status !== 'booked' && b.status !== 'waitlist') {
    return { ok: false, error: 'Only open bookings can be rescheduled' };
  }
  const current = opts.appointments.find((a) => a.id === b.appointment_id);
  if (!current) return { ok: false, error: 'Current appointment missing' };

  const decision = evaluateReschedule({
    policy: opts.policy,
    eventDate: current.date,
    eventTime: current.start_time,
    personSoftBlocked: opts.personSoftBlocked,
  });
  if (!decision.allowed) {
    return { ok: false, error: decision.reason || 'Reschedule not allowed' };
  }

  const next = opts.appointments.find((a) => a.id === opts.newAppointmentId);
  if (!next || next.status !== 'scheduled' || next.public !== true) {
    return { ok: false, error: 'Target slot not available' };
  }
  if (!opts.isSlotOpen(opts.newAppointmentId)) {
    return { ok: false, error: 'Target slot is full' };
  }
  const dup = opts.bookings.find(
    (x) =>
      x.appointment_id === opts.newAppointmentId &&
      x.patient_id === opts.patientId &&
      x.id !== b.id &&
      x.status !== 'cancelled'
  );
  if (dup) {
    return { ok: false, error: 'You already have a booking on that slot' };
  }

  b.appointment_id = opts.newAppointmentId;
  b.status = 'booked';
  return {
    ok: true,
    booking: b,
    message: decision.free
      ? 'Rescheduled'
      : `Rescheduled (desk may collect late fee R${decision.fee_zar})`,
    fee_note: decision.free
      ? undefined
      : `Late change fee R${decision.fee_zar} (collected by the practice, not SA)`,
  };
}
