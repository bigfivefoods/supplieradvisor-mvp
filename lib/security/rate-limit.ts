/**
 * Simple in-memory sliding window rate limit (per isolate / server instance).
 * Good enough for public endpoints on a single Node process; not a cluster store.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 4000;
let lastPruneAt = 0;

function pruneBuckets(now: number) {
  if (now - lastPruneAt < 30_000 && buckets.size < MAX_BUCKETS) return;
  lastPruneAt = now;
  for (const [k, b] of buckets) {
    if (now >= b.resetAt) buckets.delete(k);
  }
  if (buckets.size > MAX_BUCKETS) {
    const extra = buckets.size - MAX_BUCKETS;
    let dropped = 0;
    for (const k of buckets.keys()) {
      buckets.delete(k);
      dropped += 1;
      if (dropped >= extra) break;
    }
  }
}

export function rateLimit(opts: {
  key: string;
  limit: number;
  /** Window length in ms */
  windowMs: number;
}): { ok: boolean; remaining: number; retryAfterSec: number } {
  const now = Date.now();
  pruneBuckets(now);
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

/** Public GET/read limiter. */
export function publicReadLimit(
  request: { headers: { get(name: string): string | null } },
  name: string,
  limit = 60
): { ok: boolean; remaining: number; retryAfterSec: number } {
  return rateLimit({
    key: `${name}:${clientIp(request)}`,
    limit,
    windowMs: 60_000,
  });
}

/** Best-effort client IP from proxy headers */
export function clientIp(request: {
  headers: { get(name: string): string | null };
}): string {
  const xf = request.headers.get('x-forwarded-for');
  if (xf) return xf.split(',')[0].trim() || 'unknown';
  return request.headers.get('x-real-ip') || 'unknown';
}
