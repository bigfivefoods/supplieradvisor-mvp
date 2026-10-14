export type CspViolation = { directive: string; blocked: string };

/** Deployment host such as supplieradvisor-abc-team.vercel.app. */
export function isVercelPreviewBase(baseUrl: string): boolean {
  try {
    const host = new URL(baseUrl).hostname.toLowerCase().replace(/\.$/, '');
    return host.endsWith('.vercel.app');
  } catch {
    return false;
  }
}

/** Vercel preview toolbar script injected on *.vercel.app. */
export function isVercelToolbarScript(blocked: string): boolean {
  try {
    const url = new URL(blocked);
    return url.hostname === 'vercel.live' && url.pathname.includes('/_next-live/feedback/');
  } catch {
    return false;
  }
}

/**
 * Violations that should still fail the smoke.
 * Localhost eval noise stays ignored. The preview toolbar is ignored only on
 * a *.vercel.app base URL. Every other violation is kept.
 */
export function enforcedCspViolations(
  records: CspViolation[],
  options: { hostname: string; baseUrl: string }
): CspViolation[] {
  const isLocal = options.hostname === 'localhost' || options.hostname === '127.0.0.1';
  const ignoreToolbar = isVercelPreviewBase(options.baseUrl);
  return records.filter((violation) => {
    if (isLocal && violation.directive.startsWith('script-src') && violation.blocked === 'eval') {
      return false;
    }
    if (ignoreToolbar && isVercelToolbarScript(violation.blocked)) return false;
    return true;
  });
}
