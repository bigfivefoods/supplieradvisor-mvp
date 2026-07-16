/**
 * Lifetime / complimentary company access.
 *
 * - Founder group companies (Big Five + Vuka Fitness)
 * - First 25 companies on the platform (founding partners)
 */

/** Explicit profile IDs known to be founder-owned (production). */
export const FOUNDER_LIFETIME_COMPANY_IDS: number[] = [
  102, // Big Five Foods
  110, // VUKA Fitness
  120, // Big Five Direct
  123, // Big Five Foods Kenya
  124, // Big Five Direct (Pty)
  125, // Big Five Access
];

/**
 * Trading / legal name patterns for founder companies.
 * Matched case-insensitively against trading_name and legal_name.
 */
export const FOUNDER_LIFETIME_NAME_PATTERNS: RegExp[] = [
  /^big\s*five\s*foods/i,
  /^big\s*five\s*direct/i,
  /^big\s*five\s*access/i,
  /^easta?\s*africa\s*big\s*five/i,
  /^vuka(\s+fitness)?$/i,
  /^vuka\s*fitness/i,
];

/** How many earliest companies get free lifetime access. */
export const FOUNDING_FREE_COMPANY_LIMIT = 25;

export const LIFETIME_PLAN = 'lifetime_complimentary';
/** Plan label written for new founding-partner lifetime grants */
export const LIFETIME_PLAN_FOUNDING = 'founding_25';
/** Legacy label from when the founding cohort was 50 */
export const LIFETIME_PLAN_FOUNDING_LEGACY = 'founding_50';
export const LIFETIME_PLAN_FOUNDER = 'founder_lifetime';

export function parseLifetimeCompanyIdsFromEnv(): number[] {
  const raw =
    process.env.LIFETIME_COMPANY_IDS ||
    process.env.NEXT_PUBLIC_LIFETIME_COMPANY_IDS ||
    '';
  if (!raw.trim()) return [];
  return raw
    .split(/[,;\s]+/)
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

export function isFounderLifetimeCompany(opts: {
  id?: number | null;
  tradingName?: string | null;
  legalName?: string | null;
}): boolean {
  const id = opts.id != null ? Number(opts.id) : NaN;
  if (Number.isFinite(id)) {
    if (FOUNDER_LIFETIME_COMPANY_IDS.includes(id)) return true;
    if (parseLifetimeCompanyIdsFromEnv().includes(id)) return true;
  }
  const names = [opts.tradingName, opts.legalName]
    .map((n) => String(n || '').trim())
    .filter(Boolean);
  for (const name of names) {
    for (const re of FOUNDER_LIFETIME_NAME_PATTERNS) {
      if (re.test(name)) return true;
    }
  }
  return false;
}

export function isLifetimePlan(plan: string | null | undefined): boolean {
  const p = String(plan || '').toLowerCase();
  return (
    p === LIFETIME_PLAN ||
    p === LIFETIME_PLAN_FOUNDING ||
    p === LIFETIME_PLAN_FOUNDING_LEGACY ||
    p === LIFETIME_PLAN_FOUNDER ||
    p === 'lifetime' ||
    p === 'complimentary' ||
    p === 'comp'
  );
}

export function isLifetimeStatus(status: string | null | undefined): boolean {
  const s = String(status || '').toLowerCase();
  return s === 'lifetime' || s === 'complimentary' || s === 'comp' || s === 'founding';
}
