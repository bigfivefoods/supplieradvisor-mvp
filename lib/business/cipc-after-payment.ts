/**
 * Run VerifyNow CIPC after a confirmed Paystack R69 payment.
 * Used by /api/business/verify (browser) and Paystack webhook (tab closed).
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { logActivity } from '@/lib/customers/access';
import {
  callVerifyNowCipcCompany,
  isValidCipcRegistrationNumber,
  parseVerifyNowCipcResult,
} from '@/lib/verifynow/client';

const GHOST = new Set([
  'is_verified',
  // Prefer real columns when present; still strip from retry loops below if missing
  'director_id_number',
]);

export type CipcRunResult = {
  ok: boolean;
  status: 'verified' | 'mismatch' | 'failed' | 'skipped' | 'error';
  message: string;
  companyId: number;
  paystackReference: string;
  companyName?: string | null;
  nameMatch?: string | null;
  error?: string;
  skippedReason?: string;
};

type ProfileRow = {
  id?: number;
  trading_name?: string | null;
  legal_name?: string | null;
  registration_number?: string | null;
  vat_number?: string | null;
  verification_status?: string | null;
  verification_payment_ref?: string | null;
  metadata?: unknown;
};

async function loadProfile(
  supabase: ReturnType<typeof getSupabaseServer>,
  companyId: number
): Promise<ProfileRow | null> {
  for (const sel of [
    'id, trading_name, legal_name, registration_number, vat_number, verification_status, verification_payment_ref, metadata',
    'id, trading_name, legal_name, registration_number, vat_number, verification_status, metadata',
    'id, trading_name, legal_name, registration_number, vat_number, metadata',
  ]) {
    const { data, error } = await supabase
      .from('profiles')
      .select(sel)
      .eq('id', companyId)
      .maybeSingle();
    if (!error && data) return data as ProfileRow;
  }
  return null;
}

async function updateTolerant(
  supabase: ReturnType<typeof getSupabaseServer>,
  companyId: number,
  updates: Record<string, unknown>
) {
  const row = { ...updates };
  for (const g of GHOST) delete row[g];
  for (let i = 0; i < 6; i++) {
    const { data, error } = await supabase
      .from('profiles')
      .update(row)
      .eq('id', companyId)
      .select('id, verification_status, metadata')
      .maybeSingle();
    if (!error) return { data, error: null as string | null };
    const msg = error.message || '';
    if (!/column|schema cache|does not exist/i.test(msg)) {
      return { data: null, error: msg };
    }
    const m = /column ["']?([a-z0-9_]+)["']?/i.exec(msg);
    if (m?.[1] && m[1] in row) {
      delete row[m[1]];
      continue;
    }
    for (const k of [
      'verification_paid_at',
      'verification_payment_ref',
      'verified_at',
      'is_verified',
      'metadata',
    ]) {
      if (k in row) {
        delete row[k];
        break;
      }
    }
  }
  return { data: null, error: 'update failed' };
}

function metaV(profile: ProfileRow): Record<string, unknown> {
  const meta =
    profile.metadata && typeof profile.metadata === 'object'
      ? (profile.metadata as Record<string, unknown>)
      : {};
  const v = meta.verification;
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
}

/**
 * Idempotent: if this paystack ref already produced verified, skip.
 */
export async function runCipcAfterPayment(opts: {
  companyId: number;
  paystackReference: string;
  actorUserId?: string | null;
  source?: string;
}): Promise<CipcRunResult> {
  const companyId = Number(opts.companyId);
  const paystackReference = String(opts.paystackReference || '').trim();
  if (!Number.isFinite(companyId) || companyId <= 0) {
    return {
      ok: false,
      status: 'error',
      message: 'Invalid companyId',
      companyId,
      paystackReference,
      error: 'Invalid companyId',
    };
  }
  if (!paystackReference) {
    return {
      ok: false,
      status: 'error',
      message: 'Missing payment reference',
      companyId,
      paystackReference: '',
      error: 'Missing payment reference',
    };
  }

  const supabase = getSupabaseServer();
  const profile = await loadProfile(supabase, companyId);
  if (!profile) {
    return {
      ok: false,
      status: 'error',
      message: 'Profile not found',
      companyId,
      paystackReference,
      error: 'Profile not found',
    };
  }

  const prev = metaV(profile);
  if (
    String(profile.verification_status || '').toLowerCase() === 'verified' &&
    String(prev.paystack_reference || '') === paystackReference
  ) {
    return {
      ok: true,
      status: 'skipped',
      message: 'Already verified for this payment',
      companyId,
      paystackReference,
      skippedReason: 'already_verified_same_ref',
      companyName: String(prev.company_name || '') || null,
    };
  }

  const reg = String(profile.registration_number || '').trim().toUpperCase();
  const vat = String(profile.vat_number || '').replace(/\s/g, '');
  if (!reg && !vat) {
    // Still record payment on profile so user can re-run later
    const now = new Date().toISOString();
    const metaBase =
      profile.metadata && typeof profile.metadata === 'object'
        ? (profile.metadata as Record<string, unknown>)
        : {};
    const prevPaidAt = metaV(profile).paid_at;
    await updateTolerant(supabase, companyId, {
      verification_status: 'pending',
      verification_payment_ref: paystackReference,
      verification_paid_at: prevPaidAt || now,
      updated_at: now,
      metadata: {
        ...metaBase,
        verification: {
          ...metaV(profile),
          status: 'pending',
          paystack_reference: paystackReference,
          amount_zar: 69,
          paid_at: prevPaidAt || now,
          checked_at: now,
          error: 'Missing registration/VAT — complete profile then re-run CIPC',
          source: opts.source || 'paystack_webhook',
        },
      },
    });
    return {
      ok: false,
      status: 'failed',
      message: 'Payment saved; add CIPC reg or VAT then re-run verify',
      companyId,
      paystackReference,
      error: 'Missing registration number / VAT',
    };
  }
  if (reg && !isValidCipcRegistrationNumber(reg)) {
    return {
      ok: false,
      status: 'failed',
      message: 'Invalid registration number format',
      companyId,
      paystackReference,
      error: 'Invalid registration format',
    };
  }

  const now = new Date().toISOString();
  const prevPaidAt = metaV(profile).paid_at || null;
  const paidAt = prevPaidAt || now;
  await updateTolerant(supabase, companyId, {
    verification_status: 'pending',
    updated_at: now,
    verification_payment_ref: paystackReference,
    verification_paid_at: paidAt,
    metadata: {
      ...(profile.metadata && typeof profile.metadata === 'object'
        ? (profile.metadata as Record<string, unknown>)
        : {}),
      verification: {
        ...metaV(profile),
        paystack_reference: paystackReference,
        amount_zar: 69,
        paid_at: paidAt,
        status: 'pending',
        source: opts.source || 'paystack_webhook',
      },
    },
  });

  const vn = await callVerifyNowCipcCompany({
    registrationNumber: reg || undefined,
    vatNumber: vat || undefined,
  });

  const localNames = [profile.legal_name, profile.trading_name]
    .map((x) => String(x || '').trim())
    .filter(Boolean);

  if (!vn.ok) {
    const metaBase =
      profile.metadata && typeof profile.metadata === 'object'
        ? (profile.metadata as Record<string, unknown>)
        : {};
    await updateTolerant(supabase, companyId, {
      verification_status: 'failed',
      updated_at: now,
      verification_payment_ref: paystackReference,
      verification_paid_at: paidAt,
      metadata: {
        ...metaBase,
        verification: {
          provider: 'verifynow',
          status: 'failed',
          paystack_reference: paystackReference,
          amount_zar: 69,
          paid_at: paidAt,
          checked_at: now,
          error: vn.error,
          raw: vn.data,
          source: opts.source || 'paystack_webhook',
        },
      },
    });
    void import('@/lib/notifications/email-alerts').then(
      ({ notifyCipcVerificationOutcome }) =>
        notifyCipcVerificationOutcome({
          profileId: companyId,
          tradingName: profile.trading_name || profile.legal_name,
          status: 'failed',
          paystackReference,
          detail: vn.error,
          registrationNumber: reg || null,
        })
    );
    return {
      ok: false,
      status: 'failed',
      message: vn.error || 'VerifyNow failed',
      companyId,
      paystackReference,
      error: vn.error,
    };
  }

  const parsed = parseVerifyNowCipcResult(vn.data, localNames);
  let status: 'verified' | 'mismatch' | 'failed' = parsed.ok
    ? 'verified'
    : 'failed';
  if (parsed.ok && parsed.nameMatch === 'mismatch') status = 'mismatch';

  const metaBase =
    profile.metadata && typeof profile.metadata === 'object'
      ? (profile.metadata as Record<string, unknown>)
      : {};

  await updateTolerant(supabase, companyId, {
    verification_status: status,
    updated_at: now,
    verification_payment_ref: paystackReference,
    verification_paid_at: paidAt,
    ...(status === 'verified' ? { verified_at: now } : {}),
    metadata: {
      ...metaBase,
      verification: {
        provider: 'verifynow',
        reportType: 'cipc_company_match',
        status,
        verified_at: status === 'verified' ? now : null,
        checked_at: now,
        paid_at: paidAt,
        paystack_reference: paystackReference,
        amount_zar: 69,
        request_id: parsed.requestId,
        company_name: parsed.companyName,
        trade_name: parsed.tradeName,
        registration_number: parsed.registrationNumber || reg,
        company_status: parsed.companyStatus,
        name_match: parsed.nameMatch,
        physical_address: parsed.physicalAddress,
        vat_number: parsed.vatNumber,
        error: null,
        raw: vn.data,
        source: opts.source || 'paystack_webhook',
      },
    },
  });

  await logActivity({
    profile_id: companyId,
    actor_user_id: opts.actorUserId || 'paystack:webhook',
    action: 'business.verification_verifynow',
    entity_type: 'profiles',
    entity_id: String(companyId),
    summary:
      status === 'verified'
        ? `Company verified via VerifyNow CIPC: ${parsed.companyName || reg}`
        : status === 'mismatch'
          ? `CIPC name mismatch: ${parsed.companyName}`
          : `CIPC failed: ${parsed.statusText}`,
    metadata: {
      status,
      paystackReference,
      source: opts.source || 'paystack_webhook',
      nameMatch: parsed.nameMatch,
    },
  });

  void import('@/lib/notifications/email-alerts').then(
    ({ notifyCipcVerificationOutcome }) =>
      notifyCipcVerificationOutcome({
        profileId: companyId,
        tradingName: profile.trading_name || profile.legal_name,
        status,
        companyNameCipc: parsed.companyName,
        nameMatch: parsed.nameMatch,
        paystackReference,
        detail: parsed.statusText,
        registrationNumber: parsed.registrationNumber || reg || null,
      })
  );

  return {
    ok: status === 'verified',
    status,
    message:
      status === 'verified'
        ? `Verified: ${parsed.companyName}`
        : status === 'mismatch'
          ? `Name mismatch: ${parsed.companyName}`
          : parsed.statusText || 'Failed',
    companyId,
    paystackReference,
    companyName: parsed.companyName,
    nameMatch: parsed.nameMatch,
  };
}

/** Parse company id from sa-verify-{id}-{ts} or metadata custom_fields */
export function companyIdFromPaystackCharge(
  data: Record<string, unknown>
): number | null {
  const ref = String(data.reference || '').trim();
  const m = /^sa-verify-(\d+)-/i.exec(ref);
  if (m) return Number(m[1]);

  const meta = (data.metadata || {}) as Record<string, unknown>;
  if (meta.company_id != null) {
    const n = Number(meta.company_id);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const fields = meta.custom_fields;
  if (Array.isArray(fields)) {
    for (const f of fields) {
      if (!f || typeof f !== 'object') continue;
      const row = f as Record<string, unknown>;
      const key = String(row.variable_name || row.display_name || '').toLowerCase();
      if (key === 'company_id' || key.includes('company')) {
        const n = Number(row.value);
        if (Number.isFinite(n) && n > 0) return n;
      }
    }
  }
  return null;
}

export function isCipcVerificationCharge(data: Record<string, unknown>): boolean {
  const ref = String(data.reference || '');
  if (/^sa-verify-/i.test(ref)) return true;
  const meta = (data.metadata || {}) as Record<string, unknown>;
  const purpose = String(meta.purpose || '').toLowerCase();
  if (purpose.includes('verifynow') || purpose.includes('cipc')) return true;
  const fields = meta.custom_fields;
  if (Array.isArray(fields)) {
    for (const f of fields) {
      if (!f || typeof f !== 'object') continue;
      const row = f as Record<string, unknown>;
      const key = String(row.variable_name || '').toLowerCase();
      const val = String(row.value || '').toLowerCase();
      if (key === 'purpose' && (val.includes('verifynow') || val.includes('cipc'))) {
        return true;
      }
    }
  }
  return false;
}
