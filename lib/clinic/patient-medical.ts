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
  'paid',
  'rejected',
  'partial',
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

export type MedicalAidClaim = {
  id: string;
  claim_number?: string;
  status: MedicalAidClaimStatus;
  /** Date of service YYYY-MM-DD */
  service_date?: string | null;
  amount_zar?: number | null;
  /** Procedure / tariff code (e.g. NHRPL) */
  tariff_code?: string;
  /** ICD-10 diagnosis code */
  diagnosis_code?: string;
  auth_number?: string;
  booking_id?: string | null;
  appointment_id?: string | null;
  treating_name?: string;
  notes?: string;
  submitted_at?: string | null;
  /** Scheme response / rejection reason */
  response_notes?: string;
  /** Linked medical document ids (e.g. account, referral) */
  attachment_ids?: string[];
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
};

export function emptyMedicalRecord(): PatientMedicalRecord {
  return {
    medical_aid: {},
    documents: [],
    claims: [],
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
  rec: Partial<Omit<MedicalAidClaim, 'amount_zar'>> & {
    id?: string;
    /** Forms may send '' or string numbers */
    amount_zar?: number | string | null;
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
      status === 'submitted' || status === 'paid' || status === 'partial'
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
  return upsertMedicalClaim(
    base,
    {
      ...claim,
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
