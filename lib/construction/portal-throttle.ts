/**
 * Durable ConstructionAdvisor® portal guess counter.
 * Missing table or function (migration not applied yet) is reported once
 * per process. Any other database error fails closed.
 */

const MISSING_CODES = new Set(['42P01', '42883', 'PGRST202']);

let warned = false;

export function resetPortalThrottleWarning(): void {
  warned = false;
}

export function portalThrottleWarningSeen(): boolean {
  return warned;
}

export function noteThrottleUnavailable(): void {
  if (warned) return;
  warned = true;
  console.warn('constructiongraph_portal_throttle_unavailable');
}

export function throttleErrorKind(
  error: { code?: string | null } | null | undefined
): 'missing' | 'closed' | null {
  if (!error) return null;
  if (MISSING_CODES.has(String(error.code || ''))) return 'missing';
  return 'closed';
}
