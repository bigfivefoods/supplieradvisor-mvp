/**
 * Google/Apple OAuth from a gym PWA (scope /) used to fail:
 * Privy treats standalone WebAPKs as in-app browsers, and ?link= on /me
 * is not an allowed OAuth redirect. Stash extras, strip the URL, complete
 * on a clean path, then restore.
 */
export const SA_OAUTH_RETURN_KEY = 'sa_oauth_return';

const STASH_KEYS = [
  'link',
  'token',
  'next',
  'brand',
  'join',
  'company',
  'kind',
  'tab',
  'module',
  'pwa',
] as const;

export function isPrivyOauthCallback(search?: string | null): boolean {
  const q = new URLSearchParams(search || (typeof window === 'undefined' ? '' : window.location.search));
  return Boolean(q.get('privy_oauth_code') && q.get('privy_oauth_state'));
}

export function stashOauthReturnParams(search?: string | null): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const q = new URLSearchParams(
    search ?? window.location.search.replace(/^\?/, '')
  );
  const stash: Record<string, string> = {};
  for (const k of STASH_KEYS) {
    const v = q.get(k);
    if (v) stash[k] = v;
  }
  if (Object.keys(stash).length) {
    try {
      sessionStorage.setItem(SA_OAUTH_RETURN_KEY, JSON.stringify(stash));
    } catch {
      /* private mode */
    }
  }
  return stash;
}

function readOauthReturnParams(remove: boolean): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = sessionStorage.getItem(SA_OAUTH_RETURN_KEY);
    if (!raw) return {};
    if (remove) sessionStorage.removeItem(SA_OAUTH_RETURN_KEY);
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'string' && v) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export function peekOauthReturnParams(): Record<string, string> {
  return readOauthReturnParams(false);
}

export function takeOauthReturnParams(): Record<string, string> {
  return readOauthReturnParams(true);
}

/** Drop query/hash so Privy redirect_to is an exact origin+path match. */
export function stripUrlForOauthRedirect(): void {
  if (typeof window === 'undefined') return;
  if (isPrivyOauthCallback()) return;
  stashOauthReturnParams();
  const url = new URL(window.location.href);
  if (!url.search && !url.hash) return;
  window.history.replaceState({}, '', url.pathname);
}

/** Path + stashed join/link params so Chrome continues the same advisor app flow. */
export function oauthContinuePath(): string {
  if (typeof window === 'undefined') return '/me';
  const stash = peekOauthReturnParams();
  const url = new URL(window.location.href);
  for (const [k, v] of Object.entries(stash)) {
    if (v) url.searchParams.set(k, v);
  }
  return `${url.pathname}${url.search}` || '/me';
}

/** Put stashed query back after a failed OAuth attempt so join=1 is not lost. */
export function restoreStashedOauthSearch(): string {
  if (typeof window === 'undefined') return '';
  const next = oauthContinuePath();
  const now = `${window.location.pathname}${window.location.search}`;
  if (next && next !== now) {
    window.history.replaceState({}, '', next);
  }
  return next;
}

export function standaloneOauthContinueMessage(
  provider: 'google' | 'apple' | string,
  appName?: string | null
): string {
  const label = provider === 'apple' ? 'Apple' : 'Google';
  const who = String(appName || '').trim() || 'this app';
  const ios =
    typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (ios) {
    return `${label} isn’t available inside the installed ${who} app. Use email on this screen.`;
  }
  return `${label} needs Chrome from the installed app. We opened it — come back to ${who} after you sign in. Email also works on this screen.`;
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

export function isInAppBrowserOauthError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err || '');
  return /in-app browser|external browser|not allowed/i.test(msg);
}

/** Leave a WebAPK / standalone PWA so Google will accept the login. */
export function openInSystemBrowser(pathAndQuery: string): boolean {
  if (typeof window === 'undefined') return false;
  let abs: string;
  try {
    abs = new URL(pathAndQuery, window.location.origin).toString();
  } catch {
    return false;
  }
  const ua = navigator.userAgent || '';
  if (/Android/i.test(ua)) {
    const hostPath = abs.replace(/^https?:\/\//, '');
    window.location.href =
      `intent://${hostPath}#Intent;scheme=https;package=com.android.chrome;` +
      `S.browser_fallback_url=${encodeURIComponent(abs)};end`;
    return true;
  }
  const a = document.createElement('a');
  a.href = abs;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  a.remove();
  return true;
}
