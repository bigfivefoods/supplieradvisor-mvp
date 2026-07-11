/**
 * Lightweight in-memory sliding-window rate limit for API routes.
 * Soft per-instance (Vercel serverless) — good enough for abuse dampening.
 * For multi-instance hard limits, use Redis/Upstash later.
 */

type Bucket = { timestamps: number[] };

const store = new Map<string, Bucket>();

const CLEAN_EVERY = 200;
let ops = 0;

function prune(bucket: Bucket, windowMs: number, now: number) {
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);
}

/**
 * @returns ok false + retryAfterSeconds when over limit
 */
export function checkRateLimit(opts: {
  key: string;
  limit: number;
  windowMs: number;
}): { ok: true } | { ok: false; retryAfterSeconds: number; remaining: 0 } {
  const now = Date.now();
  ops += 1;
  if (ops % CLEAN_EVERY === 0) {
    for (const [k, b] of store) {
      prune(b, opts.windowMs * 2, now);
      if (!b.timestamps.length) store.delete(k);
    }
  }

  let bucket = store.get(opts.key);
  if (!bucket) {
    bucket = { timestamps: [] };
    store.set(opts.key, bucket);
  }
  prune(bucket, opts.windowMs, now);

  if (bucket.timestamps.length >= opts.limit) {
    const oldest = bucket.timestamps[0] || now;
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((oldest + opts.windowMs - now) / 1000)
    );
    return { ok: false, retryAfterSeconds, remaining: 0 };
  }

  bucket.timestamps.push(now);
  return { ok: true };
}

/** Standard API response helper */
export function rateLimitResponse(retryAfterSeconds: number) {
  return {
    body: {
      error: 'Too many requests. Please try again shortly.',
      code: 'RATE_LIMITED',
      retryAfterSeconds,
    },
    status: 429 as const,
    headers: { 'Retry-After': String(retryAfterSeconds) },
  };
}
