/**
 * Pure path helpers — safe for Edge middleware (no Node/supabase imports).
 */

export const PUBLIC_API_PREFIXES = [
  '/api/public/',
  '/api/fx/rates',
  '/api/system/health',
  '/api/system/trade-loop-smoke',
  '/api/system/settle-smoke',
  '/api/invites/validate',
  '/api/banking/webhooks/',
  '/api/paystack/webhook',
  '/api/public/marketplace-listings',
  '/api/inventory/products/public',
  '/api/geo',
  // join claim/profile are under /api/public/ already
  // Note: GET /api/sam/chat health is allowed in middleware by method check
] as const;

/** Public readiness / smoke endpoints (no Privy) — keep in sync with middleware. */
const PUBLIC_EXACT = new Set([
  '/api/system/health',
  '/api/system/trade-loop-smoke',
  '/api/system/settle-smoke',
  '/api/fx/rates',
  '/api/invites/validate',
  '/api/paystack/webhook',
]);

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
