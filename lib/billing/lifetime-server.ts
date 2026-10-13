/**
 * Server-only founding-cohort reads and grants.
 * Import this from route handlers, not from client components.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  FOUNDING_FREE_COMPANY_LIMIT,
  isFounderLifetimeCompany,
  isLifetimePlan,
  isLifetimeStatus,
  LIFETIME_PLAN_FOUNDER,
  LIFETIME_PLAN_FOUNDING,
} from '@/lib/billing/lifetime';

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
