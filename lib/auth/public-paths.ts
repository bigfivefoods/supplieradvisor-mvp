/**
 * Pure path helpers — safe for Edge middleware (no Node/supabase imports).
 */

export const PUBLIC_API_PREFIXES = [
  '/api/public/',
  '/api/fx/rates',
  '/api/system/apple-pay-domain-status',
  '/api/invites/validate',
  '/api/banking/webhooks/',
  '/api/paystack/webhook',
  '/api/billing/webhook',
  '/api/public/marketplace-listings',
  '/api/inventory/products/public',
  '/api/geo',
  // join claim/profile are under /api/public/ already
  // Note: GET /api/sam/chat health is allowed in middleware by method check
] as const;

/** Public readiness / smoke endpoints (no Privy) — keep in sync with middleware. */
const PUBLIC_EXACT = new Set([
  '/api/health',
  '/api/system/health',
  '/api/csp-report',
  '/api/insights/collect',
  '/api/system/apple-pay-domain-status',
  '/api/fx/rates',
  '/api/invites/validate',
  '/api/paystack/webhook',
  '/api/billing/webhook',
]);

/**
 * Signed-out sample pages. Page prefixes only — never an API prefix.
 * Middleware already leaves non-dashboard pages open; this helper is the
 * explicit allow-list and must not make any /api route public.
 */
export const PUBLIC_PAGE_PREFIXES = [
  '/preview/constructiongraph',
  '/preview/fleetgraph',
] as const;

export function isPublicPagePath(pathname: string): boolean {
  const p = pathname.split('?')[0] || pathname;
  if (p === '/api' || p.startsWith('/api/')) return false;
  return PUBLIC_PAGE_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`));
}

export function isPublicApiPath(pathname: string): boolean {
  const p = pathname.split('?')[0] || pathname;
  if (PUBLIC_EXACT.has(p)) return true;
  if (p === '/api/geo' || p.startsWith('/api/geo/')) return true;
  // Provider webhooks (Paystack, banking, etc.) — never require Privy
  if (p.includes('/webhook')) return true;
  return PUBLIC_API_PREFIXES.some(
    (prefix) => p === prefix.replace(/\/$/, '') || p.startsWith(prefix)
  );
}
