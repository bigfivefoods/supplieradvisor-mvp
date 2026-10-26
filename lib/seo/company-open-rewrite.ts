/**
 * Quote, rate, and referral links may open a company that is not in the
 * public directory. Those requests are rewritten to a dynamic route so the
 * SEO page itself can stay cached.
 */
const OPEN_SOURCES = new Set(['quote', 'rate', 'r']);

export function companyOpenRewritePath(
  pathname: string,
  from: string | null | undefined,
  src: string | null | undefined
): string | null {
  const path = String(pathname || '');
  if (!path.startsWith('/c/')) return null;
  if (path.endsWith('/open') || path.includes('/open/')) return null;
  const reason = String(from || src || '').trim().toLowerCase();
  if (!OPEN_SOURCES.has(reason)) return null;
  const slug = path.slice('/c/'.length).replace(/\/+$/, '');
  if (!slug || slug.includes('/')) return null;
  return `/c/${slug}/open`;
}
