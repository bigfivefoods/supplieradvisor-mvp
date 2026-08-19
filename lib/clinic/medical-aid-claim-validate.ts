/**
 * Required-field + format checks before a medical-aid claim is submitted.
 */
import type {
  MedicalAidClaim,
  MedicalAidDetails,
  PatientMedicalRecord,
} from '@/lib/clinic/patient-medical';

const ICD10 = /^[A-Za-z][0-9]{2}(?:\.[0-9A-Za-z]{1,4})?$/;
const TARIFF = /^[0-9]{3,8}[A-Za-z]?$/;

export type ClaimValidation = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

export function parseIcd10List(raw?: string | string[] | null): string[] {
  const parts = Array.isArray(raw)
    ? raw
    : String(raw || '')
        .split(/[,;\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of parts) {
    const key = p.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

export function validateIcd10(code: string): boolean {
  return ICD10.test(String(code || '').trim());
}

export function validateTariffCode(code: string): boolean {
  return TARIFF.test(String(code || '').replace(/\s+/g, ''));
}

export function validateMedicalAidClaim(opts: {
  claim: MedicalAidClaim;
  medical?: PatientMedicalRecord | null;
  billing?: { pcns_number?: string; bhf_number?: string } | null;
  requireConsent?: boolean;
}): ClaimValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const claim = opts.claim;
  const aid = opts.medical?.medical_aid || ({} as MedicalAidDetails);
  const billing = opts.billing || {};

  const pcns = String(billing.pcns_number || billing.bhf_number || '').trim();
  if (!pcns) {
    errors.push('Practice PCNS / BHF number is required before electronic submit');
  }

  const member = String(aid.membership_number || '').trim();
  if (!member) {
    errors.push('Patient medical-aid membership number is missing');
  } else if (member.length < 5) {
    errors.push('Membership number looks too short');
  }

  if (!aid.scheme_name && !claim.scheme_code) {
    errors.push('Medical scheme name or scheme code is required');
  }

  const serviceDate = String(claim.service_date || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(serviceDate)) {
    errors.push('Service date is required');
  } else if (serviceDate > new Date().toISOString().slice(0, 10)) {
    errors.push('Service date cannot be in the future');
  }

  const amount = Number(claim.amount_zar);
  if (!(amount > 0)) {
    errors.push('Claim amount must be greater than zero');
  }

  const lines = claim.line_items || [];
  const tariff =
    String(claim.tariff_code || lines[0]?.tariff_code || '').replace(/\s+/g, '');
  if (!tariff) {
    errors.push('Tariff / NHRPL code is required');
  } else if (!validateTariffCode(tariff)) {
    errors.push(`Tariff code “${tariff}” is not a valid NHRPL-style code`);
  }

  const icds = parseIcd10List(
    claim.diagnosis_codes?.length
      ? claim.diagnosis_codes
      : claim.diagnosis_code || lines[0]?.icd10
  );
  if (!icds.length) {
    errors.push('At least one ICD-10 diagnosis code is required');
  } else {
    for (const code of icds) {
      if (!validateIcd10(code)) {
        errors.push(`ICD-10 “${code}” is not a valid code (e.g. J06.9, M54.5)`);
      }
    }
  }

  if (opts.requireConsent && !aid.claims_consent_at) {
    errors.push(
      'Patient has not consented to sharing medical-aid data for this claim'
    );
  }

  if (!opts.medical?.id_number && !opts.medical?.date_of_birth) {
    warnings.push('Add patient ID number or date of birth for fewer rejections');
  }
  if (aid.auth_required && !String(claim.auth_number || aid.auth_number || '').trim()) {
    warnings.push('Scheme usually wants an authorisation number');
  }
  const patientPortion = Number(claim.patient_portion);
  const schemePortion = Number(claim.scheme_portion);
  if (
    Number.isFinite(patientPortion) &&
    Number.isFinite(schemePortion) &&
    Math.abs(patientPortion + schemePortion - amount) > 0.05
  ) {
    warnings.push('Patient + scheme portions do not add up to the claimed amount');
  }

  return { ok: errors.length === 0, errors, warnings };
}
