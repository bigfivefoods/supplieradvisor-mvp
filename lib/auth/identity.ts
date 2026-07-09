/**
 * Canonical user identity for SupplierAdvisor.
 * Always store and query the full Privy user id (e.g. did:privy:...).
 */

export function getCanonicalUserId(privyUserId: string | null | undefined): string | null {
  if (!privyUserId || typeof privyUserId !== 'string') return null;
  const trimmed = privyUserId.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Legacy rows may store stripped ids — match both forms when querying. */
export function userIdMatchVariants(privyUserId: string): string[] {
  const canonical = getCanonicalUserId(privyUserId);
  if (!canonical) return [];
  const variants = new Set<string>([canonical]);

  if (canonical.startsWith('did:privy:')) {
    variants.add(canonical.replace(/^did:privy:/, ''));
    variants.add(`privy:${canonical.replace(/^did:privy:/, '')}`);
  }
  if (canonical.startsWith('privy:')) {
    const bare = canonical.replace(/^privy:/, '');
    variants.add(bare);
    variants.add(`did:privy:${bare}`);
  }
  // bare uuid-like
  if (!canonical.includes(':')) {
    variants.add(`privy:${canonical}`);
    variants.add(`did:privy:${canonical}`);
  }

  return Array.from(variants);
}

/**
 * Extract a primary email from a Privy user object.
 * Accepts the Privy `User` shape loosely so linked-account union types
 * (where `email` may be `string | null`) remain assignable.
 */
export function extractEmailFromPrivyUser(user: {
  email?: { address?: string | null } | null;
  google?: { email?: string | null } | null;
  apple?: { email?: string | null } | null;
  linkedAccounts?: ReadonlyArray<{
    type?: string;
    address?: string | null;
    email?: string | null;
  }> | null;
} | null | undefined): string | null {
  if (!user) return null;
  if (user.email?.address) return user.email.address.toLowerCase();
  if (user.google?.email) return user.google.email.toLowerCase();
  if (user.apple?.email) return user.apple.email.toLowerCase();
  const linked = user.linkedAccounts || [];
  for (const account of linked) {
    if (account.type === 'email' && (account.address || account.email)) {
      return String(account.address || account.email).toLowerCase();
    }
    if (account.type === 'google_oauth' && account.email) {
      return account.email.toLowerCase();
    }
  }
  return null;
}

export const INVITE_EXPIRY_DAYS = 14;

export function isInviteExpired(createdAt: string | null | undefined, expiresAt?: string | null): boolean {
  if (expiresAt) {
    return new Date(expiresAt).getTime() < Date.now();
  }
  if (!createdAt) return false;
  const created = new Date(createdAt).getTime();
  const maxAge = INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() - created > maxAge;
}
