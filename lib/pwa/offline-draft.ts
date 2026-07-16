/**
 * Client-side offline draft store (localStorage).
 * Used by field forms (e.g. reseller RIAD) when the network is unavailable.
 */

const PREFIX = 'sa_offline_draft_';

export function saveOfflineDraft<T>(key: string, value: T): void {
  try {
    localStorage.setItem(
      `${PREFIX}${key}`,
      JSON.stringify({ savedAt: Date.now(), value })
    );
  } catch {
    /* private mode / quota */
  }
}

export function loadOfflineDraft<T>(key: string): { savedAt: number; value: T } | null {
  try {
    const raw = localStorage.getItem(`${PREFIX}${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt?: number; value?: T };
    if (!parsed || parsed.value === undefined) return null;
    return { savedAt: Number(parsed.savedAt) || Date.now(), value: parsed.value };
  } catch {
    return null;
  }
}

export function clearOfflineDraft(key: string): void {
  try {
    localStorage.removeItem(`${PREFIX}${key}`);
  } catch {
    /* ignore */
  }
}

export function isBrowserOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine !== false;
}
