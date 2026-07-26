/**
 * Offline drafts for school field ops (serve-day, deliveries, PEU visits).
 * Uses localStorage — restores when online/submit fails.
 */

const PREFIX = 'sa_nsnp_draft_v1:';

export type OfflineDraftMeta = {
  key: string;
  savedAt: string;
  label?: string;
};

function storageKey(scope: string, companyId: number | string, id: string) {
  return `${PREFIX}${scope}:${companyId}:${id}`;
}

export function saveOfflineDraft(
  scope: string,
  companyId: number | string,
  id: string,
  payload: unknown,
  label?: string
): void {
  if (typeof window === 'undefined') return;
  try {
    const key = storageKey(scope, companyId, id);
    const body = {
      payload,
      label,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(key, JSON.stringify(body));
  } catch {
    /* quota / private mode */
  }
}

export function loadOfflineDraft<T = unknown>(
  scope: string,
  companyId: number | string,
  id: string
): { payload: T; savedAt: string; label?: string } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(storageKey(scope, companyId, id));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      payload: T;
      savedAt: string;
      label?: string;
    };
    if (!parsed || parsed.payload == null) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearOfflineDraft(
  scope: string,
  companyId: number | string,
  id: string
): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(storageKey(scope, companyId, id));
  } catch {
    /* soft */
  }
}

export function isBrowserOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine !== false;
}
