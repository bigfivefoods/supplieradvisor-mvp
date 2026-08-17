/**
 * Reusable personal passport on the SA Member wallet.
 * Filled once on /me and stamped onto gym / clinic desks when the
 * member links or updates — Advisors do not re-capture the same facts.
 */
import { COMMON_MEDICAL_SCHEMES } from '@/lib/clinic/patient-medical';
import type { PersonHealthProfile } from '@/lib/health/body-map';

export const PASSPORT_TITLES = ['', 'Mr', 'Mrs', 'Ms', 'Mx', 'Dr', 'Prof'] as const;

export const PASSPORT_SEX_OPTIONS = [
  { value: '', label: 'Prefer not to say' },
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'other', label: 'Other' },
] as const;

export const PASSPORT_ID_TYPES = [
  { value: 'sa_id', label: 'South African ID' },
  { value: 'passport', label: 'Passport' },
  { value: 'other', label: 'Other' },
] as const;

export const PASSPORT_LANGUAGES = [
  'English',
  'Afrikaans',
  'isiZulu',
  'isiXhosa',
  'Sesotho',
  'Setswana',
  'Sepedi',
  'Xitsonga',
  'siSwati',
  'Tshivenda',
  'isiNdebele',
  'Other',
] as const;

export const SA_PROVINCES = [
  'Eastern Cape',
  'Free State',
  'Gauteng',
  'KwaZulu-Natal',
  'Limpopo',
  'Mpumalanga',
  'Northern Cape',
  'North West',
  'Western Cape',
] as const;

export const EXPERIENCE_LEVELS = [
  { value: '', label: 'Not sure' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
] as const;

export const MEDICAL_SCHEME_OPTIONS = [...COMMON_MEDICAL_SCHEMES];

export type MemberPassport = {
  preferred_name?: string | null;
  title?: string | null;
  date_of_birth?: string | null;
  sex?: string | null;
  language?: string | null;
  nationality?: string | null;
  id_type?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  suburb?: string | null;
  city?: string | null;
  province?: string | null;
  postal_code?: string | null;
  country?: string | null;
  emergency_name?: string | null;
  emergency_phone?: string | null;
  emergency_relationship?: string | null;
  medical_aid_scheme?: string | null;
  medical_aid_plan?: string | null;
  medical_aid_number?: string | null;
  medical_aid_dependent?: string | null;
  allergies?: string | null;
  chronic_conditions?: string | null;
  medications?: string | null;
  blood_type?: string | null;
  gp_name?: string | null;
  gp_phone?: string | null;
  injured?: boolean;
  injury_notes?: string | null;
  training_modifications?: string | null;
  goals?: string | null;
  experience_level?: string | null;
  popia_consent?: boolean;
  share_health_with_advisors?: boolean;
  marketing_opt_in?: boolean;
};

function clean(v: unknown): string | null {
  const s = String(v ?? '').trim();
  return s || null;
}

function flag(v: unknown): boolean {
  return v === true || v === 'true' || v === 1 || v === '1';
}

export function emptyMemberPassport(): MemberPassport {
  return {
    country: 'South Africa',
    share_health_with_advisors: true,
  };
}

export function parseMemberPassport(raw: unknown): MemberPassport {
  const src =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  return {
    preferred_name: clean(src.preferred_name),
    title: clean(src.title),
    date_of_birth: clean(src.date_of_birth)?.slice(0, 10) || null,
    sex: clean(src.sex),
    language: clean(src.language),
    nationality: clean(src.nationality),
    id_type: clean(src.id_type),
    address_line1: clean(src.address_line1),
    address_line2: clean(src.address_line2),
    suburb: clean(src.suburb),
    city: clean(src.city),
    province: clean(src.province),
    postal_code: clean(src.postal_code),
    country: clean(src.country) || 'South Africa',
    emergency_name: clean(src.emergency_name),
    emergency_phone: clean(src.emergency_phone),
    emergency_relationship: clean(src.emergency_relationship),
    medical_aid_scheme: clean(src.medical_aid_scheme),
    medical_aid_plan: clean(src.medical_aid_plan),
    medical_aid_number: clean(src.medical_aid_number),
    medical_aid_dependent: clean(src.medical_aid_dependent),
    allergies: clean(src.allergies),
    chronic_conditions: clean(src.chronic_conditions),
    medications: clean(src.medications),
    blood_type: clean(src.blood_type),
    gp_name: clean(src.gp_name),
    gp_phone: clean(src.gp_phone),
    injured: src.injured == null ? undefined : flag(src.injured),
    injury_notes: clean(src.injury_notes),
    training_modifications: clean(src.training_modifications),
    goals: clean(src.goals),
    experience_level: clean(src.experience_level),
    popia_consent: src.popia_consent == null ? undefined : flag(src.popia_consent),
    share_health_with_advisors:
      src.share_health_with_advisors == null
        ? true
        : flag(src.share_health_with_advisors),
    marketing_opt_in:
      src.marketing_opt_in == null ? undefined : flag(src.marketing_opt_in),
  };
}

export function passportFromProfileMeta(
  metadata: Record<string, unknown> | null | undefined,
  extras?: { city?: string | null }
): MemberPassport {
  const parsed = parseMemberPassport(metadata?.passport);
  if (!parsed.city && extras?.city) parsed.city = extras.city;
  return parsed;
}

export function formatEmergencyContact(p: MemberPassport): string | null {
  const name = p.emergency_name?.trim();
  const phone = p.emergency_phone?.trim();
  if (!name && !phone) return null;
  const rel = p.emergency_relationship?.trim();
  const who = [name, rel ? `(${rel})` : null].filter(Boolean).join(' ');
  return [who, phone].filter(Boolean).join(' · ') || null;
}

export function formatAddress(p: MemberPassport): string | null {
  const parts = [
    p.address_line1,
    p.address_line2,
    p.suburb,
    p.city,
    p.province,
    p.postal_code,
    p.country && p.country !== 'South Africa' ? p.country : null,
  ].filter((x) => x && String(x).trim());
  return parts.length ? parts.join(', ') : null;
}

export function healthFromPassport(p: MemberPassport): PersonHealthProfile {
  return {
    injured: p.injured === true,
    injury_notes: p.injury_notes || '',
    training_modifications: p.training_modifications || '',
    goals: p.goals || '',
    updated_at: new Date().toISOString(),
    updated_by: 'wallet',
  };
}

export function passportCompleteness(p: MemberPassport): {
  score: number;
  max: number;
  missing: string[];
} {
  const checks: Array<{ ok: boolean; label: string }> = [
    { ok: Boolean(p.date_of_birth), label: 'Date of birth' },
    { ok: Boolean(p.address_line1 && (p.city || p.suburb)), label: 'Address' },
    { ok: Boolean(p.emergency_name && p.emergency_phone), label: 'Emergency contact' },
    {
      ok: Boolean(p.allergies || p.chronic_conditions || p.medications),
      label: 'Health notes',
    },
  ];
  const missing = checks.filter((c) => !c.ok).map((c) => c.label);
  return {
    score: checks.filter((c) => c.ok).length,
    max: checks.length,
    missing,
  };
}
