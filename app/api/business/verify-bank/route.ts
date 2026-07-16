import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCompanyMember, logActivity } from '@/lib/customers/access';
import {
  callVerifyNowBankAccount,
  isValidCipcRegistrationNumber,
  isValidSaIdNumber,
  parseVerifyNowBankResult,
  type BankAccountVerificationResult,
} from '@/lib/verifynow/client';
import { requireCompanyAccess, legacyPrivyFrom } from '@/lib/auth/api-auth';
import { verifyPaystackTransaction } from '@/lib/billing/paystack';

/** R50 bank account verification fee (ZAR cents for Paystack). */
export const BANK_VERIFY_AMOUNT_ZAR = 50;
export const BANK_VERIFY_AMOUNT_CENTS = BANK_VERIFY_AMOUNT_ZAR * 100;

/**
 * POST — Verify company bank account via VerifyNow AVS after R50 Paystack payment.
 *
 * Body: {
 *   companyId, privyUserId,
 *   paystackReference,  // required — no free verification
 *   // optional overrides (defaults from profile):
 *   bankAccountNumber?, bankBranchCode?, bankName?, bankAccountType?,
 *   accountName?, type?: 'Individual' | 'Company',
 *   identityNumber?, identityType?, firstName?, surname?,
 *   mode?: 'sandbox' | 'production',
 *   consent?: boolean
 * }
 *
 * Docs: https://www.verifynow.co.za/api-docs (POST /api/external/bank-account-verification)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);

    const _gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request) || body.privyUserId,
    });
    if (!_gate.ok) return _gate.response;
    const mem = await assertCompanyMember(body.privyUserId || _gate.userId, companyId);
    if (!mem.ok) {
      return NextResponse.json({ error: mem.error }, { status: mem.status });
    }

    const paystackReference = String(
      body.paystackReference || body.reference || ''
    ).trim();
    if (!paystackReference) {
      return NextResponse.json(
        {
          error: 'Payment is required before bank verification',
          hint: 'Complete the R50 Paystack checkout, then verification runs automatically.',
          amount_zar: BANK_VERIFY_AMOUNT_ZAR,
        },
        { status: 402 }
      );
    }

    // Confirm Paystack payment of R50 before burning VerifyNow credits.
    // If secret is missing in non-prod, verifyPaystackTransaction soft-skips (same as billing).
    const pay = await verifyPaystackTransaction(paystackReference, {
      expectedAmountCents: BANK_VERIFY_AMOUNT_CENTS,
      expectedCurrency: 'ZAR',
    });
    if (!pay.ok) {
      // Still reject unpaid/failed transactions — surface clear message
      console.error('verify-bank Paystack check failed:', pay.error, paystackReference);
      return NextResponse.json(
        {
          error: pay.error || 'Could not confirm Paystack payment of R50',
          hint:
            'Complete the R50 Paystack checkout. If you already paid, wait a few seconds and contact support with your payment reference.',
          amount_zar: BANK_VERIFY_AMOUNT_ZAR,
          paystackReference,
        },
        { status: pay.status && pay.status >= 400 ? pay.status : 402 }
      );
    }

    if (body.consent === false) {
      return NextResponse.json(
        {
          error:
            'Consent is required to run a bank account verification via VerifyNow.',
        },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();
    type ProfileBankRow = {
      id: number;
      trading_name?: string | null;
      legal_name?: string | null;
      registration_number?: string | null;
      director_id_number?: string | null;
      contact_name?: string | null;
      bank_name?: string | null;
      account_name?: string | null;
      account_number?: string | null;
      branch_code?: string | null;
      account_type?: string | null;
      metadata?: unknown;
    };

    let profile: ProfileBankRow | null = null;
    {
      const full = await supabase
        .from('profiles')
        .select(
          'id, trading_name, legal_name, registration_number, director_id_number, contact_name, bank_name, account_name, account_number, branch_code, account_type, metadata'
        )
        .eq('id', companyId)
        .maybeSingle();

      if (full.data) {
        profile = full.data as ProfileBankRow;
      } else if (
        full.error &&
        /column|schema cache|does not exist/i.test(full.error.message || '')
      ) {
        // Retry without optional columns (branch_code / account_type may not exist yet)
        const retry = await supabase
          .from('profiles')
          .select(
            'id, trading_name, legal_name, registration_number, director_id_number, contact_name, bank_name, account_name, account_number, metadata'
          )
          .eq('id', companyId)
          .maybeSingle();
        if (retry.error || !retry.data) {
          return NextResponse.json({ error: 'Company profile not found' }, { status: 404 });
        }
        profile = retry.data as ProfileBankRow;
      } else if (full.error || !full.data) {
        return NextResponse.json({ error: 'Company profile not found' }, { status: 404 });
      }
    }

    if (!profile) {
      return NextResponse.json({ error: 'Company profile not found' }, { status: 404 });
    }

    const bankAccountNumber = String(
      body.bankAccountNumber || body.account_number || profile.account_number || ''
    ).replace(/\s/g, '');
    const bankBranchCode = String(
      body.bankBranchCode || body.branch_code || (profile as { branch_code?: string }).branch_code || ''
    ).replace(/\s/g, '');
    const bankName = String(
      body.bankName || body.bank_name || profile.bank_name || ''
    ).trim();
    const bankAccountType = String(
      body.bankAccountType ||
        body.account_type ||
        (profile as { account_type?: string }).account_type ||
        'Current'
    ).trim();
    const accountName = String(
      body.accountName || body.account_name || profile.account_name || ''
    ).trim();

    if (!bankAccountNumber) {
      return NextResponse.json(
        {
          error: 'Add a bank account number on the profile before verifying.',
        },
        { status: 400 }
      );
    }
    if (!/^\d{6}$/.test(bankBranchCode)) {
      return NextResponse.json(
        {
          error: 'Add a valid 6-digit branch code before verifying.',
          hint: 'Universal branch codes are fine (e.g. FNB 250655, Capitec 470010).',
        },
        { status: 400 }
      );
    }

    // Resolve identity: Company (reg no) preferred, else Individual (director SA ID)
    const registrationNumber = String(
      body.registrationNumber || profile.registration_number || ''
    )
      .trim()
      .toUpperCase();
    const directorId = String(
      body.directorIdNumber || body.identityNumber || profile.director_id_number || ''
    ).replace(/\s/g, '');

    let identityType: string;
    let identityNumber: string;
    let holderType: 'Individual' | 'Company';
    let firstName = String(body.firstName || '').trim();
    let surname = String(body.surname || '').trim();

    const forcedType = String(body.type || body.holderType || '').toLowerCase();
    const useCompany =
      forcedType === 'company' ||
      (forcedType !== 'individual' &&
        !!registrationNumber &&
        isValidCipcRegistrationNumber(registrationNumber));

    if (useCompany) {
      holderType = 'Company';
      identityType = String(body.identityType || 'CompanyRegNumber');
      identityNumber = registrationNumber;
      surname =
        surname ||
        accountName ||
        String(profile.legal_name || profile.trading_name || '').trim();
      firstName = firstName || '';
      if (!isValidCipcRegistrationNumber(identityNumber)) {
        return NextResponse.json(
          {
            error:
              'Company registration number format looks invalid for bank verification.',
            hint: 'Expected CIPC format like 2020/123456/07',
          },
          { status: 400 }
        );
      }
    } else {
      holderType = 'Individual';
      identityType = String(body.identityType || 'IDNumber');
      identityNumber = directorId || String(body.identityNumber || '').replace(/\s/g, '');
      if (!identityNumber || !isValidSaIdNumber(identityNumber)) {
        return NextResponse.json(
          {
            error:
              'Director SA ID number is required for individual bank verification (or add a company registration number).',
            hint: 'Fill Licenses & director → Director ID number, or Identity → Registration no.',
          },
          { status: 400 }
        );
      }
      if (!surname || !firstName) {
        // Split account_name or contact_name into first / last
        const full = accountName || String(profile.contact_name || '').trim();
        const parts = full.split(/\s+/).filter(Boolean);
        if (parts.length >= 2) {
          firstName = firstName || parts.slice(0, -1).join(' ');
          surname = surname || parts[parts.length - 1];
        } else if (parts.length === 1) {
          surname = surname || parts[0];
        }
      }
      if (!surname) {
        return NextResponse.json(
          {
            error: 'Account holder surname (or full account name) is required.',
          },
          { status: 400 }
        );
      }
    }

    if (!surname) {
      return NextResponse.json(
        {
          error: 'Account name / company legal name is required for bank verification.',
        },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const mode = body.mode === 'sandbox' ? 'sandbox' : undefined;

    const vn = await callVerifyNowBankAccount({
      type: holderType,
      firstName: firstName || undefined,
      surname,
      identityNumber,
      identityType,
      bankAccountNumber,
      bankBranchCode,
      bankName: bankName || undefined,
      bankAccountType,
      mode,
    });

    if (!vn.ok) {
      await persistBankVerification(supabase, companyId, profile, {
        status: 'failed',
        now,
        paystackReference,
        vnData: vn.data,
        parsed: null,
        error: vn.error || 'VerifyNow bank verification failed',
        bankAccountNumber,
        bankBranchCode,
        bankName,
        bankAccountType,
        holderType,
        identityNumber,
      });

      return NextResponse.json(
        {
          error: vn.error || 'VerifyNow bank verification failed',
          details: vn.data,
          hint:
            vn.status === 503
              ? 'Set VERIFYNOW_API_KEY in server env (from https://www.verifynow.co.za Settings)'
              : vn.status === 402
                ? 'Top up VerifyNow credits at verifynow.co.za'
                : vn.status === 429
                  ? 'Rate limited — wait a few seconds and retry'
                  : undefined,
        },
        { status: vn.status >= 400 ? vn.status : 502 }
      );
    }

    const parsed = parseVerifyNowBankResult(vn.data);
    const status: 'verified' | 'failed' = parsed.ok ? 'verified' : 'failed';

    const updated = await persistBankVerification(supabase, companyId, profile, {
      status,
      now,
      paystackReference,
      vnData: vn.data,
      parsed,
      error: null,
      bankAccountNumber,
      bankBranchCode,
      bankName,
      bankAccountType,
      holderType,
      identityNumber,
    });

    await logActivity({
      profile_id: companyId,
      actor_user_id: mem.userId,
      action: 'business.bank_verification_verifynow',
      entity_type: 'profiles',
      entity_id: String(companyId),
      summary:
        status === 'verified'
          ? `Bank account verified via VerifyNow AVS (${bankAccountNumber.slice(-4).padStart(bankAccountNumber.length, '•')})`
          : `VerifyNow bank check did not pass: ${parsed.statusText || parsed.summary}`,
      metadata: {
        provider: 'verifynow',
        service: 'bank-account-verification',
        requestId: parsed.requestId,
        status,
        paystackReference,
        amount_zar: BANK_VERIFY_AMOUNT_ZAR,
        holderType,
        identityMatch: parsed.identityMatch,
        accountFound: parsed.accountFound,
      },
    });

    return NextResponse.json({
      success: true,
      status,
      profile: updated.profile,
      verification: {
        provider: 'verifynow',
        service: 'bank-account-verification',
        requestId: parsed.requestId,
        mode: parsed.mode || mode || process.env.VERIFYNOW_MODE || 'production',
        summary: parsed.summary,
        statusText: parsed.statusText,
        identityAndAccountVerified: parsed.identityAndAccountVerified,
        accountFound: parsed.accountFound,
        accountOpen: parsed.accountOpen,
        identityMatch: parsed.identityMatch,
        accountTypeMatch: parsed.accountTypeMatch,
        acceptsCredits: parsed.acceptsCredits,
        acceptsDebits: parsed.acceptsDebits,
        bankReference: parsed.bankReference,
        remainingCredits: parsed.remainingCredits,
        holderType,
        amount_zar: BANK_VERIFY_AMOUNT_ZAR,
        paystackReference,
      },
      message:
        status === 'verified'
          ? `Bank account verified via VerifyNow: ${parsed.summary || 'OK'}`
          : `Bank verification did not pass: ${parsed.statusText || parsed.summary}`,
    });
  } catch (e: unknown) {
    console.error('business/verify-bank error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Bank verification failed' },
      { status: 500 }
    );
  }
}

async function persistBankVerification(
  supabase: ReturnType<typeof getSupabaseServer>,
  companyId: number,
  profile: { metadata?: unknown },
  opts: {
    status: 'verified' | 'failed' | 'pending';
    now: string;
    paystackReference: string;
    vnData: Record<string, unknown>;
    parsed: BankAccountVerificationResult | null;
    error: string | null;
    bankAccountNumber: string;
    bankBranchCode: string;
    bankName: string;
    bankAccountType: string;
    holderType: string;
    identityNumber: string;
  }
) {
  const isVerified = opts.status === 'verified';
  const metaBase =
    profile.metadata && typeof profile.metadata === 'object' && !Array.isArray(profile.metadata)
      ? (profile.metadata as Record<string, unknown>)
      : {};

  const bankVerificationMeta = {
    provider: 'verifynow',
    service: 'bank-account-verification',
    status: opts.status,
    verified_at: isVerified ? opts.now : null,
    checked_at: opts.now,
    paystack_reference: opts.paystackReference || null,
    amount_zar: BANK_VERIFY_AMOUNT_ZAR,
    request_id: opts.parsed?.requestId || null,
    summary: opts.parsed?.summary || null,
    status_text: opts.parsed?.statusText || null,
    identity_and_account_verified: opts.parsed?.identityAndAccountVerified ?? null,
    account_found: opts.parsed?.accountFound || null,
    account_open: opts.parsed?.accountOpen || null,
    identity_match: opts.parsed?.identityMatch || null,
    account_type_match: opts.parsed?.accountTypeMatch || null,
    accepts_credits: opts.parsed?.acceptsCredits || null,
    accepts_debits: opts.parsed?.acceptsDebits || null,
    bank_reference: opts.parsed?.bankReference || null,
    holder_type: opts.holderType,
    identity_number_last4: opts.identityNumber
      ? opts.identityNumber.slice(-4)
      : null,
    account_number_last4: opts.bankAccountNumber
      ? opts.bankAccountNumber.slice(-4)
      : null,
    branch_code: opts.bankBranchCode || null,
    bank_name: opts.bankName || null,
    account_type: opts.bankAccountType || null,
    error: opts.error,
    raw: opts.vnData,
  };

  const updates: Record<string, unknown> = {
    updated_at: opts.now,
    account_number: opts.bankAccountNumber || undefined,
    branch_code: opts.bankBranchCode || undefined,
    bank_name: opts.bankName || undefined,
    account_type: opts.bankAccountType || undefined,
    bank_verification_status: opts.status,
    bank_verified_at: isVerified ? opts.now : null,
    bank_verification_payment_ref: opts.paystackReference || null,
    metadata: {
      ...metaBase,
      bank_verification: bankVerificationMeta,
    },
  };

  // Drop undefined so we don't wipe empty
  for (const k of Object.keys(updates)) {
    if (updates[k] === undefined) delete updates[k];
  }

  let { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', companyId)
    .select(
      'id, trading_name, legal_name, bank_name, account_name, account_number, branch_code, account_type, bank_verification_status, bank_verified_at, bank_verification_payment_ref, metadata'
    )
    .single();

  // Fallback if new columns missing (migration not applied yet)
  if (error && /column|schema cache|does not exist/i.test(error.message || '')) {
    const fallback: Record<string, unknown> = {
      updated_at: opts.now,
      account_number: opts.bankAccountNumber || undefined,
      bank_name: opts.bankName || undefined,
      metadata: {
        ...metaBase,
        bank_verification: bankVerificationMeta,
      },
    };
    for (const k of Object.keys(fallback)) {
      if (fallback[k] === undefined) delete fallback[k];
    }
    const retry = await supabase
      .from('profiles')
      .update(fallback)
      .eq('id', companyId)
      .select('id, trading_name, legal_name, bank_name, account_name, account_number, metadata')
      .single();
    data = retry.data as typeof data;
    error = retry.error;
  }

  if (error) {
    console.error('persistBankVerification failed:', error.message);
  }

  return { profile: data, error };
}
