/**
 * Booked patients on a diary slot — used by the calendar visit desk.
 */
import type { PatientMedicalRecord } from '@/lib/clinic/patient-medical';
import type { VisitNote } from '@/lib/services/advisor-clinical';
import type { PatientFollowUp } from '@/lib/clinic/patient-follow-up';

export type AppointmentVisitPatient = {
  patientId: string;
  bookingId: string;
  name: string;
  email?: string | null;
  familyMemberName?: string | null;
  medical?: PatientMedicalRecord | null;
  followUps?: PatientFollowUp[];
};

export function appointmentVisitPatients(opts: {
  appointmentId: string;
  bookings?: Array<{
    id: string;
    appointment_id: string;
    patient_id?: string | null;
    status?: string;
    family_member_name?: string | null;
  }>;
  patients?: Array<{
    id: string;
    name: string;
    email?: string | null;
    medical?: PatientMedicalRecord | null;
    follow_ups?: PatientFollowUp[];
  }>;
}): AppointmentVisitPatient[] {
  const id = String(opts.appointmentId || '');
  if (!id) return [];
  const out: AppointmentVisitPatient[] = [];
  for (const b of opts.bookings || []) {
    if (b.appointment_id !== id) continue;
    if (b.status === 'cancelled') continue;
    if (!b.patient_id) continue;
    const p = (opts.patients || []).find((x) => x.id === b.patient_id);
    out.push({
      patientId: b.patient_id,
      bookingId: b.id,
      name: p?.name || b.patient_id,
      email: p?.email || null,
      familyMemberName: b.family_member_name || null,
      medical: p?.medical || null,
      followUps: p?.follow_ups || [],
    });
  }
  return out;
}

export function notesForVisit(
  notes: VisitNote[] | undefined,
  opts: { patientId: string; appointmentId?: string | null; bookingId?: string | null }
): VisitNote[] {
  return (notes || [])
    .filter((n) => n.person_id === opts.patientId)
    .filter((n) => {
      if (opts.appointmentId && n.appointment_id === opts.appointmentId) {
        return true;
      }
      if (opts.bookingId && n.booking_id === opts.bookingId) return true;
      return false;
    })
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}
