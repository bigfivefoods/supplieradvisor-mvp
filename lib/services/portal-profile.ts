/**
 * Shared self-serve profile updates for member/patient portals.
 * Keeps email + invite_email + ID number in sync with desk records
 * (and messaging fan-out identity keyed by email).
 */
import {
  mergeMedicalRecord,
  type PatientMedicalRecord,
} from '@/lib/clinic/patient-medical';

/** Shown under member/patient PWA photo upload. */
export const PORTAL_PHOTO_SHARE_HINT =
  'This photo is saved on your SA Member wallet and shared with your other Advisors (gyms and clinics you have joined).';

export const PORTAL_PHOTO_SAVED_MESSAGE =
  'Photo saved on your wallet and shared with your Advisors';

/** Confirm copy after a portal profile save (wallet write-through + desk stamp). */
export function portalProfileSaveMessage(
  result: { emailChanged: boolean },
  body: Record<string, unknown>,
  deskLabel: string
): string {
  if (result.emailChanged) {
    return `Profile updated — email synced to your wallet and ${deskLabel}`;
  }
  if (body.photo_url !== undefined && body.name == null) {
    return PORTAL_PHOTO_SAVED_MESSAGE;
  }
  return 'Profile updated on your wallet and shared with your Advisors';
}

export function normalizePortalEmail(
  raw: unknown
): string | undefined | null {
  if (raw === undefined) return undefined;
  if (raw === null || raw === '') return null;
  const e = String(raw).toLowerCase().trim();
  if (!e) return null;
  // Lightweight validation — full RFC is unnecessary for desk CRM
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
    return '__invalid__';
  }
  return e;
}

export function normalizeIdNumber(raw: unknown): string | undefined | null {
  if (raw === undefined) return undefined;
  if (raw === null || raw === '') return null;
  // Keep digits and common separators; strip other noise
  const cleaned = String(raw).trim().replace(/[^\d\s\-]/g, '');
  return cleaned || null;
}

type PersonLike = {
  name: string;
  email?: string;
  phone?: string;
  photo_url?: string;
  /** SA ID / passport / national number (fitness members) */
  id_number?: string;
  invite_email?: string | null;
  medical?: PatientMedicalRecord;
  updated_at?: string;
};

export type ApplyPortalProfileResult =
  | { ok: true; emailChanged: boolean; previousEmail?: string | null }
  | { ok: false; error: string };

/**
 * Mutates `person` in place from a portal update_profile body.
 * @param opts.storeIdOnMedical — write id_number into medical chart (clinics)
 * @param opts.storeIdOnRoot — write id_number on the person record (fitness)
 */
export function applyPortalProfileUpdate(
  person: PersonLike,
  body: Record<string, unknown>,
  opts: {
    storeIdOnMedical?: boolean;
    storeIdOnRoot?: boolean;
    now?: string;
  } = {}
): ApplyPortalProfileResult {
  const now = opts.now || new Date().toISOString();
  let emailChanged = false;
  let previousEmail: string | null | undefined = person.email || null;

  if (body.name != null && String(body.name).trim()) {
    person.name = String(body.name).trim();
  }
  if (body.phone !== undefined) {
    person.phone = body.phone ? String(body.phone).trim() : undefined;
  }
  if (body.photo_url !== undefined) {
    person.photo_url = body.photo_url ? String(body.photo_url) : undefined;
  }

  if (body.email !== undefined) {
    const normalized = normalizePortalEmail(body.email);
    if (normalized === '__invalid__') {
      return { ok: false, error: 'Enter a valid email address' };
    }
    const next = normalized || undefined;
    const prev = (person.email || '').toLowerCase().trim() || undefined;
    if (next !== prev) {
      emailChanged = true;
      previousEmail = person.email || null;
    }
    person.email = next;
    // Keep invite + care-message identity aligned with the live email
    if (next) {
      person.invite_email = next;
    } else if (person.invite_email) {
      person.invite_email = null;
    }
  }

  if (body.id_number !== undefined) {
    const id = normalizeIdNumber(body.id_number);
    if (opts.storeIdOnRoot) {
      person.id_number = id || undefined;
    }
    if (opts.storeIdOnMedical) {
      const next = mergeMedicalRecord(person.medical, {
        id_number: id || '',
      });
      // mergeMedicalRecord stores empty as undefined via String falsy path when '' is passed… keep explicit clear
      person.medical = {
        ...next,
        id_number: id || undefined,
      };
    }
  }

  person.updated_at = now;
  return { ok: true, emailChanged, previousEmail };
}

/** Resolve id_number for portal payloads (root or medical chart). */
export function portalIdNumber(person: {
  id_number?: string | null;
  medical?: { id_number?: string | null } | null;
}): string | undefined {
  const root = person.id_number ? String(person.id_number).trim() : '';
  if (root) return root;
  const med = person.medical?.id_number
    ? String(person.medical.id_number).trim()
    : '';
  return med || undefined;
}
