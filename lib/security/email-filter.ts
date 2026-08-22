/**
 * Emails used in PostgREST .or() / .ilike() filters must not carry
 * commas, wildcards or quotes — those break the filter or widen it.
 */
export function isSafeFilterEmail(raw: string | null | undefined): boolean {
  const s = String(raw || '')
    .trim()
    .toLowerCase();
  if (s.length < 5 || s.length > 120) return false;
  if (/[,%*"'()\\]/.test(s)) return false;
  return /^[a-z0-9._+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/.test(s);
}

export function safeFilterEmails(
  raw: Array<string | null | undefined>
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of raw) {
    const s = String(v || '')
      .trim()
      .toLowerCase();
    if (!isSafeFilterEmail(s) || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}
