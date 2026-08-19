export const ADVISOR_SHARE_KINDS = [
  'gym',
  'physio',
  'dental',
  'medical',
  'psychiatry',
] as const;

export type AdvisorShareKind = (typeof ADVISOR_SHARE_KINDS)[number];

export const SHARE_KIND_LABEL: Record<AdvisorShareKind, string> = {
  gym: 'GymAdvisor®',
  physio: 'PhysioAdvisor®',
  dental: 'DentalAdvisor®',
  medical: 'MedicalAdvisor®',
  psychiatry: 'PsychiatryAdvisor®',
};

export type ProfileShareStatus =
  | 'pending'
  | 'active'
  | 'declined'
  | 'revoked';

export type ProfileShareSnapshot = {
  name: string;
  email?: string;
  phone?: string;
  id_hint?: string;
  brand: string;
  kind: AdvisorShareKind;
  health?: string;
  medical?: Record<string, unknown> | null;
  captured_at: string;
  scopes?: string[];
  referral_reason?: string | null;
  practice?: {
    brand: string;
    module: AdvisorShareKind;
    contact_email?: string | null;
    contact_phone?: string | null;
    city?: string | null;
    website?: string | null;
    practice_number?: string | null;
    referring_practitioner?: string | null;
  };
  visits?: Array<{
    date: string;
    start_time?: string;
    service_name: string;
    practitioner_name?: string;
    status?: string;
    notes?: string;
  }>;
};

export type ProfileShare = {
  id: string;
  from_company_id: number;
  from_company_name: string;
  from_kind: AdvisorShareKind;
  from_ref_id: string;
  to_company_id: number;
  to_company_name: string;
  to_kind: AdvisorShareKind;
  status: ProfileShareStatus;
  requested_by: 'member' | 'desk';
  requested_at: string;
  decided_at?: string | null;
  note?: string | null;
  snapshot?: ProfileShareSnapshot | null;
};

export type AdvisorSharePeer = {
  company_id: number;
  name: string;
  kinds: AdvisorShareKind[];
};

export function isAdvisorShareKind(v: unknown): v is AdvisorShareKind {
  return ADVISOR_SHARE_KINDS.includes(v as AdvisorShareKind);
}
