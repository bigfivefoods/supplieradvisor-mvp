/**
 * In-memory desk store cache.
 * Gym/clinic/hire pages each used to refetch the full JSON blob on every
 * click. Same-tab navigation reuses the last payload; stale-while-revalidate
 * keeps the UI instant and still fresh.
 */
'use client';

const TTL_MS = 45_000;

type Entry = { at: number; payload: unknown };

const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();

function key(kind: string, companyId: number): string {
  return `${kind}:${companyId}`;
}

if (typeof window !== 'undefined') {
  window.addEventListener('sa:company-changed', () => {
    cache.clear();
    inflight.clear();
  });
}

export function peekAdvisorDeskCache<T>(
  kind: string,
  companyId: number
): T | null {
  const hit = cache.get(key(kind, companyId));
  if (!hit) return null;
  return hit.payload as T;
}

export function advisorDeskCacheFresh(kind: string, companyId: number): boolean {
  const hit = cache.get(key(kind, companyId));
  return Boolean(hit && Date.now() - hit.at < TTL_MS);
}

export function rememberAdvisorDeskCache(
  kind: string,
  companyId: number,
  payload: unknown
): void {
  cache.set(key(kind, companyId), { at: Date.now(), payload });
}

export function invalidateAdvisorDeskCache(
  kind?: string,
  companyId?: number
): void {
  if (kind && companyId) {
    cache.delete(key(kind, companyId));
    return;
  }
  if (kind) {
    for (const k of [...cache.keys()]) {
      if (k.startsWith(`${kind}:`)) cache.delete(k);
    }
    return;
  }
  cache.clear();
}

export async function hydrateAdvisorDesk<T>(
  kind: string,
  companyId: number,
  url: string,
  apply: (data: T) => void,
  setLoading: (v: boolean) => void,
  opts?: { force?: boolean }
): Promise<void> {
  const cached = peekAdvisorDeskCache<T>(kind, companyId);
  if (cached && !opts?.force) {
    apply(cached);
    setLoading(false);
    if (advisorDeskCacheFresh(kind, companyId)) return;
    try {
      apply(
        await fetchAdvisorDeskJson<T>(kind, companyId, url, { force: true })
      );
    } catch {
      /* keep last good paint */
    }
    return;
  }
  setLoading(true);
  try {
    apply(await fetchAdvisorDeskJson<T>(kind, companyId, url, opts));
  } finally {
    setLoading(false);
  }
}

export async function fetchAdvisorDeskJson<T>(
  kind: string,
  companyId: number,
  url: string,
  opts?: { force?: boolean }
): Promise<T> {
  const k = key(kind, companyId);
  if (!opts?.force) {
    const hit = cache.get(k);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.payload as T;
    const pending = inflight.get(k);
    if (pending) return pending as Promise<T>;
  }

  const run = (async () => {
    const res = await fetch(url, { credentials: 'same-origin' });
    const data = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) {
      throw new Error(data.error || 'Load failed');
    }
    cache.set(k, { at: Date.now(), payload: data });
    return data;
  })();

  inflight.set(k, run);
  try {
    return await run;
  } finally {
    if (inflight.get(k) === run) inflight.delete(k);
  }
}
