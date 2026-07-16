/**
 * Simple in-memory sliding window rate limit (per isolate / server instance).
 * Good enough for public endpoints on a single Node process; not a cluster store.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function rateLimit(opts: {
  key: string;
  limit: number;
  /** Window length in ms */
  windowMs: number;
}): { ok: boolean; remaining: number; retryAfterSec: number } {
  const now = Date.now();
  const k = opts.key;
  let b = buckets.get(k);
  if (!b || now >= b.resetAt) {
    b = { count: 0, resetAt: now + opts.windowMs };
    buckets.set(k, b);
  }
  b.count += 1;
  const remaining = Math.max(0, opts.limit - b.count);
  if (b.count > opts.limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)),
    };
  }
  return { ok: true, remaining, retryAfterSec: 0 };
}

/** Best-effort client IP from proxy headers */
export function clientIp(request: {
  headers: { get(name: string): string | null };
}): string {
  const xf = request.headers.get('x-forwarded-for');
  if (xf) return xf.split(',')[0].trim() || 'unknown';
  return request.headers.get('x-real-ip') || 'unknown';
}
