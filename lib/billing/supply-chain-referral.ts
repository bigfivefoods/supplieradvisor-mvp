/**
 * Supply-chain referral fees — 3 levels deep, max 10% total of the paid amount.
 *
 * This is a company-to-company platform / supply-chain referral share on
 * subscription payments — NOT sales-contractor product MLM (those remain
 * personal-sales-only).
 *
 * Default split of subscription revenue:
 *   Level 1 (direct inviter): 5%
 *   Level 2: 3%
 *   Level 3: 2%
 *   Total: 10%
 */

import { getSupabaseServer } from '@/lib/supabase/server-client';

export const REFERRAL_MAX_LEVELS = 3;
/** Hard cap across all levels combined */
export const REFERRAL_TOTAL_CAP_PCT = 10;

export const REFERRAL_LEVEL_RATES_PCT: readonly [number, number, number] = [
  5, // L1
  3, // L2
  2, // L3
];

export type ReferralLevelPayout = {
  level: 1 | 2 | 3;
  earnerProfileId: number;
  ratePct: number;
  commissionZar: number;
};

export function referralRatesSummary(): string {
  return `L1 ${REFERRAL_LEVEL_RATES_PCT[0]}% · L2 ${REFERRAL_LEVEL_RATES_PCT[1]}% · L3 ${REFERRAL_LEVEL_RATES_PCT[2]}% (max ${REFERRAL_TOTAL_CAP_PCT}% total)`;
}

/** Walk referred_by_profile_id up to 3 parents (closest = level 1). */
export async function resolveReferralChain(
  sourceProfileId: number
): Promise<Array<{ level: 1 | 2 | 3; profileId: number }>> {
  const supabase = getSupabaseServer();
  const chain: Array<{ level: 1 | 2 | 3; profileId: number }> = [];
  let currentId: number | null = sourceProfileId;
  const seen = new Set<number>([sourceProfileId]);

  for (let level = 1; level <= REFERRAL_MAX_LEVELS; level++) {
    if (currentId == null) break;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res: { data: any; error: any } = await supabase
      .from('profiles')
      .select('id, referred_by_profile_id')
      .eq('id', currentId)
      .maybeSingle();

    if (res.error || !res.data) break;
    const rawParent: unknown = res.data.referred_by_profile_id;
    const parentNum = Number(rawParent);
    const parentId: number | null =
      rawParent != null && Number.isFinite(parentNum) && parentNum > 0
        ? parentNum
        : null;
    if (parentId == null) break;
    if (seen.has(parentId)) break; // cycle guard
    seen.add(parentId);
    chain.push({ level: level as 1 | 2 | 3, profileId: parentId });
    currentId = parentId;
  }

  return chain;
}

export function computeLevelPayouts(
  baseAmountZar: number,
  chain: Array<{ level: 1 | 2 | 3; profileId: number }>
): ReferralLevelPayout[] {
  const base = Math.max(0, Number(baseAmountZar) || 0);
  const out: ReferralLevelPayout[] = [];
  let usedPct = 0;

  for (const node of chain) {
    const idx = node.level - 1;
    let rate = REFERRAL_LEVEL_RATES_PCT[idx] ?? 0;
    if (usedPct + rate > REFERRAL_TOTAL_CAP_PCT) {
      rate = Math.max(0, REFERRAL_TOTAL_CAP_PCT - usedPct);
    }
    if (rate <= 0) continue;
    usedPct += rate;
    const commissionZar =
      Math.round(((base * rate) / 100) * 100) / 100;
    if (commissionZar <= 0) continue;
    out.push({
      level: node.level,
      earnerProfileId: node.profileId,
      ratePct: rate,
      commissionZar,
    });
  }

  return out;
}

/**
 * Credit L1–L3 earners when a company pays a subscription.
 * Idempotent on source_ref + level + earner.
 */
export async function creditSubscriptionReferralFees(opts: {
  sourceProfileId: number;
  baseAmountZar: number;
  sourceRef: string;
  termLabel?: string | null;
  months?: number | null;
}): Promise<{
  ok: true;
  payouts: ReferralLevelPayout[];
  inserted: number;
} | { ok: false; error: string }> {
  const base = Math.max(0, Number(opts.baseAmountZar) || 0);
  const sourceRef = String(opts.sourceRef || '').trim();
  if (!base || !sourceRef) {
    return { ok: true, payouts: [], inserted: 0 };
  }

  try {
    const chain = await resolveReferralChain(opts.sourceProfileId);
    if (!chain.length) {
      return { ok: true, payouts: [], inserted: 0 };
    }

    const payouts = computeLevelPayouts(base, chain);
    if (!payouts.length) {
      return { ok: true, payouts: [], inserted: 0 };
    }

    const supabase = getSupabaseServer();
    const now = new Date().toISOString();
    const directParent = chain.find((c) => c.level === 1)?.profileId ?? null;
    let inserted = 0;

    for (const p of payouts) {
      const row = {
        earner_profile_id: p.earnerProfileId,
        source_profile_id: opts.sourceProfileId,
        referrer_profile_id: directParent,
        level: p.level,
        rate_pct: p.ratePct,
        base_amount_zar: base,
        commission_amount_zar: p.commissionZar,
        currency: 'ZAR',
        source_type: 'company_subscription',
        source_ref: sourceRef,
        status: 'approved',
        notes: opts.termLabel
          ? `Subscription ${opts.termLabel}${opts.months ? ` · ${opts.months} mo` : ''}`
          : 'Company subscription payment',
        metadata: {
          term_label: opts.termLabel || null,
          months: opts.months ?? null,
          rates: [...REFERRAL_LEVEL_RATES_PCT],
          total_cap_pct: REFERRAL_TOTAL_CAP_PCT,
        },
        created_at: now,
        updated_at: now,
      };

      // Idempotent: skip if this pay ref + level + earner already credited
      const { data: existing } = await supabase
        .from('supply_chain_referral_earnings')
        .select('id')
        .eq('source_ref', sourceRef)
        .eq('level', p.level)
        .eq('earner_profile_id', p.earnerProfileId)
        .maybeSingle();
      if (existing?.id) continue;

      const { error } = await supabase
        .from('supply_chain_referral_earnings')
        .insert(row);

      if (error) {
        if (!/duplicate|unique/i.test(error.message)) {
          console.error('referral insert:', error.message);
        }
      } else {
        inserted += 1;
      }
    }

    return { ok: true, payouts, inserted };
  } catch (e: unknown) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Referral credit failed',
    };
  }
}

export async function getReferralSummary(earnerProfileId: number): Promise<{
  pendingZar: number;
  approvedZar: number;
  paidZar: number;
  totalZar: number;
  directReferrals: number;
  recent: Array<Record<string, unknown>>;
  rates: typeof REFERRAL_LEVEL_RATES_PCT;
  totalCapPct: number;
}> {
  const empty = {
    pendingZar: 0,
    approvedZar: 0,
    paidZar: 0,
    totalZar: 0,
    directReferrals: 0,
    recent: [] as Array<Record<string, unknown>>,
    rates: REFERRAL_LEVEL_RATES_PCT,
    totalCapPct: REFERRAL_TOTAL_CAP_PCT,
  };

  try {
    const supabase = getSupabaseServer();
    const { data: rows, error } = await supabase
      .from('supply_chain_referral_earnings')
      .select('*')
      .eq('earner_profile_id', earnerProfileId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      if (/relation|does not exist/i.test(error.message)) return empty;
      console.error('getReferralSummary:', error.message);
      return empty;
    }

    let pendingZar = 0;
    let approvedZar = 0;
    let paidZar = 0;
    for (const r of rows || []) {
      const amt = Number(r.commission_amount_zar) || 0;
      const st = String(r.status || '').toLowerCase();
      if (st === 'paid') paidZar += amt;
      else if (st === 'void') continue;
      else if (st === 'pending') pendingZar += amt;
      else approvedZar += amt;
    }

    const { count } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('referred_by_profile_id', earnerProfileId);

    return {
      pendingZar: Math.round(pendingZar * 100) / 100,
      approvedZar: Math.round(approvedZar * 100) / 100,
      paidZar: Math.round(paidZar * 100) / 100,
      totalZar: Math.round((pendingZar + approvedZar + paidZar) * 100) / 100,
      directReferrals: count ?? 0,
      recent: (rows || []).slice(0, 20) as Array<Record<string, unknown>>,
      rates: REFERRAL_LEVEL_RATES_PCT,
      totalCapPct: REFERRAL_TOTAL_CAP_PCT,
    };
  } catch {
    return empty;
  }
}

/** Ensure a short shareable referral code exists for a company. */
export async function ensureReferralCode(
  profileId: number
): Promise<string | null> {
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from('profiles')
    .select('id, referral_code, trading_name')
    .eq('id', profileId)
    .maybeSingle();
  if (!data) return null;
  if (data.referral_code) return String(data.referral_code);

  const slug = String(data.trading_name || 'co')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .slice(0, 8)
    .toUpperCase() || 'CO';
  const code = `${slug}${profileId}`;
  await supabase
    .from('profiles')
    .update({ referral_code: code })
    .eq('id', profileId)
    .is('referral_code', null);
  return code;
}

export async function resolveReferrerFromCode(
  code: string
): Promise<number | null> {
  const c = String(code || '').trim();
  if (!c) return null;
  const supabase = getSupabaseServer();
  // Numeric company id
  if (/^\d+$/.test(c)) {
    const id = Number(c);
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', id)
      .maybeSingle();
    return data ? Number(data.id) : null;
  }
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('referral_code', c)
    .maybeSingle();
  return data ? Number(data.id) : null;
}
