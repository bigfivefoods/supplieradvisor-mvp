/**
 * Practice-wide medical-aid claim board for clinic Advisors.
 */
import type { MedicalAidClaim, PatientMedicalRecord } from '@/lib/clinic/patient-medical';
import {
  submitMedicalClaim,
  upsertMedicalClaim,
} from '@/lib/clinic/patient-medical';

export type ClinicClaimsModule =
  | 'medicalgraph'
  | 'physiograph'
  | 'dentalgraph'
  | 'psychiatrygraph';

export type PracticeBilling = {
  practice_number?: string;
  bhf_number?: string;
  vat_number?: string;
  pcns_number?: string;
  billing_email?: string;
  brand_name?: string;
  contact_email?: string;
  contact_phone?: string;
};

export type PracticeClaimRow = {
  patient_id: string;
  patient_name: string;
  patient_code: string;
  scheme?: string;
  membership_number?: string;
  dependent_code?: string;
  claim: MedicalAidClaim;
};

export type UnclaimedVisit = {
  booking_id: string;
  appointment_id: string;
  patient_id: string;
  patient_name: string;
  service_name: string;
  treating_name: string;
  date: string;
  start_time: string;
  amount_zar?: number | null;
};

type ClinicPerson = {
  id: string;
  name: string;
  code: string;
  medical?: PatientMedicalRecord | null;
};

type ClinicStoreLike = {
  patients: ClinicPerson[];
  services: Array<{ id: string; name: string; price_zar?: number }>;
  appointments: Array<{
    id: string;
    service_id: string;
    practitioner_id?: string | null;
    staff_id?: string | null;
    date: string;
    start_time: string;
    status?: string;
  }>;
  bookings: Array<{
    id: string;
    appointment_id: string;
    patient_id: string;
    status: string;
  }>;
  practitioners?: Array<{ id: string; name: string }>;
  staff?: Array<{ id: string; name: string }>;
  settings?: PracticeBilling | null;
};

export function collectPracticeClaims(store: {
  patients: ClinicPerson[];
}): PracticeClaimRow[] {
  const rows: PracticeClaimRow[] = [];
  for (const p of store.patients || []) {
    for (const claim of p.medical?.claims || []) {
      rows.push({
        patient_id: p.id,
        patient_name: p.name,
        patient_code: p.code,
        scheme: p.medical?.medical_aid?.scheme_name,
        membership_number: p.medical?.medical_aid?.membership_number,
        dependent_code: p.medical?.medical_aid?.dependent_code,
        claim,
      });
    }
  }
  return rows.sort((a, b) => {
    const da = a.claim.service_date || a.claim.created_at || '';
    const db = b.claim.service_date || b.claim.created_at || '';
    return db.localeCompare(da);
  });
}

export function unclaimedAttendedVisits(store: ClinicStoreLike): UnclaimedVisit[] {
  const claimed = new Set<string>();
  for (const p of store.patients || []) {
    for (const c of p.medical?.claims || []) {
      if (c.booking_id) claimed.add(c.booking_id);
      if (c.appointment_id) claimed.add(`a:${c.appointment_id}:${p.id}`);
    }
  }
  const out: UnclaimedVisit[] = [];
  for (const b of store.bookings || []) {
    if (b.status !== 'attended') continue;
    if (claimed.has(b.id)) continue;
    const patient = store.patients.find((p) => p.id === b.patient_id);
    const appt = store.appointments.find((a) => a.id === b.appointment_id);
    if (!patient || !appt) continue;
    if (claimed.has(`a:${appt.id}:${patient.id}`)) continue;
    const svc = store.services.find((s) => s.id === appt.service_id);
    const treatingId = appt.practitioner_id || appt.staff_id;
    const prac =
      (store.practitioners || []).find((p) => p.id === treatingId) ||
      (store.staff || []).find((p) => p.id === treatingId);
    out.push({
      booking_id: b.id,
      appointment_id: appt.id,
      patient_id: patient.id,
      patient_name: patient.name,
      service_name: svc?.name || 'Visit',
      treating_name: prac?.name || '',
      date: appt.date,
      start_time: appt.start_time,
      amount_zar: svc?.price_zar ?? null,
    });
  }
  return out.sort((a, b) =>
    a.date === b.date
      ? b.start_time.localeCompare(a.start_time)
      : b.date.localeCompare(a.date)
  );
}

export function claimKpis(rows: PracticeClaimRow[]) {
  const sum = (st: string[]) =>
    rows
      .filter((r) => st.includes(String(r.claim.status)))
      .reduce((n, r) => n + (Number(r.claim.amount_zar) || 0), 0);
  return {
    draft: rows.filter((r) => r.claim.status === 'draft' || r.claim.status === 'ready')
      .length,
    submitted: rows.filter((r) => r.claim.status === 'submitted').length,
    paid: rows.filter((r) => r.claim.status === 'paid' || r.claim.status === 'partial')
      .length,
    rejected: rows.filter((r) => r.claim.status === 'rejected').length,
    outstanding_zar: sum(['submitted', 'ready', 'draft']),
    paid_zar: sum(['paid', 'partial']),
  };
}

export function createClaimFromVisit(
  store: ClinicStoreLike,
  visit: UnclaimedVisit,
  now = new Date().toISOString()
): { patients: ClinicPerson[] } {
  const pi = store.patients.findIndex((p) => p.id === visit.patient_id);
  if (pi < 0) throw new Error('Patient not found');
  const patient = store.patients[pi];
  const next = upsertMedicalClaim(
    patient.medical ?? undefined,
    {
      status: 'ready',
      service_date: visit.date,
      amount_zar: visit.amount_zar,
      treating_name: visit.treating_name,
      booking_id: visit.booking_id,
      appointment_id: visit.appointment_id,
      notes: visit.service_name,
    },
    now
  );
  const patients = [...store.patients];
  patients[pi] = { ...patient, medical: next };
  return { patients };
}

export function applyClaimSubmit(
  store: ClinicStoreLike,
  patientId: string,
  claimId: string,
  now = new Date().toISOString()
): ClinicStoreLike {
  const pi = store.patients.findIndex((p) => p.id === patientId);
  if (pi < 0) throw new Error('Patient not found');
  const patient = store.patients[pi];
  const medical = submitMedicalClaim(patient.medical ?? undefined, claimId, now);
  const patients = [...store.patients];
  patients[pi] = { ...patient, medical };
  return { ...store, patients };
}

export function applyClaimOutcome(
  store: ClinicStoreLike,
  patientId: string,
  claimId: string,
  status: 'paid' | 'rejected' | 'partial',
  responseNotes?: string,
  now = new Date().toISOString()
): ClinicStoreLike {
  const pi = store.patients.findIndex((p) => p.id === patientId);
  if (pi < 0) throw new Error('Patient not found');
  const patient = store.patients[pi];
  const claim = (patient.medical?.claims || []).find((c) => c.id === claimId);
  if (!claim) throw new Error('Claim not found');
  const medical = upsertMedicalClaim(
    patient.medical ?? undefined,
    {
      ...claim,
      status,
      response_notes: responseNotes || claim.response_notes,
    },
    now
  );
  const patients = [...store.patients];
  patients[pi] = { ...patient, medical };
  return { ...store, patients };
}

export function billingFromSettings(
  settings?: PracticeBilling | null
): PracticeBilling {
  return {
    practice_number: settings?.practice_number || '',
    bhf_number: settings?.bhf_number || '',
    vat_number: settings?.vat_number || '',
    pcns_number: settings?.pcns_number || '',
    billing_email: settings?.billing_email || '',
    brand_name: settings?.brand_name || '',
    contact_email: settings?.contact_email || '',
    contact_phone: settings?.contact_phone || '',
  };
}
