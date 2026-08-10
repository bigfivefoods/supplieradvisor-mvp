/**
 * One-click book next diary slot from a treatment / care plan (clinic modules).
 */
import {
  findNextBookableAppointment,
  nextOpenTreatmentStep,
  type TreatmentPlan,
} from '@/lib/services/advisor-clinical';
import { resolveBookingFamilyFields } from '@/lib/services/clinic-advisor-actions';

type ClinicLike = {
  treatment_plans?: TreatmentPlan[];
  appointments: Array<{
    id: string;
    service_id: string;
    date: string;
    start_time: string;
    status: string;
  }>;
  bookings: Array<{
    id: string;
    appointment_id: string;
    patient_id: string;
    status: string;
    booked_at: string;
    source?: string;
    family_member_id?: string | null;
    family_member_name?: string | null;
  }>;
  patients: Array<{
    id: string;
    name?: string;
    family?: import('@/lib/services/family-members').FamilyMember[];
  }>;
};

export function clinicBookFromTreatmentPlan(
  store: ClinicLike,
  body: {
    plan_id?: string;
    person_id?: string;
    patient_id?: string;
    family_member_id?: string | null;
  },
  now: string,
  newBookingId: () => string
):
  | { ok: true; appointment_id: string; booking_id: string; message: string }
  | { ok: false; error: string; status?: number } {
  const planId = String(body.plan_id || '');
  const personId = String(body.person_id || body.patient_id || '');
  store.treatment_plans = store.treatment_plans || [];
  const plan = store.treatment_plans.find(
    (p) =>
      p.id === planId ||
      (!planId && p.person_id === personId && p.status === 'active')
  );
  if (!plan) {
    return { ok: false, error: 'Treatment plan not found', status: 404 };
  }
  if (personId && plan.person_id !== personId) {
    return { ok: false, error: 'Plan does not match patient', status: 400 };
  }
  const step = nextOpenTreatmentStep(plan);
  if (!step) {
    return { ok: false, error: 'No open plan steps to book' };
  }
  let appointmentId = findNextBookableAppointment({
    appointments: store.appointments,
    bookings: store.bookings,
    serviceId: step.service_id,
  });
  if (!appointmentId && step.service_id) {
    appointmentId = findNextBookableAppointment({
      appointments: store.appointments,
      bookings: store.bookings,
    });
  }
  if (!appointmentId) {
    return {
      ok: false,
      error: 'No open diary slot available — schedule one first',
    };
  }
  const patientId = plan.person_id;
  const already = store.bookings.find(
    (b) =>
      b.appointment_id === appointmentId &&
      b.patient_id === patientId &&
      b.status !== 'cancelled'
  );
  if (already) {
    return {
      ok: false,
      error: 'Patient already booked on that slot',
    };
  }
  const patient = store.patients.find((p) => p.id === patientId);
  const family = resolveBookingFamilyFields(
    patient
      ? { id: patient.id, name: patient.name || 'Patient', family: patient.family }
      : undefined,
    { family_member_id: body.family_member_id ?? null },
    null
  );
  const booking = {
    id: newBookingId(),
    appointment_id: appointmentId,
    patient_id: patientId,
    status: 'booked' as const,
    booked_at: now,
    source: 'treatment_plan',
    family_member_id: family.family_member_id,
    family_member_name: family.family_member_name,
  };
  store.bookings.unshift(booking);
  return {
    ok: true,
    appointment_id: appointmentId,
    booking_id: booking.id,
    message: `Booked next session for “${step.title}”`,
  };
}
