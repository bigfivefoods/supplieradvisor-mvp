/**
 * Decide whether /login should mount the Privy SDK before a sign-in click.
 * Existing sessions and OAuth returns still need Privy so the redirect stays
 * the same. Anonymous visits must not import the SDK.
 *
 * Cookie and storage names match the Privy client (privy-token,
 * privy-${id}-token, privy:token, privy:${id}:token, and the refresh / id /
 * session variants) plus the app's sa_authed hint. This module does not
 * import Privy.
 */

const PRIVY_COOKIE_RE = /^privy(?:-.+)?-(?:token|session|refresh-token|id-token)$/;
const PRIVY_STORAGE_KEY_RE = /^privy:(?:.+:)?(?:token|pat|refresh_token|id-token)$/;

export function cookieHeaderIndicatesPrivySession(cookieHeader: string): boolean {
  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf('=');
    const name = (eq === -1 ? trimmed : trimmed.slice(0, eq)).trim();
    const value = (eq === -1 ? '' : trimmed.slice(eq + 1)).trim();
    if (!name || !value) continue;
    if (name === 'sa_authed' && value === '1') return true;
    if (PRIVY_COOKIE_RE.test(name)) return true;
  }
  return false;
}

export function searchIndicatesPrivyOauth(search: string): boolean {
  const raw = search.startsWith('?') ? search.slice(1) : search;
  const q = new URLSearchParams(raw);
  return Boolean(q.get('privy_oauth_code') || q.get('privy_oauth_state'));
}

export function storageKeyIndicatesPrivySession(key: string): boolean {
  return key === 'privy:active-user' || PRIVY_STORAGE_KEY_RE.test(key);
}

/** Browser-only. False during SSR so the login shell does not hydrate Privy. */
export function clientShouldLoadPrivyImmediately(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (searchIndicatesPrivyOauth(window.location.search || '')) return true;
    if (cookieHeaderIndicatesPrivySession(document.cookie || '')) return true;
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && storageKeyIndicatesPrivySession(key)) return true;
    }
  } catch {
    return false;
  }
  return false;
}
