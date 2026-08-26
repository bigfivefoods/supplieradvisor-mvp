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
