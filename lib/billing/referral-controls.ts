/**
 * Watertight referral controls: attribution audit, self-referral, holds,
 * clawbacks, KYC gates, and platform-ops authorization.
 */

import { NextRequest } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  assertCronSecret,
  fail,
  requireVerifiedUser,
  type AuthFail,
  type AuthOk,
} from '@/lib/auth/api-auth';
import { getCompanyMembership } from '@/lib/business/access';

/** Local root id (avoid circular import with supply-chain-referral) */
function getRootId(): number {
  const fromEnv = Number(
    process.env.REFERRAL_ROOT_PROFILE_ID ||
      process.env.NEXT_PUBLIC_REFERRAL_ROOT_PROFILE_ID ||
      ''
  );
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
  return 102;
}

/** Days after payment before earnings become eligible for auto-approve / request */
export const REFERRAL_HOLD_DAYS = Math.max(
  0,
  Number(process.env.REFERRAL_HOLD_DAYS || 30) || 30
);

/** When false (default), unattributed companies have no parent — explicit invite/ref only */
export function isDefaultRootEnabled(): boolean {
  const v = String(process.env.REFERRAL_DEFAULT_ROOT || 'false').toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

/** Payouts above this require KYC bank details (ZAR) */
export const REFERRAL_KYC_THRESHOLD_ZAR = Math.max(
  0,
  Number(process.env.REFERRAL_KYC_THRESHOLD_ZAR || 500) || 500
);

/** Max paid+requested YTD without verified payout profile */
export const REFERRAL_ANNUAL_CAP_WITHOUT_KYC_ZAR = Math.max(
  0,
  Number(process.env.REFERRAL_ANNUAL_CAP_WITHOUT_KYC_ZAR || 5000) || 5000
);

export type AttributionSource =
  | 'ref_link'
  | 'supplier_invite'
  | 'customer_invite'
  | 'invite_business'
  | 'send_supplier_invite'
  | 'default_root'
  | 'claim'
  | 'admin'
  | 'unknown';

export function holdUntilIso(from: Date = new Date()): string {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() + REFERRAL_HOLD_DAYS);
  return d.toISOString();
}

/** Platform ops: CRON/REFERRAL_OPS secret, or owner of programme root / listed profile ids */
export async function requireReferralOps(
  request: NextRequest,
  opts?: { legacyPrivyUserId?: string | null }
): Promise<(AuthOk & { via: 'secret' | 'root_owner' }) | AuthFail> {
  const opsSecret =
    process.env.REFERRAL_OPS_SECRET || process.env.CRON_SECRET || '';
  if (opsSecret) {
    const auth = request.headers.get('authorization') || '';
    const header =
      request.headers.get('x-referral-ops-secret') ||
      request.headers.get('x-cron-secret') ||
      '';
    const bearer = auth.replace(/^Bearer\s+/i, '').trim();
    if (bearer === opsSecret || header === opsSecret) {
      return { ok: true, userId: 'ops:system', verified: true, via: 'secret' };
    }
  }

  // Cron-style without body
  const cron = assertCronSecret(request);
  if (cron.ok) {
    return { ...cron, via: 'secret' };
  }

  const user = await requireVerifiedUser(request, opts);
  if (!user.ok) {
    return fail(
      403,
      'Platform referral ops only. Use REFERRAL_OPS_SECRET or own the programme root company.',
      'REFERRAL_OPS_FORBIDDEN'
    );
  }

  const allowed = parseOpsProfileIds();
  const root = getRootId();
  if (!allowed.includes(root)) allowed.push(root);

  for (const profileId of allowed) {
    const mem = await getCompanyMembership(user.userId, profileId);
    if (mem.ok && (mem.role === 'owner' || mem.role === 'admin')) {
      return {
        ok: true,
        userId: user.userId,
        verified: user.verified,
        via: 'root_owner',
      };
    }
  }

  return fail(
    403,
    'Only platform referral operators can approve, pay, or void earnings.',
    'REFERRAL_OPS_FORBIDDEN'
  );
}

function parseOpsProfileIds(): number[] {
  const raw =
    process.env.REFERRAL_OPS_PROFILE_IDS ||
    process.env.NEXT_PUBLIC_REFERRAL_OPS_PROFILE_IDS ||
    '';
  return raw
    .split(/[,;\s]+/)
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

/**
 * Detect self-referral: same owner user, same contact email, or same email domain
 * for small private domains (not gmail etc.).
 */
export async function detectSelfReferral(opts: {
  childProfileId?: number | null;
  referrerProfileId: number;
  childUserId?: string | null;
  childEmail?: string | null;
}): Promise<{ blocked: boolean; reason?: string }> {
  const parentId = Number(opts.referrerProfileId);
  if (!Number.isFinite(parentId) || parentId <= 0) {
    return { blocked: false };
  }

  const supabase = getSupabaseServer();
  const { data: parent } = await supabase
    .from('profiles')
    .select('id, email, user_id, trading_name')
    .eq('id', parentId)
    .maybeSingle();

  if (!parent) {
    return { blocked: true, reason: 'Referrer company not found' };
  }

  const parentUser = parent.user_id ? String(parent.user_id) : null;
  const parentEmail = normalizeEmail(parent.email);

  let childUser = opts.childUserId ? String(opts.childUserId) : null;
  let childEmail = normalizeEmail(opts.childEmail);

  if (opts.childProfileId) {
    const { data: child } = await supabase
      .from('profiles')
      .select('id, email, user_id')
      .eq('id', opts.childProfileId)
      .maybeSingle();
    if (child) {
      childUser = child.user_id ? String(child.user_id) : childUser;
      childEmail = normalizeEmail(child.email) || childEmail;
    }
  }

  if (parentUser && childUser && parentUser === childUser) {
    return {
      blocked: true,
      reason: 'Self-referral blocked: same account owns both companies',
    };
  }

  if (parentEmail && childEmail && parentEmail === childEmail) {
    return {
      blocked: true,
      reason: 'Self-referral blocked: same contact email',
    };
  }

  const parentDom = emailDomain(parentEmail);
  const childDom = emailDomain(childEmail);
  if (
    parentDom &&
    childDom &&
    parentDom === childDom &&
    !isPublicEmailDomain(parentDom)
  ) {
    return {
      blocked: true,
      reason: `Self-referral blocked: shared private email domain (@${parentDom})`,
    };
  }

  // Owners of referrer company matching child user
  if (childUser) {
    const { data: owners } = await supabase
      .from('business_users')
      .select('user_id, role, status')
      .eq('profile_id', parentId)
      .eq('status', 'active')
      .in('role', ['owner', 'admin']);
    for (const o of owners || []) {
      if (String(o.user_id) === childUser) {
        return {
          blocked: true,
          reason: 'Self-referral blocked: you already admin the referring company',
        };
      }
    }
  }

  return { blocked: false };
}

function normalizeEmail(e: unknown): string | null {
  const s = String(e || '')
    .toLowerCase()
    .trim();
  return s.includes('@') ? s : null;
}

function emailDomain(email: string | null): string | null {
  if (!email) return null;
  const i = email.lastIndexOf('@');
  if (i < 0) return null;
  return email.slice(i + 1) || null;
}

const PUBLIC_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.uk',
  'yahoo.co.za',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'icloud.com',
  'me.com',
  'msn.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'mail.com',
]);

function isPublicEmailDomain(d: string): boolean {
  return PUBLIC_DOMAINS.has(d.toLowerCase());
}

/** Immutable first-touch attribution row (unique on child). */
export async function recordReferralAttribution(opts: {
  childProfileId: number;
  referrerProfileId: number;
  source: AttributionSource;
  inviteToken?: string | null;
  actorUserId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<{ ok: boolean; recorded: boolean; error?: string }> {
  const child = Number(opts.childProfileId);
  const parent = Number(opts.referrerProfileId);
  if (!Number.isFinite(child) || !Number.isFinite(parent) || child <= 0 || parent <= 0) {
    return { ok: false, recorded: false, error: 'Invalid ids' };
  }
  if (child === parent) {
    return { ok: true, recorded: false };
  }

  const supabase = getSupabaseServer();
  const { error } = await supabase.from('referral_attributions').insert({
    child_profile_id: child,
    referrer_profile_id: parent,
    source: opts.source,
    invite_token: opts.inviteToken || null,
    actor_user_id: opts.actorUserId || null,
    metadata: opts.metadata || {},
    created_at: new Date().toISOString(),
  });

  if (error) {
    if (/duplicate|unique/i.test(error.message)) {
      return { ok: true, recorded: false };
    }
    // Table may not exist yet
    if (/relation|does not exist|column/i.test(error.message)) {
      console.warn('recordReferralAttribution soft-fail:', error.message);
      return { ok: true, recorded: false, error: error.message };
    }
    return { ok: false, recorded: false, error: error.message };
  }
  return { ok: true, recorded: true };
}

export type PayoutKycStatus = {
  complete: boolean;
  missing: string[];
  verified: boolean;
  bankName?: string | null;
  accountName?: string | null;
};

export async function getPayoutKycStatus(
  profileId: number
): Promise<PayoutKycStatus> {
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from('profiles')
    .select(
      'referral_payout_bank_name, referral_payout_account_name, referral_payout_account_number, referral_payout_branch_code, referral_payout_tax_number, referral_payout_verified_at, verification_status'
    )
    .eq('id', profileId)
    .maybeSingle();

  const missing: string[] = [];
  if (!data?.referral_payout_bank_name) missing.push('bank_name');
  if (!data?.referral_payout_account_name) missing.push('account_name');
  if (!data?.referral_payout_account_number) missing.push('account_number');
  if (!data?.referral_payout_branch_code) missing.push('branch_code');

  const verified = Boolean(data?.referral_payout_verified_at);
  return {
    complete: missing.length === 0,
    missing,
    verified,
    bankName: data?.referral_payout_bank_name ?? null,
    accountName: data?.referral_payout_account_name ?? null,
  };
}

export async function sumYtdPaidAndRequested(
  earnerProfileId: number
): Promise<number> {
  const supabase = getSupabaseServer();
  const yearStart = new Date();
  yearStart.setUTCMonth(0, 1);
  yearStart.setUTCHours(0, 0, 0, 0);
  const { data } = await supabase
    .from('supply_chain_referral_earnings')
    .select('commission_amount_zar, status, created_at')
    .eq('earner_profile_id', earnerProfileId)
    .in('status', ['paid', 'payout_requested', 'approved'])
    .gte('created_at', yearStart.toISOString())
    .limit(2000);

  let sum = 0;
  for (const r of data || []) {
    sum += Number(r.commission_amount_zar) || 0;
  }
  return Math.round(sum * 100) / 100;
}

/** Void unpaid earnings for a payment ref; open clawbacks for already-paid ones. */
export async function clawbackReferralForSourceRef(opts: {
  sourceRef: string;
  reason?: string | null;
  actorUserId?: string | null;
}): Promise<{
  ok: boolean;
  voided: number;
  clawbacksOpened: number;
  error?: string;
}> {
  const sourceRef = String(opts.sourceRef || '').trim();
  if (!sourceRef) {
    return { ok: false, voided: 0, clawbacksOpened: 0, error: 'sourceRef required' };
  }

  const supabase = getSupabaseServer();
  const now = new Date().toISOString();
  const reason = opts.reason || 'Payment refunded / reversed';

  const { data: rows, error } = await supabase
    .from('supply_chain_referral_earnings')
    .select('id, earner_profile_id, source_profile_id, commission_amount_zar, status')
    .eq('source_ref', sourceRef)
    .limit(100);

  if (error) {
    return {
      ok: false,
      voided: 0,
      clawbacksOpened: 0,
      error: error.message,
    };
  }

  let voided = 0;
  let clawbacksOpened = 0;

  for (const r of rows || []) {
    const st = String(r.status || '').toLowerCase();
    const id = Number(r.id);
    if (st === 'void' || st === 'clawed_back') continue;

    if (st === 'paid') {
      const { error: cErr } = await supabase
        .from('supply_chain_referral_clawbacks')
        .insert({
          earning_id: id,
          source_ref: sourceRef,
          earner_profile_id: Number(r.earner_profile_id),
          source_profile_id: r.source_profile_id
            ? Number(r.source_profile_id)
            : null,
          amount_zar: Number(r.commission_amount_zar) || 0,
          reason,
          status: 'open',
          created_by: opts.actorUserId || null,
          created_at: now,
          updated_at: now,
        });
      if (!cErr || /duplicate/i.test(cErr.message)) {
        clawbacksOpened += 1;
        await supabase
          .from('supply_chain_referral_earnings')
          .update({
            clawed_back_at: now,
            void_reason: reason,
            updated_at: now,
          })
          .eq('id', id);
      }
    } else {
      const { data: upd } = await supabase
        .from('supply_chain_referral_earnings')
        .update({
          status: 'void',
          voided_at: now,
          void_reason: reason,
          updated_at: now,
        })
        .eq('id', id)
        .neq('status', 'paid')
        .select('id')
        .maybeSingle();
      if (upd?.id) voided += 1;
    }
  }

  return { ok: true, voided, clawbacksOpened };
}

/** Auto-approve pending earnings whose hold_until has passed. */
export async function autoApproveEligibleEarnings(limit = 200): Promise<{
  ok: boolean;
  count: number;
  error?: string;
}> {
  const supabase = getSupabaseServer();
  const now = new Date().toISOString();

  const { data: rows, error } = await supabase
    .from('supply_chain_referral_earnings')
    .select('id, hold_until, eligible_at, status')
    .eq('status', 'pending')
    .limit(limit);

  if (error) {
    if (/relation|column|does not exist/i.test(error.message)) {
      return { ok: true, count: 0, error: error.message };
    }
    return { ok: false, count: 0, error: error.message };
  }

  const ready = (rows || []).filter((r) => {
    const hold = r.hold_until || r.eligible_at;
    if (!hold) return REFERRAL_HOLD_DAYS <= 0;
    return new Date(String(hold)).getTime() <= Date.now();
  });

  if (!ready.length) return { ok: true, count: 0 };

  const ids = ready.map((r) => Number(r.id));
  const { data: upd, error: upErr } = await supabase
    .from('supply_chain_referral_earnings')
    .update({
      status: 'approved',
      approved_at: now,
      approved_by: 'system:hold_elapsed',
      updated_at: now,
    })
    .in('id', ids)
    .eq('status', 'pending')
    .select('id');

  if (upErr) return { ok: false, count: 0, error: upErr.message };
  return { ok: true, count: (upd || []).length };
}

/** Fraud / ops snapshot for a company tree */
export async function getReferralFraudSignals(earnerProfileId: number): Promise<{
  directReferrals: number;
  pendingZar: number;
  openClawbacksZar: number;
  sameEmailDomains: number;
  recentAttributions: Array<Record<string, unknown>>;
}> {
  const supabase = getSupabaseServer();
  const { count } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('referred_by_profile_id', earnerProfileId);

  const { data: pending } = await supabase
    .from('supply_chain_referral_earnings')
    .select('commission_amount_zar')
    .eq('earner_profile_id', earnerProfileId)
    .eq('status', 'pending')
    .limit(500);

  const pendingZar = Math.round(
    (pending || []).reduce((s, r) => s + (Number(r.commission_amount_zar) || 0), 0) *
      100
  ) / 100;

  const { data: claws } = await supabase
    .from('supply_chain_referral_clawbacks')
    .select('amount_zar')
    .eq('earner_profile_id', earnerProfileId)
    .eq('status', 'open')
    .limit(200);

  const openClawbacksZar =
    Math.round(
      (claws || []).reduce((s, r) => s + (Number(r.amount_zar) || 0), 0) * 100
    ) / 100;

  const { data: attrs } = await supabase
    .from('referral_attributions')
    .select('*')
    .eq('referrer_profile_id', earnerProfileId)
    .order('created_at', { ascending: false })
    .limit(20);

  return {
    directReferrals: count ?? 0,
    pendingZar,
    openClawbacksZar,
    sameEmailDomains: 0,
    recentAttributions: (attrs || []) as Array<Record<string, unknown>>,
  };
}

export function resolveReferrerExplicitOnly(
  explicitReferrerId: number | null | undefined,
  forProfileId?: number | null
): number | null {
  const forId = forProfileId != null ? Number(forProfileId) : null;
  const root = getRootId();
  if (forId != null && Number.isFinite(forId) && forId === root) {
    return null;
  }
  const explicit = Number(explicitReferrerId);
  if (Number.isFinite(explicit) && explicit > 0 && explicit !== forId) {
    return explicit;
  }
  if (isDefaultRootEnabled() && forId !== root) {
    return root;
  }
  return null;
}
