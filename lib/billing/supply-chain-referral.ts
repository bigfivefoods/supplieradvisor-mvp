/**
 * Supply-chain referral fees — 3 levels deep, max 10% total of the paid amount.
 *
 * Company-to-company platform referral on subscription payments —
 * NOT sales-contractor product MLM (those remain personal-sales-only).
 *
 * Suggested / default split of each subscription payment:
 *   Level 1 (direct inviter): 6%
 *   Level 2: 3%
 *   Level 3: 1%
 *   Total: 10%
 *
 * Payout workflow statuses on each earning:
 *   pending → approved → payout_requested → paid
 *   (or void at any pre-paid stage)
 */

import { getSupabaseServer } from '@/lib/supabase/server-client';

export const REFERRAL_MAX_LEVELS = 3;
/** Hard cap across all levels combined */
export const REFERRAL_TOTAL_CAP_PCT = 10;

/**
 * Suggested commercial split — rewards direct invites most,
 * still pays two generations deeper (total 10%).
 */
export const REFERRAL_LEVEL_RATES_PCT: readonly [number, number, number] = [
  6, // L1 — direct invite
  3, // L2
  1, // L3
];

export const REFERRAL_LEVEL_LABELS: readonly [string, string, string] = [
  'Direct invite (L1)',
  'Second level (L2)',
  'Third level (L3)',
];

export type ReferralEarningStatus =
  | 'pending'
  | 'approved'
  | 'payout_requested'
  | 'paid'
  | 'void';

export type ReferralLevelPayout = {
  level: 1 | 2 | 3;
  earnerProfileId: number;
  ratePct: number;
  commissionZar: number;
};

export type ReferralEarningRow = {
  id: number;
  earner_profile_id: number;
  source_profile_id: number;
  level: number;
  rate_pct: number;
  base_amount_zar: number;
  commission_amount_zar: number;
  currency: string;
  source_type: string;
  source_ref: string | null;
  status: string;
  notes: string | null;
  paid_at: string | null;
  paid_ref: string | null;
  payout_requested_at: string | null;
  created_at: string;
  source_name?: string | null;
};

export function referralRatesSummary(): string {
  return `L1 ${REFERRAL_LEVEL_RATES_PCT[0]}% · L2 ${REFERRAL_LEVEL_RATES_PCT[1]}% · L3 ${REFERRAL_LEVEL_RATES_PCT[2]}% (max ${REFERRAL_TOTAL_CAP_PCT}% total)`;
}

export function referralSuggestedCopy(): string {
  return (
    `When a company you invite pays for SupplierAdvisor, you earn ${REFERRAL_LEVEL_RATES_PCT[0]}% of that payment. ` +
    `If they invite someone who pays, you earn ${REFERRAL_LEVEL_RATES_PCT[1]}%. ` +
    `One level further pays ${REFERRAL_LEVEL_RATES_PCT[2]}%. ` +
    `Combined rewards never exceed ${REFERRAL_TOTAL_CAP_PCT}% of the paying company's subscription fee.`
  );
}

/** Fetch one hop up the referral tree. */
async function fetchReferredByParentId(
  childProfileId: number
): Promise<number | null> {
  const supabase = getSupabaseServer();
  const result = await supabase
    .from('profiles')
    .select('referred_by_profile_id')
    .eq('id', childProfileId)
    .maybeSingle();

  if (result.error || !result.data) return null;

  const row = result.data as { referred_by_profile_id?: number | string | null };
  if (row.referred_by_profile_id == null || row.referred_by_profile_id === '') {
    return null;
  }
  const parentNum = Number(row.referred_by_profile_id);
  if (!Number.isFinite(parentNum) || parentNum <= 0) return null;
  return parentNum;
}

/** Walk referred_by_profile_id up to 3 parents (closest = level 1). */
export async function resolveReferralChain(
  sourceProfileId: number
): Promise<Array<{ level: 1 | 2 | 3; profileId: number }>> {
  const chain: Array<{ level: 1 | 2 | 3; profileId: number }> = [];
  let currentId: number | null = sourceProfileId;
  const seen = new Set<number>([sourceProfileId]);

  for (let level = 1; level <= REFERRAL_MAX_LEVELS; level++) {
    if (currentId == null) break;
    const parentId = await fetchReferredByParentId(currentId);
    if (parentId == null) break;
    if (seen.has(parentId)) break;
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
    const commissionZar = Math.round(((base * rate) / 100) * 100) / 100;
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
 * New rows start as **pending** (awaiting auto-approval window or finance review).
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
        // Hold briefly as pending so finance can void fraud; earner can still see it
        status: 'pending',
        notes: opts.termLabel
          ? `Subscription ${opts.termLabel}${opts.months ? ` · ${opts.months} mo` : ''}`
          : 'Company subscription payment',
        metadata: {
          term_label: opts.termLabel || null,
          months: opts.months ?? null,
          rates: [...REFERRAL_LEVEL_RATES_PCT],
          total_cap_pct: REFERRAL_TOTAL_CAP_PCT,
          split_label: referralRatesSummary(),
        },
        created_at: now,
        updated_at: now,
      };

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
  payoutRequestedZar: number;
  paidZar: number;
  totalZar: number;
  availableToRequestZar: number;
  directReferrals: number;
  recent: ReferralEarningRow[];
  rates: typeof REFERRAL_LEVEL_RATES_PCT;
  levelLabels: typeof REFERRAL_LEVEL_LABELS;
  totalCapPct: number;
  ratesSummary: string;
  suggestedCopy: string;
  payouts: Array<Record<string, unknown>>;
}> {
  const empty = {
    pendingZar: 0,
    approvedZar: 0,
    payoutRequestedZar: 0,
    paidZar: 0,
    totalZar: 0,
    availableToRequestZar: 0,
    directReferrals: 0,
    recent: [] as ReferralEarningRow[],
    rates: REFERRAL_LEVEL_RATES_PCT,
    levelLabels: REFERRAL_LEVEL_LABELS,
    totalCapPct: REFERRAL_TOTAL_CAP_PCT,
    ratesSummary: referralRatesSummary(),
    suggestedCopy: referralSuggestedCopy(),
    payouts: [] as Array<Record<string, unknown>>,
  };

  try {
    const supabase = getSupabaseServer();
    const { data: rows, error } = await supabase
      .from('supply_chain_referral_earnings')
      .select('*')
      .eq('earner_profile_id', earnerProfileId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      if (/relation|does not exist/i.test(error.message)) return empty;
      console.error('getReferralSummary:', error.message);
      return empty;
    }

    let pendingZar = 0;
    let approvedZar = 0;
    let payoutRequestedZar = 0;
    let paidZar = 0;
    for (const r of rows || []) {
      const amt = Number(r.commission_amount_zar) || 0;
      const st = String(r.status || '').toLowerCase();
      if (st === 'paid') paidZar += amt;
      else if (st === 'void') continue;
      else if (st === 'pending') pendingZar += amt;
      else if (st === 'payout_requested') payoutRequestedZar += amt;
      else approvedZar += amt; // approved
    }

    // Auto-surface pending as requestable after credit (simplify UX):
    // available = pending + approved (not yet requested)
    const availableToRequestZar = Math.round((pendingZar + approvedZar) * 100) / 100;

    const { count } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('referred_by_profile_id', earnerProfileId);

    // Enrich source names
    const sourceIds = [
      ...new Set(
        (rows || [])
          .map((r) => Number(r.source_profile_id))
          .filter((id) => Number.isFinite(id) && id > 0)
      ),
    ];
    const nameMap = new Map<number, string>();
    if (sourceIds.length) {
      const { data: sources } = await supabase
        .from('profiles')
        .select('id, trading_name, legal_name')
        .in('id', sourceIds);
      for (const s of sources || []) {
        nameMap.set(
          Number(s.id),
          String(s.trading_name || s.legal_name || `Company #${s.id}`)
        );
      }
    }

    const recent: ReferralEarningRow[] = (rows || []).slice(0, 40).map((r) => ({
      id: Number(r.id),
      earner_profile_id: Number(r.earner_profile_id),
      source_profile_id: Number(r.source_profile_id),
      level: Number(r.level),
      rate_pct: Number(r.rate_pct),
      base_amount_zar: Number(r.base_amount_zar),
      commission_amount_zar: Number(r.commission_amount_zar),
      currency: String(r.currency || 'ZAR'),
      source_type: String(r.source_type || ''),
      source_ref: r.source_ref ? String(r.source_ref) : null,
      status: String(r.status || 'pending'),
      notes: r.notes ? String(r.notes) : null,
      paid_at: r.paid_at ? String(r.paid_at) : null,
      paid_ref: r.paid_ref ? String(r.paid_ref) : null,
      payout_requested_at: r.payout_requested_at
        ? String(r.payout_requested_at)
        : null,
      created_at: String(r.created_at || ''),
      source_name: nameMap.get(Number(r.source_profile_id)) || null,
    }));

    const { data: payoutRows } = await supabase
      .from('supply_chain_referral_payouts')
      .select('*')
      .eq('earner_profile_id', earnerProfileId)
      .order('created_at', { ascending: false })
      .limit(20);

    return {
      pendingZar: Math.round(pendingZar * 100) / 100,
      approvedZar: Math.round(approvedZar * 100) / 100,
      payoutRequestedZar: Math.round(payoutRequestedZar * 100) / 100,
      paidZar: Math.round(paidZar * 100) / 100,
      totalZar:
        Math.round(
          (pendingZar + approvedZar + payoutRequestedZar + paidZar) * 100
        ) / 100,
      availableToRequestZar,
      directReferrals: count ?? 0,
      recent,
      rates: REFERRAL_LEVEL_RATES_PCT,
      levelLabels: REFERRAL_LEVEL_LABELS,
      totalCapPct: REFERRAL_TOTAL_CAP_PCT,
      ratesSummary: referralRatesSummary(),
      suggestedCopy: referralSuggestedCopy(),
      payouts: (payoutRows || []) as Array<Record<string, unknown>>,
    };
  } catch {
    return empty;
  }
}

/**
 * Earner requests payout for selected (or all available) earnings.
 * Moves pending/approved → payout_requested and opens a payout batch.
 */
export async function requestReferralPayout(opts: {
  earnerProfileId: number;
  userId: string;
  earningIds?: number[] | null;
  notes?: string | null;
}): Promise<
  | { ok: true; payoutId: number; amountZar: number; count: number }
  | { ok: false; error: string; status: number }
> {
  const supabase = getSupabaseServer();
  const now = new Date().toISOString();

  let q = supabase
    .from('supply_chain_referral_earnings')
    .select('id, commission_amount_zar, status')
    .eq('earner_profile_id', opts.earnerProfileId)
    .in('status', ['pending', 'approved']);

  if (opts.earningIds?.length) {
    q = q.in('id', opts.earningIds);
  }

  const { data: rows, error } = await q;
  if (error) {
    if (/relation|does not exist/i.test(error.message)) {
      return {
        ok: false,
        error: 'Referral tables missing. Run referral migrations.',
        status: 503,
      };
    }
    return { ok: false, error: error.message, status: 500 };
  }

  const eligible = (rows || []).filter((r) => {
    const st = String(r.status || '').toLowerCase();
    return st === 'pending' || st === 'approved';
  });

  if (!eligible.length) {
    return {
      ok: false,
      error: 'No available earnings to request. Wait for new referral credits.',
      status: 400,
    };
  }

  const ids = eligible.map((r) => Number(r.id));
  const amountZar =
    Math.round(
      eligible.reduce((s, r) => s + (Number(r.commission_amount_zar) || 0), 0) *
        100
    ) / 100;

  const { data: batch, error: batchErr } = await supabase
    .from('supply_chain_referral_payouts')
    .insert({
      earner_profile_id: opts.earnerProfileId,
      status: 'requested',
      amount_zar: amountZar,
      currency: 'ZAR',
      earning_ids: ids,
      requested_by: opts.userId,
      notes: opts.notes || null,
      created_at: now,
      updated_at: now,
    })
    .select('id')
    .single();

  if (batchErr || !batch) {
    // Table may not exist yet — still update earnings
    if (batchErr && !/relation|does not exist/i.test(batchErr.message)) {
      return { ok: false, error: batchErr.message, status: 500 };
    }
  }

  const { error: upErr } = await supabase
    .from('supply_chain_referral_earnings')
    .update({
      status: 'payout_requested',
      payout_requested_at: now,
      payout_requested_by: opts.userId,
      updated_at: now,
      metadata: {
        payout_batch_id: batch?.id ?? null,
      },
    })
    .in('id', ids)
    .eq('earner_profile_id', opts.earnerProfileId);

  if (upErr) {
    return { ok: false, error: upErr.message, status: 500 };
  }

  return {
    ok: true,
    payoutId: batch?.id ? Number(batch.id) : 0,
    amountZar,
    count: ids.length,
  };
}

/**
 * Finance/owner marks payout_requested (or approved) earnings as paid.
 */
export async function markReferralPaid(opts: {
  earnerProfileId: number;
  actorUserId: string;
  earningIds?: number[] | null;
  payoutId?: number | null;
  paidRef?: string | null;
  notes?: string | null;
}): Promise<
  | { ok: true; count: number; amountZar: number }
  | { ok: false; error: string; status: number }
> {
  const supabase = getSupabaseServer();
  const now = new Date().toISOString();
  let ids = opts.earningIds?.filter((id) => Number.isFinite(id) && id > 0) || [];

  if (opts.payoutId) {
    const { data: batch } = await supabase
      .from('supply_chain_referral_payouts')
      .select('*')
      .eq('id', opts.payoutId)
      .eq('earner_profile_id', opts.earnerProfileId)
      .maybeSingle();
    if (batch?.earning_ids && Array.isArray(batch.earning_ids)) {
      ids = (batch.earning_ids as number[]).map(Number);
    }
  }

  let q = supabase
    .from('supply_chain_referral_earnings')
    .select('id, commission_amount_zar, status')
    .eq('earner_profile_id', opts.earnerProfileId)
    .in('status', ['payout_requested', 'approved', 'pending']);

  if (ids.length) q = q.in('id', ids);

  const { data: rows, error } = await q;
  if (error) {
    return { ok: false, error: error.message, status: 500 };
  }
  if (!rows?.length) {
    return { ok: false, error: 'No matching earnings to mark paid.', status: 400 };
  }

  const payIds = rows.map((r) => Number(r.id));
  const amountZar =
    Math.round(
      rows.reduce((s, r) => s + (Number(r.commission_amount_zar) || 0), 0) * 100
    ) / 100;

  const { error: upErr } = await supabase
    .from('supply_chain_referral_earnings')
    .update({
      status: 'paid',
      paid_at: now,
      paid_ref: opts.paidRef || null,
      paid_by: opts.actorUserId,
      updated_at: now,
    })
    .in('id', payIds)
    .eq('earner_profile_id', opts.earnerProfileId);

  if (upErr) {
    return { ok: false, error: upErr.message, status: 500 };
  }

  if (opts.payoutId) {
    await supabase
      .from('supply_chain_referral_payouts')
      .update({
        status: 'paid',
        paid_at: now,
        paid_by: opts.actorUserId,
        paid_ref: opts.paidRef || null,
        amount_zar: amountZar,
        notes: opts.notes || null,
        updated_at: now,
      })
      .eq('id', opts.payoutId);
  } else {
    // Create a paid batch for audit trail
    await supabase.from('supply_chain_referral_payouts').insert({
      earner_profile_id: opts.earnerProfileId,
      status: 'paid',
      amount_zar: amountZar,
      currency: 'ZAR',
      earning_ids: payIds,
      paid_by: opts.actorUserId,
      paid_ref: opts.paidRef || null,
      paid_at: now,
      notes: opts.notes || 'Marked paid',
      created_at: now,
      updated_at: now,
    });
  }

  return { ok: true, count: payIds.length, amountZar };
}

/** Approve pending → approved (finance review). */
export async function approveReferralEarnings(opts: {
  earnerProfileId: number;
  actorUserId: string;
  earningIds?: number[] | null;
}): Promise<
  | { ok: true; count: number }
  | { ok: false; error: string; status: number }
> {
  const supabase = getSupabaseServer();
  const now = new Date().toISOString();
  let q = supabase
    .from('supply_chain_referral_earnings')
    .update({ status: 'approved', updated_at: now })
    .eq('earner_profile_id', opts.earnerProfileId)
    .eq('status', 'pending');

  if (opts.earningIds?.length) {
    q = q.in('id', opts.earningIds);
  }

  const { data, error } = await q.select('id');
  if (error) return { ok: false, error: error.message, status: 500 };
  return { ok: true, count: (data || []).length };
}

/** Void earnings that are not yet paid. */
export async function voidReferralEarnings(opts: {
  earnerProfileId: number;
  actorUserId: string;
  earningIds: number[];
  reason?: string | null;
}): Promise<
  | { ok: true; count: number }
  | { ok: false; error: string; status: number }
> {
  if (!opts.earningIds?.length) {
    return { ok: false, error: 'earningIds required', status: 400 };
  }
  const supabase = getSupabaseServer();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('supply_chain_referral_earnings')
    .update({
      status: 'void',
      voided_at: now,
      void_reason: opts.reason || null,
      updated_at: now,
    })
    .eq('earner_profile_id', opts.earnerProfileId)
    .in('id', opts.earningIds)
    .neq('status', 'paid')
    .select('id');

  if (error) return { ok: false, error: error.message, status: 500 };
  return { ok: true, count: (data || []).length };
}

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

  const slug =
    String(data.trading_name || 'co')
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
