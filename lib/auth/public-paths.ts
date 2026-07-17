/**
 * Pure path helpers — safe for Edge middleware (no Node/supabase imports).
 */

export const PUBLIC_API_PREFIXES = [
  '/api/public/',
  '/api/fx/rates',
  '/api/system/health',
  '/api/system/trade-loop-smoke',
  '/api/invites/validate',
  '/api/banking/webhooks/',
  '/api/inventory/products/public',
  '/api/geo',
  // join claim/profile are under /api/public/ already
  // Note: GET /api/sam/chat health is allowed in middleware by method check
] as const;

export function isPublicApiPath(pathname: string): boolean {
  const p = pathname.split('?')[0] || pathname;
  if (
    p === '/api/system/health' ||
    p === '/api/system/trade-loop-smoke' ||
    p === '/api/fx/rates'
  ) {
    return true;
  }
  if (p === '/api/invites/validate') return true;
  if (p === '/api/geo' || p.startsWith('/api/geo/')) return true;
  return PUBLIC_API_PREFIXES.some(
    (prefix) => p === prefix.replace(/\/$/, '') || p.startsWith(prefix)
  );
}
