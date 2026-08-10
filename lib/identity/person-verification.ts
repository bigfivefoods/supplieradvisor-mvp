/**
 * Identity verification for service-module people (members, patients, coaches).
 * SA nationals → VerifyNow SA ID check.
 * International → Didit hosted KYC session.
 */

export type IdentityProvider = 'verifynow' | 'didit';

export type IdentityStatus =
  | 'unverified'
  | 'pending'
  | 'verified'
  | 'failed'
  | 'mismatch'
  | 'in_review';

export type PersonIdentityVerification = {
  status: IdentityStatus;
  provider?: IdentityProvider | null;
  /** When status became verified */
  verified_at?: string | null;
  /** Provider request / session id */
  reference?: string | null;
  verified_name?: string | null;
  verified_dob?: string | null;
  /** SA ID / passport number used for the check (may mirror person.id_number) */
  id_number?: string | null;
  consent_at?: string | null;
  status_text?: string | null;
  last_checked_at?: string | null;
  /** Didit hosted session */
  didit_session_id?: string | null;
  didit_url?: string | null;
  /** Safe summary for desk (no full raw dump) */
  summary?: Record<string, unknown> | null;
};

export function emptyIdentity(): PersonIdentityVerification {
  return { status: 'unverified' };
}

export function readIdentity(
  raw: unknown
): PersonIdentityVerification {
  if (!raw || typeof raw !== 'object') return emptyIdentity();
  const o = raw as Record<string, unknown>;
  const status = String(o.status || 'unverified') as IdentityStatus;
  const allowed: IdentityStatus[] = [
    'unverified',
    'pending',
    'verified',
    'failed',
    'mismatch',
    'in_review',
  ];
  return {
    status: allowed.includes(status) ? status : 'unverified',
    provider:
      o.provider === 'verifynow' || o.provider === 'didit'
        ? o.provider
        : null,
    verified_at: o.verified_at ? String(o.verified_at) : null,
    reference: o.reference ? String(o.reference) : null,
    verified_name: o.verified_name ? String(o.verified_name) : null,
    verified_dob: o.verified_dob ? String(o.verified_dob) : null,
    id_number: o.id_number ? String(o.id_number) : null,
    consent_at: o.consent_at ? String(o.consent_at) : null,
    status_text: o.status_text ? String(o.status_text) : null,
    last_checked_at: o.last_checked_at ? String(o.last_checked_at) : null,
    didit_session_id: o.didit_session_id ? String(o.didit_session_id) : null,
    didit_url: o.didit_url ? String(o.didit_url) : null,
    summary:
      o.summary && typeof o.summary === 'object'
        ? (o.summary as Record<string, unknown>)
        : null,
  };
}

/** Safe payload for portals (no large dumps). */
export function portalIdentityView(raw: unknown): {
  status: IdentityStatus;
  provider?: string | null;
  verified_at?: string | null;
  verified_name?: string | null;
  status_text?: string | null;
  is_verified: boolean;
} {
  const id = readIdentity(raw);
  return {
    status: id.status,
    provider: id.provider || null,
    verified_at: id.verified_at || null,
    verified_name: id.verified_name || null,
    status_text: id.status_text || null,
    is_verified: id.status === 'verified',
  };
}

export function softNameMatch(
  localName: string | undefined | null,
  remoteName: string | undefined | null
): boolean {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .split(/\s+/)
      .filter(Boolean)
      .sort()
      .join(' ');
  const a = normalize(String(localName || ''));
  const b = normalize(String(remoteName || ''));
  if (!a || !b) return true; // no basis to flag mismatch
  const a0 = a.split(' ')[0];
  const b0 = b.split(' ')[0];
  return a.includes(b0) || b.includes(a0) || a.includes(b) || b.includes(a);
}

export type ServiceIdentityModule =
  | 'fitgraph'
  | 'physiograph'
  | 'dentalgraph'
  | 'medicalgraph'
  | 'psychiatrygraph';

export type ServiceIdentityRole = 'member' | 'patient' | 'coach';

/** Didit vendor_data — stable across restarts */
export function buildDiditVendorData(opts: {
  module: ServiceIdentityModule;
  role: ServiceIdentityRole;
  companyId: number;
  personId: string;
}): string {
  return `sa:${opts.module}:${opts.role}:${opts.companyId}:${opts.personId}`;
}

export function parseDiditVendorData(
  vendor: string | null | undefined
): {
  module: ServiceIdentityModule;
  role: ServiceIdentityRole;
  companyId: number;
  personId: string;
} | null {
  const parts = String(vendor || '').split(':');
  if (parts.length < 5 || parts[0] !== 'sa') return null;
  const module = parts[1] as ServiceIdentityModule;
  const role = parts[2] as ServiceIdentityRole;
  const companyId = Number(parts[3]);
  const personId = parts.slice(4).join(':');
  const modules: ServiceIdentityModule[] = [
    'fitgraph',
    'physiograph',
    'dentalgraph',
    'medicalgraph',
    'psychiatrygraph',
  ];
  const roles: ServiceIdentityRole[] = ['member', 'patient', 'coach'];
  if (!modules.includes(module) || !roles.includes(role)) return null;
  if (!Number.isFinite(companyId) || !personId) return null;
  return { module, role, companyId, personId };
}
