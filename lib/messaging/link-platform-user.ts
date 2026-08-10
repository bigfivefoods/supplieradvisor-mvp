/**
 * Link a Fit/clinic client or patient record to a platform system user id
 * so care messaging delivers in-app by user id.
 */
import { getCanonicalUserId } from '@/lib/auth/identity';

export function normalizePlatformUserId(
  raw: string | null | undefined
): string | null {
  return getCanonicalUserId(raw) || null;
}

/**
 * Apply platform_user_id onto a person-like record if not already set
 * (or if re-linking to the same family of ids).
 */
export function linkPlatformUserId<
  T extends { platform_user_id?: string | null },
>(person: T, userId: string | null | undefined): T {
  const next = normalizePlatformUserId(userId);
  if (!next) return person;
  const prev = normalizePlatformUserId(person.platform_user_id);
  if (prev && prev === next) return person;
  // Prefer keeping a longer/canonical form if both present
  person.platform_user_id = next;
  return person;
}
