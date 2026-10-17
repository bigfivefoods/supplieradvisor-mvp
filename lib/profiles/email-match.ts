/** Lower-case profile emails at the edge. Stored mixed case is still matched until a backfill exists. */

export function normaliseProfileEmail(raw: string | null | undefined): string {
  return String(raw || '').trim().toLowerCase();
}

/** Equality values: the lower-case form, plus the caller's original casing when it differs. */
export function profileEmailEqValues(raw: string | null | undefined): string[] {
  const trimmed = String(raw || '').trim();
  const lower = trimmed.toLowerCase();
  if (!lower) return [];
  if (trimmed === lower) return [lower];
  return [lower, trimmed];
}

/** Value to persist. Does not read or rewrite other rows. */
export function profileEmailForWrite(
  primary: string | null | undefined,
  fallback?: string | null
): string | null {
  const chosen = normaliseProfileEmail(primary) || normaliseProfileEmail(fallback);
  return chosen || null;
}
