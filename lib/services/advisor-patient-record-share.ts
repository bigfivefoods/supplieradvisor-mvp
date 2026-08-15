/**
 * Filter clinical payloads by consented scopes for patient portal
 * and cross-professional shares (POPIA).
 */

import { buildPatientMedicalShare } from '@/lib/clinic/medical-share';
import {
  type ClinicalShareScope,
  PATIENT_PORTAL_DEFAULT_SCOPES,
  PROFESSIONAL_SHARE_DEFAULT_SCOPES,
  scopesAllowedForPatient,
  scopesAllowedForProfessional,
  type PatientRecordShareGrant,
} from '@/lib/services/advisor-b2c-relationship';

type PatientLike = {
  id: string;
  name?: string;
  share_medical?: boolean;
  diagnosis_notes?: string | null;
  clinical?: {
    injury_status?: string | null;
    injury_areas?: unknown;
    injury_notes?: string | null;
    diagnosis_notes?: string | null;
    training_modifications?: string | null;
    goals?: string | null;
    pain_score?: number | null;
  } | null;
  medical?: {
    allergies?: string | null;
    chronic_conditions?: string | null;
    current_meds?: string | null;
    medical_aid?: Record<string, unknown> | null;
    scripts?: Array<Record<string, unknown>> | null;
  } | null;
  treatment_plan?: unknown;
  care_plan?: unknown;
  documents?: Array<{ id: string; title?: string; kind?: string }> | null;
  visit_notes?: Array<{ id: string; summary?: string; at?: string }> | null;
};

export type SharedPatientRecord = {
  person_id: string;
  scopes: ClinicalShareScope[];
  summary?: Record<string, unknown> | null;
  treatment_plan?: unknown;
  scripts?: unknown;
  clinical_notes?: unknown;
  documents?: unknown;
  share_notice: string;
};

function filterByScopes(
  patient: PatientLike,
  scopes: ClinicalShareScope[]
): SharedPatientRecord {
  const set = new Set(scopes);
  const out: SharedPatientRecord = {
    person_id: patient.id,
    scopes,
    share_notice:
      'Shared under patient consent (POPIA). Full charts remain with the originating practice unless full_chart scope is granted.',
  };

  if (set.has('summary') || set.has('full_chart')) {
    out.summary = buildPatientMedicalShare(patient);
  }
  if (set.has('treatment_plan') || set.has('full_chart')) {
    out.treatment_plan =
      patient.treatment_plan ||
      patient.care_plan ||
      patient.clinical?.goals ||
      null;
  }
  if (set.has('scripts') || set.has('full_chart')) {
    const scripts = (patient.medical?.scripts || []).filter(
      (s) => String(s.status || 'active').toLowerCase() === 'active'
    );
    out.scripts = scripts.length ? scripts : null;
  }
  if (set.has('clinical_notes') || set.has('full_chart')) {
    out.clinical_notes = patient.visit_notes || null;
  }
  if (set.has('imaging_docs') || set.has('full_chart')) {
    out.documents = patient.documents || null;
  }
  return out;
}

/** What the patient sees on their portal */
export function buildPatientFacingRecord(
  patient: PatientLike,
  grants?: PatientRecordShareGrant[]
): SharedPatientRecord | null {
  if (patient.share_medical === false) return null;
  const scopes = grants
    ? scopesAllowedForPatient(grants, patient.id)
    : [...PATIENT_PORTAL_DEFAULT_SCOPES];
  return filterByScopes(patient, scopes);
}

/** What another professional may see after active consent */
export function buildProfessionalFacingRecord(
  patient: PatientLike,
  toCompanyId: number,
  grants: PatientRecordShareGrant[]
): SharedPatientRecord | null {
  const scopes = scopesAllowedForProfessional(
    grants,
    patient.id,
    toCompanyId
  );
  if (scopes.length === 0) return null;
  return filterByScopes(patient, scopes);
}

export function defaultProfessionalRequestScopes(): ClinicalShareScope[] {
  return [...PROFESSIONAL_SHARE_DEFAULT_SCOPES];
}
