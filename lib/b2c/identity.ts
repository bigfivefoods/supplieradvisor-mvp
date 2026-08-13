/**
 * Wallet-level identity on platform_b2c_profiles.metadata
 */
import {
  emptyIdentity,
  portalIdentityView,
  readIdentity,
  type PersonIdentityVerification,
} from '@/lib/identity/person-verification';
import type { B2cProfile } from '@/lib/b2c/types';

export function identityFromProfile(
  profile: B2cProfile
): PersonIdentityVerification {
  return readIdentity(profile.metadata?.identity);
}

export function applyIdentityToProfile(
  profile: B2cProfile,
  identity: PersonIdentityVerification,
  extras?: { id_number?: string | null; city?: string | null }
): B2cProfile {
  const metadata = { ...(profile.metadata || {}) };
  metadata.identity = identity;
  if (extras?.id_number != null) {
    metadata.id_number = extras.id_number;
    profile.id_number = extras.id_number;
  }
  if (extras?.city != null) {
    metadata.city = extras.city;
    profile.city = extras.city;
  }
  if (identity.id_number && !profile.id_number) {
    profile.id_number = identity.id_number;
    metadata.id_number = identity.id_number;
  }
  return { ...profile, metadata };
}

export function profileCompleteness(profile: B2cProfile): {
  score: number;
  max: number;
  missing: string[];
  verified: boolean;
} {
  const identity = identityFromProfile(profile);
  const verified = identity.status === 'verified';
  const checks: Array<{ ok: boolean; label: string }> = [
    { ok: Boolean(profile.full_name?.trim()), label: 'Name' },
    { ok: Boolean(profile.email?.trim()), label: 'Email' },
    { ok: Boolean(profile.phone?.trim()), label: 'Phone' },
    { ok: verified, label: 'Verified ID' },
  ];
  const missing = checks.filter((c) => !c.ok).map((c) => c.label);
  return {
    score: checks.filter((c) => c.ok).length,
    max: checks.length,
    missing,
    verified,
  };
}

export function verificationView(profile: B2cProfile) {
  return {
    ...portalIdentityView(identityFromProfile(profile)),
    id_number: profile.id_number || identityFromProfile(profile).id_number || null,
    city: profile.city || null,
    completeness: profileCompleteness(profile),
  };
}

export { emptyIdentity, portalIdentityView };
