/**
 * Onboarding funnel event names and property filters.
 * Events carry a surface, an optional lane, and an optional module id.
 * They never carry names, emails, phone numbers, or company ids.
 */

export const FUNNEL_EVENTS = [
  'landing',
  'sign_up_start',
  'sign_up_complete',
  'trial_start',
  'first_module_enabled',
] as const;

export type FunnelEvent = (typeof FUNNEL_EVENTS)[number];

const PROP_KEYS = new Set(['surface', 'lane', 'module']);
const SAFE_VALUE = /^[a-z0-9_-]{1,40}$/;

export function isFunnelEvent(value: string): value is FunnelEvent {
  return (FUNNEL_EVENTS as readonly string[]).includes(value);
}

export function sanitizeFunnelProps(
  props: Record<string, unknown> | null | undefined
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!props) return out;
  for (const [key, value] of Object.entries(props)) {
    if (!PROP_KEYS.has(key) || typeof value !== 'string') continue;
    const clean = value.trim().toLowerCase();
    if (!SAFE_VALUE.test(clean)) continue;
    out[key] = clean;
  }
  return out;
}

/** The module id when this save turns on the first optional module. */
export function firstOptionalModule(
  previous: Record<string, boolean> | null | undefined,
  next: Record<string, boolean> | null | undefined,
  alwaysOn: (id: string) => boolean
): string | null {
  const wasOn = Object.entries(previous || {}).some(([id, on]) => on === true && !alwaysOn(id));
  if (wasOn) return null;
  const hit = Object.entries(next || {}).find(([id, on]) => on === true && !alwaysOn(id));
  if (!hit) return null;
  const id = hit[0].trim().toLowerCase();
  return SAFE_VALUE.test(id) ? id : null;
}
