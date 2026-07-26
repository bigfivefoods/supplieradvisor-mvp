/**
 * Privacy helpers for learner-facing displays (POPIA-friendly).
 */

export function maskName(
  first?: string | null,
  last?: string | null,
  privacyMode = false
): string {
  const f = String(first || '').trim();
  const l = String(last || '').trim();
  if (!privacyMode) {
    return [f, l].filter(Boolean).join(' ') || '—';
  }
  const fi = f ? `${f[0].toUpperCase()}.` : '';
  const li = l ? `${l[0].toUpperCase()}.` : '';
  return [fi, li].filter(Boolean).join(' ') || 'Learner';
}

export function privacyEnabled(
  school?: { metadata?: unknown; privacy_mode?: boolean | null } | null
): boolean {
  if (school?.privacy_mode === true) return true;
  const meta =
    school?.metadata && typeof school.metadata === 'object'
      ? (school.metadata as Record<string, unknown>)
      : {};
  return meta.privacy_mode === true || meta.privacyMode === true;
}
