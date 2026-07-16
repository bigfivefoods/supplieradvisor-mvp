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

/**
 * How many founding free seats remain (first N companies by created_at).
 * Companies already past the earliest N do not consume a "remaining" seat
 * for display; remaining = max(0, limit - min(usedAmongEarliest, limit)).
 */
export async function getFoundingSlotPulse(): Promise<{
  limit: number;
  used: number;
  remaining: number;
  full: boolean;
  earliestIds: number[];
}> {
  const { getSupabaseServer } = await import('@/lib/supabase/server-client');
  const supabase = getSupabaseServer();
  const limit = FOUNDING_FREE_COMPANY_LIMIT;
  // Prefer non-deleted companies when column exists
  let earliest: { id: number }[] | null = null;
  let error: { message: string } | null = null;
  {
    const q = await supabase
      .from('profiles')
      .select('id')
      .not('trading_name', 'is', null)
      .is('deleted_at', null)
      .order('created_at', { ascending: true, nullsFirst: false })
      .order('id', { ascending: true })
      .limit(limit);
    if (q.error && /deleted_at|column|schema cache/i.test(q.error.message)) {
      const retry = await supabase
        .from('profiles')
        .select('id')
        .not('trading_name', 'is', null)
        .order('created_at', { ascending: true, nullsFirst: false })
        .order('id', { ascending: true })
        .limit(limit);
      earliest = retry.data;
      error = retry.error;
    } else {
      earliest = q.data;
      error = q.error;
    }
  }

  if (error) {
    // Fallback: total profile count vs limit (legacy ops display)
    const { count } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .not('trading_name', 'is', null);
    const used = Math.min(limit, count ?? 0);
    return {
      limit,
      used,
      remaining: Math.max(0, limit - used),
      full: used >= limit,
      earliestIds: [],
    };
  }

  const earliestIds = (earliest || []).map((r) => Number(r.id));
  const used = earliestIds.length;
  return {
    limit,
    used,
    remaining: Math.max(0, limit - used),
    full: used >= limit,
    earliestIds,
  };
}

/** True when company is among the earliest founding cohort by registration order. */
export async function isInFoundingCohort(companyId: number): Promise<boolean> {
  const pulse = await getFoundingSlotPulse();
  return pulse.earliestIds.includes(Number(companyId));
}

/**
 * Write lifetime founding plan on a profile (ops convert or auto-grant).
 * Idempotent if already lifetime.
 */
export async function grantFoundingLifetimeAccess(
  companyId: number,
  opts?: { plan?: string; reason?: string }
): Promise<{
  ok: boolean;
  granted: boolean;
  error?: string;
  plan?: string;
}> {
  const { getSupabaseServer } = await import('@/lib/supabase/server-client');
  const supabase = getSupabaseServer();
  const { data: row, error: loadErr } = await supabase
    .from('profiles')
    .select(
      'id, trading_name, legal_name, subscription_status, subscription_plan, subscription_starts_at, created_at'
    )
    .eq('id', companyId)
    .maybeSingle();

  if (loadErr) return { ok: false, granted: false, error: loadErr.message };
  if (!row) return { ok: false, granted: false, error: 'Company not found' };

  if (
    isLifetimeStatus(row.subscription_status) ||
    isLifetimePlan(row.subscription_plan)
  ) {
    return {
      ok: true,
      granted: false,
      plan: String(row.subscription_plan || 'lifetime'),
    };
  }

  const founder = isFounderLifetimeCompany({
    id: companyId,
    tradingName: row.trading_name,
    legalName: row.legal_name,
  });
  const plan =
    opts?.plan ||
    (founder ? LIFETIME_PLAN_FOUNDER : LIFETIME_PLAN_FOUNDING);
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('profiles')
    .update({
      subscription_status: 'lifetime',
      subscription_plan: plan,
      subscription_amount_zar: 0,
      subscription_starts_at:
        row.subscription_starts_at || row.created_at || now,
      subscription_ends_at: null,
    })
    .eq('id', companyId);

  if (error) return { ok: false, granted: false, error: error.message };
  return { ok: true, granted: true, plan };
}
