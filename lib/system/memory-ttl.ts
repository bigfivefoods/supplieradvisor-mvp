/**
 * Process-local TTL cache for hot read paths (learned GL patterns, care sync).
 * Safe to miss on cold start / multi-instance — never a source of truth.
 */

type Entry<T> = { value: T; exp: number };

const store = new Map<string, Entry<unknown>>();
const MAX = 4000;

function prune(now: number) {
  if (store.size <= MAX) return;
  for (const [k, v] of store) {
    if (v.exp < now) store.delete(k);
  }
  while (store.size > MAX) {
    const first = store.keys().next().value;
    if (first == null) break;
    store.delete(first);
  }
}

export function ttlGet<T>(key: string): T | null {
  const row = store.get(key);
  if (!row) return null;
  if (row.exp < Date.now()) {
    store.delete(key);
    return null;
  }
  return row.value as T;
}

export function ttlSet<T>(key: string, value: T, ttlMs: number): void {
  const now = Date.now();
  prune(now);
  store.set(key, { value, exp: now + Math.max(1_000, ttlMs) });
}

export function ttlDel(keyOrPrefix: string): void {
  store.delete(keyOrPrefix);
  const prefix = keyOrPrefix.endsWith(':')
    ? keyOrPrefix
    : `${keyOrPrefix}:`;
  for (const k of [...store.keys()]) {
    if (k.startsWith(prefix)) store.delete(k);
  }
}

const inflight = new Map<string, Promise<unknown>>();

/**
 * Process-local get-or-load with single-flight. Concurrent callers share one
 * loader so dashboard + ops + intel + accounting do not stampede the same rows.
 */
export async function ttlGetOrLoad<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>
): Promise<T> {
  const hit = ttlGet<T>(key);
  if (hit !== null) return hit;
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const pending = (async () => {
    try {
      const value = await load();
      ttlSet(key, value, ttlMs);
      return value;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, pending);
  return pending;
}
