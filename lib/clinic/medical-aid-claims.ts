/**
 * Practice-wide medical-aid claim board for clinic Advisors.
 */
import type {
  MedicalAidClaim,
  MedicalAidClaimAudit,
  PatientMedicalRecord,
} from '@/lib/clinic/patient-medical';
import {
  newMedId,
  submitMedicalClaim,
  upsertMedicalClaim,
} from '@/lib/clinic/patient-medical';
import {
  parseIcd10List,
  validateIcd10,
} from '@/lib/clinic/medical-aid-claim-validate';
import type { PracticeClaimsSwitch } from '@/lib/clinic/medical-aid-switch';

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
  claims_switch?: PracticeClaimsSwitch;
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
  tariff_code?: string | null;
};

type ClinicPerson = {
  id: string;
  name: string;
  code: string;
  email?: string | null;
  platform_user_id?: string | null;
  diagnosis_notes?: string;
  medical?: PatientMedicalRecord | null;
};

type ClinicStoreLike = {
  patients: ClinicPerson[];
  services: Array<{
    id: string;
    name: string;
    price_zar?: number;
    code?: string;
  }>;
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
      tariff_code: svc?.code || null,
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
    submitted: rows.filter((r) =>
      r.claim.status === 'submitted' || r.claim.status === 'accepted'
    ).length,
    paid: rows.filter((r) => r.claim.status === 'paid' || r.claim.status === 'partial')
      .length,
    rejected: rows.filter((r) => r.claim.status === 'rejected').length,
    outstanding_zar: sum(['submitted', 'accepted', 'ready', 'draft']),
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
  const aid = patient.medical?.medical_aid;
  const icds = parseIcd10List(patient.medical?.chronic_conditions).filter(
    validateIcd10
  );
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
      tariff_code: visit.tariff_code || undefined,
      diagnosis_code: icds[0],
      diagnosis_codes: icds.length ? icds : undefined,
      scheme_code: aid?.scheme_code,
      auth_number: aid?.auth_number,
      line_items: visit.tariff_code
        ? [
            {
              tariff_code: visit.tariff_code,
              description: visit.service_name,
              quantity: 1,
              unit_price: visit.amount_zar || 0,
              amount: visit.amount_zar || 0,
              icd10: icds[0],
            },
          ]
        : undefined,
      audit: [
        {
          at: now,
          action: 'drafted',
          note: `From attended visit ${visit.service_name}`,
        },
      ],
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
  const sw = settings?.claims_switch;
  return {
    practice_number: settings?.practice_number || '',
    bhf_number: settings?.bhf_number || '',
    vat_number: settings?.vat_number || '',
    pcns_number: settings?.pcns_number || '',
    billing_email: settings?.billing_email || '',
    brand_name: settings?.brand_name || '',
    contact_email: settings?.contact_email || '',
    contact_phone: settings?.contact_phone || '',
    claims_switch: sw
      ? {
          provider: sw.provider === 'manual' ? 'manual' : 'medikredit',
          mode: sw.mode === 'live' ? 'live' : 'sandbox',
          pcns_verified: sw.pcns_verified === true,
          username: sw.username || null,
          has_secret: Boolean(sw.secret_enc),
          last_submitted_at: sw.last_submitted_at || null,
        }
      : { provider: 'medikredit', mode: 'sandbox' },
  };
}

export function appendClaimAudit(
  claim: MedicalAidClaim,
  entry: Omit<MedicalAidClaimAudit, 'at'> & { at?: string },
  now = new Date().toISOString()
): MedicalAidClaim {
  return {
    ...claim,
    audit: [{ at: entry.at || now, action: entry.action, actor: entry.actor, note: entry.note }, ...(claim.audit || [])].slice(0, 40),
  };
}

export function applySwitchResult(
  store: ClinicStoreLike,
  patientId: string,
  claimId: string,
  result: {
    status: 'submitted' | 'accepted' | 'rejected';
    tracking_number?: string;
    rejection_codes?: string[];
    message: string;
    raw: string;
    provider?: 'medikredit' | 'manual';
    mode?: 'sandbox' | 'live';
  },
  actor?: string | null,
  now = new Date().toISOString()
): ClinicStoreLike {
  const pi = store.patients.findIndex((p) => p.id === patientId);
  if (pi < 0) throw new Error('Patient not found');
  const patient = store.patients[pi];
  const claim = (patient.medical?.claims || []).find((c) => c.id === claimId);
  if (!claim) throw new Error('Claim not found');
  const nextStatus =
    result.status === 'accepted'
      ? 'accepted'
      : result.status === 'rejected'
        ? 'rejected'
        : 'submitted';
  const stamped = appendClaimAudit(
    {
      ...claim,
      status: nextStatus,
      submitted_at: claim.submitted_at || now,
      responded_at: result.status === 'submitted' ? claim.responded_at : now,
      switch_provider: result.provider || 'medikredit',
      switch_mode: result.mode || 'sandbox',
      switch_tracking_number: result.tracking_number || claim.switch_tracking_number,
      switch_response_raw: result.raw,
      rejection_codes: result.rejection_codes || [],
      response_notes: result.message,
    },
    { action: result.status, actor, note: result.message },
    now
  );
  const medical = upsertMedicalClaim(patient.medical ?? undefined, stamped, now);
  const patients = [...store.patients];
  patients[pi] = { ...patient, medical };
  return { ...store, patients };
}

export function applyEraToClaim(
  store: ClinicStoreLike,
  tracking: string,
  payment: { amount_paid: number; payment_date?: string; reference?: string; notes?: string },
  now = new Date().toISOString()
): { store: ClinicStoreLike; claim: MedicalAidClaim; patient_id: string } {
  const key = String(tracking || '').trim();
  if (!key) throw new Error('Tracking number required');
  for (const p of store.patients || []) {
    const claim = (p.medical?.claims || []).find(
      (c) =>
        c.switch_tracking_number === key ||
        c.claim_number === key ||
        c.id === key
    );
    if (!claim) continue;
    const paid = Number(payment.amount_paid);
    if (!(paid >= 0)) throw new Error('ERA amount required');
    const claimed = Number(claim.amount_zar) || 0;
    const already = (claim.era || []).reduce((n, e) => n + (Number(e.amount_paid) || 0), 0);
    const totalPaid = already + paid;
    const status =
      totalPaid >= claimed - 0.01 ? 'paid' : totalPaid > 0 ? 'partial' : claim.status;
    const era = [
      {
        id: newMedId('era'),
        payment_date: payment.payment_date || now.slice(0, 10),
        amount_paid: paid,
        reference: payment.reference,
        notes: payment.notes,
      },
      ...(claim.era || []),
    ];
    const schemePortion = totalPaid;
    const patientPortion = Math.max(0, claimed - totalPaid);
    const stamped = appendClaimAudit(
      {
        ...claim,
        status,
        scheme_portion: schemePortion,
        patient_portion: patientPortion,
        paid_at: status === 'paid' ? now : claim.paid_at,
        responded_at: now,
        era,
      },
      {
        action: 'era',
        note: `ERA ${payment.reference || ''} R${paid}`,
      },
      now
    );
    const medical = upsertMedicalClaim(p.medical ?? undefined, stamped, now);
    const patients = store.patients.map((x) =>
      x.id === p.id ? { ...x, medical } : x
    );
    return {
      store: { ...store, patients },
      claim: stamped,
      patient_id: p.id,
    };
  }
  throw new Error('No claim matches that tracking / claim number');
}

export function applyClaimAmend(
  store: ClinicStoreLike,
  patientId: string,
  claimId: string,
  patch: Partial<MedicalAidClaim>,
  actor?: string | null,
  now = new Date().toISOString()
): ClinicStoreLike {
  const pi = store.patients.findIndex((p) => p.id === patientId);
  if (pi < 0) throw new Error('Patient not found');
  const patient = store.patients[pi];
  const claim = (patient.medical?.claims || []).find((c) => c.id === claimId);
  if (!claim) throw new Error('Claim not found');
  if (claim.status === 'paid') throw new Error('Cannot amend a paid claim');
  const nextStatus =
    claim.status === 'rejected' || claim.status === 'submitted'
      ? 'ready'
      : claim.status;
  const stamped = appendClaimAudit(
    { ...claim, ...patch, status: nextStatus },
    { action: 'amend', actor, note: 'Fields updated before resubmit' },
    now
  );
  const medical = upsertMedicalClaim(patient.medical ?? undefined, stamped, now);
  const patients = [...store.patients];
  patients[pi] = { ...patient, medical };
  return { ...store, patients };
}

export function withPortalClaims<T extends object>(
  portal: T,
  medical?: PatientMedicalRecord | null
): T & { claims: ReturnType<typeof portalClaimsForPatient> } {
  return { ...portal, claims: portalClaimsForPatient(medical) };
}

export function portalClaimsForPatient(
  medical?: PatientMedicalRecord | null
): Array<{
  id: string;
  claim_number?: string;
  status: string;
  service_date?: string | null;
  amount_zar?: number | null;
  patient_portion?: number | null;
  scheme_portion?: number | null;
  rejection_codes?: string[];
  response_notes?: string;
  switch_tracking_number?: string | null;
}> {
  return (medical?.claims || [])
    .filter((c) => c.status !== 'cancelled' && c.status !== 'draft')
    .map((c) => ({
      id: c.id,
      claim_number: c.claim_number,
      status: String(c.status),
      service_date: c.service_date,
      amount_zar: c.amount_zar,
      patient_portion: c.patient_portion,
      scheme_portion: c.scheme_portion,
      rejection_codes: c.rejection_codes,
      response_notes: c.response_notes,
      switch_tracking_number: c.switch_tracking_number,
    }));
}
