/**
 * Canonical public host for SupplierAdvisor®.
 * app.supplieradvisor.com is not a second origin: login cookies are host-only,
 * sitemap and mail links use www, and Privy allowed origins are not set here.
 */

export const APP_HOST = 'app.supplieradvisor.com';
export const CANONICAL_HOST = 'www.supplieradvisor.com';
export const CANONICAL_ORIGIN = `https://${CANONICAL_HOST}`;

/** Host header, or host:port, without a spoofed second value. */
export function hostnameFromHostHeader(hostHeader: string | null | undefined): string {
  const raw = String(hostHeader || '')
    .split(',')[0]
    .trim()
    .toLowerCase();
  if (!raw || raw.startsWith('[')) return raw;
  return raw.replace(/:\d+$/, '').replace(/\.$/, '');
}

function safePath(pathname: string): string {
  if (!pathname.startsWith('/') || pathname.startsWith('//') || pathname.includes('\\') || pathname.includes('://')) {
    return '/';
  }
  return pathname;
}

function safeSearch(search: string): string {
  if (!search) return '';
  const qs = search.startsWith('?') ? search : `?${search}`;
  // Drop header-breaking characters. A query may still contain an encoded URL.
  if (/[\u0000-\u001f\u007f\\]/.test(qs)) return '';
  return qs;
}

/**
 * Absolute www URL when the request host is exactly the app host.
 * Path and query are preserved. Returns null for every other host.
 */
export function canonicalRedirectForAppHost(
  hostHeader: string | null | undefined,
  pathname: string,
  search = ''
): string | null {
  if (hostnameFromHostHeader(hostHeader) !== APP_HOST) return null;
  return `${CANONICAL_ORIGIN}${safePath(pathname)}${safeSearch(search)}`;
}
