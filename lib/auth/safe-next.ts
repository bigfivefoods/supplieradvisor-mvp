/**
 * Post-login `next` targets: same-site relative paths only (no open redirect).
 *
 * Accepts "/dashboard/select-company?company=102". Rejects absolute URLs ("https://evil"),
 * protocol-relative ("//evil", "/\\evil"), schemes ("javascript:"), control characters and
 * anything that resolves to another origin. Returns '' when the value is not safe.
 */
const PROBE_ORIGIN = 'https://sa.invalid';

export function safeNextPath(raw: string | null | undefined): string {
  if (typeof raw !== 'string') return '';
  const value = raw.trim();
  if (!value || value.length > 2048) return '';
  if (!value.startsWith('/')) return '';
  // "//host" and "/\host" are treated as protocol-relative by browsers
  if (value.startsWith('//') || value.startsWith('/\\')) return '';
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return '';
  let url: URL;
  try {
    url = new URL(value, PROBE_ORIGIN);
  } catch {
    return '';
  }
  if (url.origin !== PROBE_ORIGIN) return '';
  return `${url.pathname}${url.search}${url.hash}`;
}
