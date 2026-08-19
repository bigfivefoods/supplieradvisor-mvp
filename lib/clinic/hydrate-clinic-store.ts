/**
 * Copy persisted clinic arrays onto an empty store.
 * Empty-store key loops used to skip visit_notes / treatment_plans /
 * waitlist_queue, so appointment notes looked unsaved after reload.
 */
export function copyStoredClinicArrays<T extends object>(
  empty: T,
  stored: Record<string, unknown> | null | undefined
): T {
  const e: Record<string, unknown> = { ...(empty as Record<string, unknown>) };
  const src =
    stored && typeof stored === 'object' && !Array.isArray(stored)
      ? stored
      : {};
  const keys = new Set([...Object.keys(e), ...Object.keys(src)]);
  for (const key of keys) {
    if (key === 'settings' || key === 'updated_at') continue;
    const v = src[key];
    if (Array.isArray(v)) {
      e[key] = v;
    } else if (Array.isArray(e[key])) {
      e[key] = [];
    }
  }
  return e as T;
}
