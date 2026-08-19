/**
 * Clinician PWA visit care — notes, scripts/rehab, client notes, movements.
 * Mutates the clinic store; caller persists.
 */
import { newVisitNote, type VisitNote } from '@/lib/services/advisor-clinical';
import {
  listedClinicMovements,
  shareMovementWithPatient,
  upsertClientNote,
  type ClinicMovement,
} from '@/lib/clinic/clinic-movements';
import { upsertPatientScript } from '@/lib/clinic/patient-medical';
import type { PatientMedicalRecord } from '@/lib/clinic/patient-medical';
import {
  clinicianOwnsAppointment,
  type ClinicianModule,
  type ClinicianStoreLike,
} from '@/lib/services/clinician-portal';

type CarePatient = ClinicianStoreLike['patients'][number] & {
  medical?: PatientMedicalRecord | null;
  client_notes?: import('@/lib/clinic/clinic-movements').PatientClientNote[];
  shared_movements?: import('@/lib/clinic/clinic-movements').PatientMovementShare[];
  updated_at?: string;
};

type CareStore = Omit<ClinicianStoreLike, 'patients'> & {
  patients: CarePatient[];
  visit_notes?: VisitNote[];
  movements?: ClinicMovement[] | null;
};

function patientOnAppointment(
  store: CareStore,
  appointmentId: string,
  patientId: string
) {
  return store.bookings.some(
    (b) =>
      b.appointment_id === appointmentId &&
      b.patient_id === patientId &&
      b.status !== 'cancelled'
  );
}

export function applyClinicianVisitCare(
  store: CareStore,
  module: ClinicianModule,
  clinicianId: string,
  clinicianName: string,
  body: Record<string, unknown>,
  now = new Date().toISOString()
): { ok: true; message: string } | { ok: false; error: string; status?: number } {
  const action = String(body.action || '');
  const patientId = String(body.patient_id || body.person_id || '');
  const appointmentId = String(body.appointment_id || '');
  const pi = store.patients.findIndex((p) => p.id === patientId);
  if (pi < 0) return { ok: false, error: 'Patient not found', status: 404 };
  const patient = store.patients[pi];

  if (appointmentId) {
    const appt = store.appointments.find((a) => a.id === appointmentId);
    if (!appt || !clinicianOwnsAppointment(appt, module, clinicianId)) {
      return { ok: false, error: 'Not your appointment', status: 403 };
    }
    if (!patientOnAppointment(store, appointmentId, patientId)) {
      return {
        ok: false,
        error: 'Patient is not booked on this appointment',
        status: 400,
      };
    }
  }

  if (action === 'upsert_visit_note') {
    const text = String(body.body || body.notes || '').trim();
    if (!text) return { ok: false, error: 'Write a visit note first' };
    store.visit_notes = store.visit_notes || [];
    store.visit_notes.unshift(
      newVisitNote({
        person_id: patientId,
        body: text,
        booking_id: body.booking_id ? String(body.booking_id) : null,
        appointment_id: appointmentId || null,
        author_id: clinicianId,
        author_name: clinicianName,
        pain_score: body.pain_score != null ? Number(body.pain_score) : null,
        function_score:
          body.function_score != null ? Number(body.function_score) : null,
        soap: body.soap as VisitNote['soap'],
        private: body.private === false ? false : true,
        now,
      })
    );
    return { ok: true, message: 'Practice note saved on the client chart' };
  }

  if (action === 'upsert_client_note') {
    try {
      upsertClientNote(patient, {
        body: String(body.body || body.notes || ''),
        appointment_id: appointmentId || null,
        booking_id: body.booking_id ? String(body.booking_id) : null,
        author_name: clinicianName,
        now,
      });
      patient.updated_at = now;
      return { ok: true, message: 'Client note saved to their profile' };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : 'Could not save client note',
      };
    }
  }

  if (action === 'medical_script_upsert') {
    try {
      const rec = (body.script || body.record || body) as Record<string, unknown>;
      patient.medical = upsertPatientScript(
        patient.medical,
        {
          ...rec,
          prescribed_by:
            rec.prescribed_by != null
              ? String(rec.prescribed_by)
              : clinicianName,
          practitioner_id: clinicianId,
          appointment_id: appointmentId || rec.appointment_id,
        },
        now
      );
      patient.updated_at = now;
      const isRehab = String(rec.kind || '') === 'rehab';
      return {
        ok: true,
        message: isRehab
          ? 'Rehab saved to the client profile'
          : 'Script saved to the patient record',
      };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : 'Could not save script',
      };
    }
  }

  if (action === 'share_movement') {
    if (module !== 'physiograph') {
      return { ok: false, error: 'Movements are on PhysioAdvisor', status: 400 };
    }
    const movementId = String(body.movement_id || '');
    const movement = listedClinicMovements(store).find(
      (m) => m.id === movementId
    );
    if (!movement) return { ok: false, error: 'Movement not found', status: 404 };
    shareMovementWithPatient(patient, {
      movement,
      sets: body.sets != null ? String(body.sets) : null,
      reps: body.reps != null ? String(body.reps) : null,
      hold: body.hold != null ? String(body.hold) : null,
      frequency: body.frequency != null ? String(body.frequency) : null,
      notes: body.notes != null ? String(body.notes) : undefined,
      appointment_id: appointmentId || null,
      booking_id: body.booking_id ? String(body.booking_id) : null,
      shared_by: clinicianName,
      now,
    });
    patient.updated_at = now;
    return {
      ok: true,
      message: `Shared ${movement.name} with ${patient.name}`,
    };
  }

  if (action === 'stop_shared_movement') {
    const shareId = String(body.share_id || body.id || '');
    const list = patient.shared_movements || [];
    const row = list.find((m) => m.id === shareId);
    if (!row) return { ok: false, error: 'Share not found', status: 404 };
    row.status = 'stopped';
    patient.updated_at = now;
    return { ok: true, message: 'Movement removed from the client profile' };
  }

  return { ok: false, error: 'Unknown visit-care action' };
}

export const CLINICIAN_VISIT_CARE_ACTIONS = [
  'upsert_visit_note',
  'upsert_client_note',
  'medical_script_upsert',
  'share_movement',
  'stop_shared_movement',
] as const;
