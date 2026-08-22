/**
 * Optional Upstash Redis in front of the in-process TTL cache.
 * Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN on Vercel.
 * Misses and missing env fall through to memory — never required.
 */
import { ttlGet, ttlSet } from '@/lib/system/memory-ttl';

const MAX_BYTES = 80_000;

function rest(): { url: string; token: string } | null {
  const url = String(process.env.UPSTASH_REDIS_REST_URL || '').replace(/\/$/, '');
  const token = String(process.env.UPSTASH_REDIS_REST_TOKEN || '');
  if (!url || !token) return null;
  return { url, token };
}

export async function hotGet<T>(key: string): Promise<T | null> {
  const local = ttlGet<T>(key);
  if (local != null) return local;
  const kv = rest();
  if (!kv) return null;
  try {
    const res = await fetch(`${kv.url}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${kv.token}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { result?: string | null };
    if (body.result == null) return null;
    const value = JSON.parse(String(body.result)) as T;
    ttlSet(key, value, 20_000);
    return value;
  } catch {
    return null;
  }
}

export async function hotSet<T>(
  key: string,
  value: T,
  ttlMs: number
): Promise<void> {
  ttlSet(key, value, ttlMs);
  const kv = rest();
  if (!kv) return;
  try {
    const raw = JSON.stringify(value);
    if (raw.length > MAX_BYTES) return;
    const sec = Math.max(1, Math.ceil(ttlMs / 1000));
    await fetch(
      `${kv.url}/set/${encodeURIComponent(key)}/${encodeURIComponent(raw)}/EX/${sec}`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${kv.token}` },
      }
    );
  } catch {
    /* optional */
  }
}
