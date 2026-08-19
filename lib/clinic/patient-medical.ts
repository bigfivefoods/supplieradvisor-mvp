/**
 * Shared patient medical chart for PhysioAdvisor & DentalAdvisor:
 * demographics, medical aid, attachments, and medical-aid submissions.
 */

export const MEDICAL_DOC_KINDS = [
  'referral',
  'xray',
  'scan',
  'lab',
  'script',
  'id',
  'aid_card',
  'consent',
  'clinical_note',
  'treatment_plan',
  'other',
] as const;

export type MedicalDocKind = (typeof MEDICAL_DOC_KINDS)[number] | string;

export const MEDICAL_AID_CLAIM_STATUSES = [
  'draft',
  'ready',
  'submitted',
  'accepted',
  'paid',
  'rejected',
  'partial',
  'cancelled',
] as const;

export type MedicalAidClaimStatus =
  | (typeof MEDICAL_AID_CLAIM_STATUSES)[number]
  | string;

/** Common SA schemes for quick select */
export const COMMON_MEDICAL_SCHEMES = [
  'Discovery Health',
  'Bonitas',
  'Momentum Medical Scheme',
  'Medscheme / Bankmed',
  'Gems',
  'Polmed',
  'Fedhealth',
  'Bestmed',
  'KeyHealth',
  'Sizwe Hosmed',
  'Other / private',
] as const;

export type MedicalAidDetails = {
  scheme_name?: string;
  scheme_code?: string;
  plan_name?: string;
  membership_number?: string;
  dependent_code?: string;
  main_member_name?: string;
  /** SA ID / passport of main member */
  main_member_id?: string;
  patient_is_main_member?: boolean;
  auth_required?: boolean;
  auth_number?: string;
  option_code?: string;
  employer?: string;
  contact_phone?: string;
  notes?: string;
  /** ISO timestamp when the patient consented to scheme data sharing */
  claims_consent_at?: string | null;
};

export type MedicalRecordDoc = {
  id: string;
  title: string;
  file_name: string;
  url: string;
  kind: MedicalDocKind;
  uploaded_at: string;
  notes?: string;
};

export type MedicalAidClaimLine = {
  tariff_code: string;
  description?: string;
  quantity?: number;
  unit_price?: number;
  amount?: number;
  icd10?: string;
  nappi?: string;
  modifiers?: string;
};

export type MedicalAidClaimAudit = {
  at: string;
  action: string;
  actor?: string | null;
  note?: string;
};

export type MedicalAidEraPayment = {
  id: string;
  payment_date: string;
  amount_paid: number;
  reference?: string;
  notes?: string;
};

export type MedicalAidClaim = {
  id: string;
  claim_number?: string;
  status: MedicalAidClaimStatus;
  /** Date of service YYYY-MM-DD */
  service_date?: string | null;
  amount_zar?: number | null;
  patient_portion?: number | null;
  scheme_portion?: number | null;
  /** Procedure / tariff code (e.g. NHRPL) */
  tariff_code?: string;
  /** ICD-10 diagnosis code */
  diagnosis_code?: string;
  diagnosis_codes?: string[];
  line_items?: MedicalAidClaimLine[];
  scheme_code?: string;
  auth_number?: string;
  booking_id?: string | null;
  appointment_id?: string | null;
  treating_name?: string;
  notes?: string;
  submitted_at?: string | null;
  responded_at?: string | null;
  paid_at?: string | null;
  /** Scheme response / rejection reason */
  response_notes?: string;
  rejection_codes?: string[];
  switch_provider?: 'medikredit' | 'manual';
  switch_mode?: 'sandbox' | 'live';
  switch_tracking_number?: string | null;
  switch_response_raw?: string | null;
  invoice_id?: number | null;
  charge_id?: string | null;
  era?: MedicalAidEraPayment[];
  audit?: MedicalAidClaimAudit[];
  /** Linked medical document ids (e.g. account, referral) */
  attachment_ids?: string[];
  created_at: string;
  updated_at: string;
};

/** Prescription / script written by a practitioner for a patient (or visit). */
export const SCRIPT_STATUSES = [
  'active',
  'completed',
  'cancelled',
  'discontinued',
] as const;

export type PatientScriptStatus =
  | (typeof SCRIPT_STATUSES)[number]
  | string;

export const SCRIPT_ROUTES = [
  'oral',
  'topical',
  'inhaled',
  'injection',
  'sublingual',
  'eye',
  'ear',
  'nasal',
  'rectal',
  'other',
] as const;

export type PatientScript = {
  id: string;
  /** prescription (GP / dental / psychiatry) or rehab (physio home programme) */
  kind?: 'prescription' | 'rehab' | string;
  /** Drug / product name — or rehab programme title for PhysioAdvisor */
  medication: string;
  strength?: string;
  dose?: string;
  frequency?: string;
  route?: string;
  duration?: string;
  quantity?: string;
  /** Number of repeats allowed (0 = none) */
  repeats?: number | null;
  /** Patient-facing directions */
  instructions?: string;
  diagnosis?: string;
  prescribed_by?: string;
  practitioner_id?: string | null;
  /** Link script to the visit / diary slot */
  appointment_id?: string | null;
  booking_id?: string | null;
  /** YYYY-MM-DD */
  prescribed_at?: string | null;
  status?: PatientScriptStatus;
  notes?: string;
  created_at: string;
  updated_at: string;
};

export type PatientMedicalRecord = {
  id_number?: string;
  date_of_birth?: string | null;
  gender?: string;
  address?: string;
  next_of_kin?: string;
  next_of_kin_phone?: string;
  gp_name?: string;
  gp_phone?: string;
  allergies?: string;
  chronic_conditions?: string;
  current_meds?: string;
  medical_aid?: MedicalAidDetails;
  documents?: MedicalRecordDoc[];
  claims?: MedicalAidClaim[];
  /** Structured prescriptions / scripts */
  scripts?: PatientScript[];
};

export function emptyMedicalRecord(): PatientMedicalRecord {
  return {
    medical_aid: {},
    documents: [],
    claims: [],
    scripts: [],
  };
}

export function newMedId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function mergeMedicalRecord(
  prev: PatientMedicalRecord | undefined | null,
  patch: unknown
): PatientMedicalRecord {
  const base: PatientMedicalRecord = {
    ...emptyMedicalRecord(),
    ...(prev && typeof prev === 'object' ? prev : {}),
    medical_aid: {
      ...emptyMedicalRecord().medical_aid,
      ...(prev?.medical_aid || {}),
    },
    documents: Array.isArray(prev?.documents) ? [...prev!.documents!] : [],
    claims: Array.isArray(prev?.claims) ? [...prev!.claims!] : [],
    scripts: Array.isArray(prev?.scripts) ? [...prev!.scripts!] : [],
  };
  if (!patch || typeof patch !== 'object') return base;
  const p = patch as Record<string, unknown>;

  for (const key of [
    'id_number',
    'gender',
    'address',
    'next_of_kin',
    'next_of_kin_phone',
    'gp_name',
    'gp_phone',
    'allergies',
    'chronic_conditions',
    'current_meds',
  ] as const) {
    if (p[key] !== undefined) {
      (base as Record<string, unknown>)[key] = p[key]
        ? String(p[key])
        : undefined;
    }
  }
  if (p.date_of_birth !== undefined) {
    base.date_of_birth = p.date_of_birth
      ? String(p.date_of_birth).slice(0, 10)
      : null;
  }
  if (p.medical_aid && typeof p.medical_aid === 'object') {
    base.medical_aid = {
      ...base.medical_aid,
      ...(p.medical_aid as MedicalAidDetails),
    };
  }
  if (Array.isArray(p.documents)) {
    base.documents = p.documents as MedicalRecordDoc[];
  }
  if (Array.isArray(p.scripts)) {
    base.scripts = p.scripts as PatientScript[];
  }
  if (Array.isArray(p.claims)) {
    base.claims = p.claims as MedicalAidClaim[];
  }
  return base;
}

export function addMedicalDocument(
  medical: PatientMedicalRecord | undefined,
  doc: Omit<MedicalRecordDoc, 'id' | 'uploaded_at'> & {
    id?: string;
    uploaded_at?: string;
  },
  now = new Date().toISOString()
): PatientMedicalRecord {
  const base = mergeMedicalRecord(medical, {});
  const row: MedicalRecordDoc = {
    id: doc.id || newMedId('mdoc'),
    title: String(doc.title || doc.file_name || 'Document'),
    file_name: String(doc.file_name || 'file'),
    url: String(doc.url || ''),
    kind: doc.kind || 'other',
    uploaded_at: doc.uploaded_at || now,
    notes: doc.notes != null ? String(doc.notes) : undefined,
  };
  base.documents = [row, ...(base.documents || [])];
  return base;
}

export function removeMedicalDocument(
  medical: PatientMedicalRecord | undefined,
  docId: string
): PatientMedicalRecord {
  const base = mergeMedicalRecord(medical, {});
  base.documents = (base.documents || []).filter((d) => d.id !== docId);
  return base;
}

export function upsertMedicalClaim(
  medical: PatientMedicalRecord | undefined,
  rec: Partial<
    Omit<MedicalAidClaim, 'amount_zar' | 'patient_portion' | 'scheme_portion'>
  > & {
    id?: string;
    /** Forms may send '' or string numbers */
    amount_zar?: number | string | null;
    patient_portion?: number | string | null;
    scheme_portion?: number | string | null;
  },
  now = new Date().toISOString()
): PatientMedicalRecord {
  const base = mergeMedicalRecord(medical, {});
  const id = String(rec.id || newMedId('mclm'));
  const i = (base.claims || []).findIndex((c) => c.id === id);
  const prev = i >= 0 ? base.claims![i] : null;
  const status = String(
    rec.status || prev?.status || 'draft'
  ) as MedicalAidClaimStatus;
  const row: MedicalAidClaim = {
    id,
    claim_number:
      rec.claim_number != null
        ? String(rec.claim_number)
        : prev?.claim_number || `CLM-${(base.claims || []).length + 1}`,
    status,
    service_date:
      rec.service_date !== undefined
        ? rec.service_date
          ? String(rec.service_date).slice(0, 10)
          : null
        : prev?.service_date ?? null,
    amount_zar:
      rec.amount_zar !== undefined
        ? rec.amount_zar === null ||
          (typeof rec.amount_zar === 'string' &&
            String(rec.amount_zar).trim() === '') ||
          Number.isNaN(Number(rec.amount_zar))
          ? null
          : Number(rec.amount_zar)
        : prev?.amount_zar ?? null,
    tariff_code:
      rec.tariff_code != null ? String(rec.tariff_code) : prev?.tariff_code,
    diagnosis_code:
      rec.diagnosis_code != null
        ? String(rec.diagnosis_code)
        : prev?.diagnosis_code,
    auth_number:
      rec.auth_number != null ? String(rec.auth_number) : prev?.auth_number,
    booking_id:
      rec.booking_id !== undefined
        ? rec.booking_id
          ? String(rec.booking_id)
          : null
        : prev?.booking_id ?? null,
    appointment_id:
      rec.appointment_id !== undefined
        ? rec.appointment_id
          ? String(rec.appointment_id)
          : null
        : prev?.appointment_id ?? null,
    treating_name:
      rec.treating_name != null
        ? String(rec.treating_name)
        : prev?.treating_name,
    notes: rec.notes != null ? String(rec.notes) : prev?.notes,
    submitted_at:
      status === 'submitted' ||
      status === 'accepted' ||
      status === 'paid' ||
      status === 'partial'
        ? prev?.submitted_at || now
        : status === 'draft' || status === 'ready'
          ? null
          : prev?.submitted_at ?? null,
    response_notes:
      rec.response_notes != null
        ? String(rec.response_notes)
        : prev?.response_notes,
    attachment_ids: Array.isArray(rec.attachment_ids)
      ? (rec.attachment_ids as string[])
      : prev?.attachment_ids || [],
    diagnosis_codes: Array.isArray(rec.diagnosis_codes)
      ? rec.diagnosis_codes.map(String).filter(Boolean)
      : rec.diagnosis_code
        ? [String(rec.diagnosis_code)]
        : prev?.diagnosis_codes,
    line_items: Array.isArray(rec.line_items)
      ? (rec.line_items as MedicalAidClaimLine[])
      : prev?.line_items,
    scheme_code:
      rec.scheme_code != null ? String(rec.scheme_code) : prev?.scheme_code,
    patient_portion:
      rec.patient_portion !== undefined
        ? rec.patient_portion === null || rec.patient_portion === ''
          ? null
          : Number(rec.patient_portion)
        : prev?.patient_portion ?? null,
    scheme_portion:
      rec.scheme_portion !== undefined
        ? rec.scheme_portion === null || rec.scheme_portion === ''
          ? null
          : Number(rec.scheme_portion)
        : prev?.scheme_portion ?? null,
    rejection_codes: Array.isArray(rec.rejection_codes)
      ? rec.rejection_codes.map(String)
      : prev?.rejection_codes,
    switch_provider: rec.switch_provider || prev?.switch_provider,
    switch_mode: rec.switch_mode || prev?.switch_mode,
    switch_tracking_number:
      rec.switch_tracking_number !== undefined
        ? rec.switch_tracking_number
          ? String(rec.switch_tracking_number)
          : null
        : prev?.switch_tracking_number ?? null,
    switch_response_raw:
      rec.switch_response_raw !== undefined
        ? rec.switch_response_raw
          ? String(rec.switch_response_raw)
          : null
        : prev?.switch_response_raw ?? null,
    invoice_id:
      rec.invoice_id !== undefined
        ? rec.invoice_id
          ? Number(rec.invoice_id)
          : null
        : prev?.invoice_id ?? null,
    charge_id:
      rec.charge_id !== undefined
        ? rec.charge_id
          ? String(rec.charge_id)
          : null
        : prev?.charge_id ?? null,
    responded_at:
      rec.responded_at !== undefined
        ? rec.responded_at
          ? String(rec.responded_at)
          : null
        : prev?.responded_at ?? null,
    paid_at:
      rec.paid_at !== undefined
        ? rec.paid_at
          ? String(rec.paid_at)
          : null
        : prev?.paid_at ?? null,
    era: Array.isArray(rec.era) ? (rec.era as MedicalAidEraPayment[]) : prev?.era,
    audit: Array.isArray(rec.audit)
      ? (rec.audit as MedicalAidClaimAudit[])
      : prev?.audit,
    created_at: prev?.created_at || now,
    updated_at: now,
  };
  if (i >= 0) base.claims![i] = row;
  else base.claims = [row, ...(base.claims || [])];
  return base;
}

export function submitMedicalClaim(
  medical: PatientMedicalRecord | undefined,
  claimId: string,
  now = new Date().toISOString()
): PatientMedicalRecord {
  const base = mergeMedicalRecord(medical, {});
  const claim = (base.claims || []).find((c) => c.id === claimId);
  if (!claim) throw new Error('Claim not found');
  const ymd = now.slice(0, 10).replace(/-/g, '');
  const claim_number =
    claim.claim_number && !claim.claim_number.startsWith('mclm_')
      ? claim.claim_number
      : `CLM-${ymd}-${claim.id.slice(-4).toUpperCase()}`;
  return upsertMedicalClaim(
    base,
    {
      ...claim,
      claim_number,
      status: 'submitted',
      submitted_at: now,
    },
    now
  );
}

export function medicalAidSummary(
  medical?: PatientMedicalRecord | null
): string {
  const a = medical?.medical_aid;
  if (!a?.scheme_name && !a?.membership_number) return 'No medical aid on file';
  const parts = [
    a.scheme_name,
    a.plan_name,
    a.membership_number ? `#${a.membership_number}` : null,
    a.dependent_code ? `dep ${a.dependent_code}` : null,
  ].filter(Boolean);
  return parts.join(' · ') || 'Medical aid on file';
}

export function claimStatusLabel(s?: string): string {
  return String(s || 'draft').replace(/_/g, ' ');
}

export function upsertPatientScript(
  medical: PatientMedicalRecord | undefined,
  rec: Partial<PatientScript> & {
    id?: string;
    medication?: string;
    repeats?: number | string | null;
  },
  now = new Date().toISOString()
): PatientMedicalRecord {
  const base = mergeMedicalRecord(medical, {});
  const medication = String(rec.medication || '').trim();
  const kind = String(
    rec.kind || (rec as { kind?: string }).kind || ''
  ).trim();
  const isRehab = kind === 'rehab';
  if (!medication && !rec.id) {
    throw new Error(
      isRehab ? 'Rehab name is required' : 'Medication name is required for a script'
    );
  }
  const id = String(rec.id || newMedId('rx'));
  const i = (base.scripts || []).findIndex((s) => s.id === id);
  const prev = i >= 0 ? base.scripts![i] : null;
  const med = medication || prev?.medication || '';
  if (!med) {
    throw new Error(
      isRehab || prev?.kind === 'rehab'
        ? 'Rehab name is required'
        : 'Medication name is required for a script'
    );
  }

  let repeats: number | null = null;
  if (rec.repeats !== undefined) {
    const raw = rec.repeats as number | string | null;
    if (raw === null || raw === '') {
      repeats = null;
    } else {
      const n = Number(raw);
      repeats = Number.isFinite(n) ? n : null;
    }
  } else {
    repeats = prev?.repeats ?? null;
  }

  const row: PatientScript = {
    id,
    kind:
      rec.kind !== undefined
        ? rec.kind
          ? String(rec.kind)
          : undefined
        : prev?.kind,
    medication: med,
    strength:
      rec.strength !== undefined
        ? rec.strength
          ? String(rec.strength)
          : undefined
        : prev?.strength,
    dose:
      rec.dose !== undefined
        ? rec.dose
          ? String(rec.dose)
          : undefined
        : prev?.dose,
    frequency:
      rec.frequency !== undefined
        ? rec.frequency
          ? String(rec.frequency)
          : undefined
        : prev?.frequency,
    route:
      rec.route !== undefined
        ? rec.route
          ? String(rec.route)
          : undefined
        : prev?.route,
    duration:
      rec.duration !== undefined
        ? rec.duration
          ? String(rec.duration)
          : undefined
        : prev?.duration,
    quantity:
      rec.quantity !== undefined
        ? rec.quantity
          ? String(rec.quantity)
          : undefined
        : prev?.quantity,
    repeats,
    instructions:
      rec.instructions !== undefined
        ? rec.instructions
          ? String(rec.instructions)
          : undefined
        : prev?.instructions,
    diagnosis:
      rec.diagnosis !== undefined
        ? rec.diagnosis
          ? String(rec.diagnosis)
          : undefined
        : prev?.diagnosis,
    prescribed_by:
      rec.prescribed_by !== undefined
        ? rec.prescribed_by
          ? String(rec.prescribed_by)
          : undefined
        : prev?.prescribed_by,
    practitioner_id:
      rec.practitioner_id !== undefined
        ? rec.practitioner_id
          ? String(rec.practitioner_id)
          : null
        : prev?.practitioner_id ?? null,
    appointment_id:
      rec.appointment_id !== undefined
        ? rec.appointment_id
          ? String(rec.appointment_id)
          : null
        : prev?.appointment_id ?? null,
    booking_id:
      rec.booking_id !== undefined
        ? rec.booking_id
          ? String(rec.booking_id)
          : null
        : prev?.booking_id ?? null,
    prescribed_at:
      rec.prescribed_at !== undefined
        ? rec.prescribed_at
          ? String(rec.prescribed_at).slice(0, 10)
          : null
        : prev?.prescribed_at ?? now.slice(0, 10),
    status: String(
      rec.status || prev?.status || 'active'
    ) as PatientScriptStatus,
    notes:
      rec.notes !== undefined
        ? rec.notes
          ? String(rec.notes)
          : undefined
        : prev?.notes,
    created_at: prev?.created_at || now,
    updated_at: now,
  };
  if (i >= 0) base.scripts![i] = row;
  else base.scripts = [row, ...(base.scripts || [])];
  return base;
}

export function removePatientScript(
  medical: PatientMedicalRecord | undefined,
  scriptId: string
): PatientMedicalRecord {
  const base = mergeMedicalRecord(medical, {});
  base.scripts = (base.scripts || []).filter((s) => s.id !== scriptId);
  return base;
}

export function scriptSummaryLine(s: PatientScript): string {
  const parts = [
    s.medication,
    s.strength,
    s.dose,
    s.frequency,
    s.route ? `(${s.route})` : null,
    s.duration ? `for ${s.duration}` : null,
  ].filter(Boolean);
  return parts.join(' · ');
}

export function scriptsSummary(
  medical?: PatientMedicalRecord | null
): string {
  const list = medical?.scripts || [];
  const active = list.filter(
    (s) => String(s.status || 'active').toLowerCase() === 'active'
  );
  const rehab = list.some((s) => s.kind === 'rehab');
  const noun = rehab ? 'rehab' : 'script';
  if (!active.length && !list.length) return `No ${noun} on file`;
  if (!active.length) return `${list.length} ${noun}(s) · none active`;
  if (active.length === 1) return scriptSummaryLine(active[0]);
  return `${active.length} active ${noun}${active.length === 1 ? '' : 's'}`;
}
