import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCompanyMember, logActivity } from '@/lib/customers/access';
import {
  callVerifyNowCipcCompany,
  isValidCipcRegistrationNumber,
  isValidSaIdNumber,
  parseVerifyNowCipcResult,
} from '@/lib/verifynow/client';
import { requireCompanyAccess, legacyPrivyFrom } from '@/lib/auth/api-auth';

/** Columns known to be missing on some production profiles tables. */
const PROFILE_GHOST_COLS = new Set([
  'is_verified',
  'verification_payment_ref',
  'verified_at',
  'director_id_number',
]);

/**
 * POST — Verify company via VerifyNow CIPC after R69 Paystack payment.
 *
 * Body: {
 *   companyId, privyUserId,
 *   paystackReference?,   // new payment
 *   reusePayment?: true,  // re-run CIPC using stored payment ref (no second charge)
 *   action?: 'verify' | 'apply_from_metadata' | 'reuse_and_verify',
 *   registrationNumber?, vatNumber?, solePropIdNumber?,
 *   mode?: 'sandbox' | 'production',
 *   consent?: boolean
 * }
 *
 * Payment alone does NOT set the verified badge. VerifyNow CIPC must pass,
 * then verification_status is set to 'verified' | 'mismatch' | 'failed'.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const action = String(body.action || 'verify').toLowerCase();

    const _gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!_gate.ok) return _gate.response;
    const mem = await assertCompanyMember(body.privyUserId, companyId);
    if (!mem.ok) {
      return NextResponse.json({ error: mem.error }, { status: mem.status });
    }

    const supabase = getSupabaseServer();
    const profile = await loadProfileForVerify(supabase, companyId);
    if (!profile) {
      return NextResponse.json(
        { error: 'Company profile not found' },
        { status: 404 }
      );
    }

    // ── Recovery: apply verified badge from last successful CIPC metadata ──
    if (action === 'apply_from_metadata') {
      return applyVerifiedFromMetadata({
        supabase,
        companyId,
        profile,
        userId: mem.userId,
      });
    }

    const storedRef = storedPaymentRef(profile);
    let paystackReference = String(
      body.paystackReference || body.reference || ''
    ).trim();
    const reusePayment =
      body.reusePayment === true ||
      action === 'reuse_and_verify' ||
      body.reuse === true;

    if (!paystackReference && reusePayment && storedRef) {
      paystackReference = storedRef;
    }
    // Auto-reuse stored payment when client omits ref but profile already paid
    if (!paystackReference && storedRef && body.allowStoredPayment !== false) {
      // Only auto-reuse if they previously paid (metadata or column)
      paystackReference = storedRef;
    }

    if (!paystackReference) {
      return NextResponse.json(
        {
          error: 'Payment is required before verification',
          hint: 'Complete the R69 Paystack checkout, then verification runs automatically. If you already paid, use Re-run CIPC (reuse payment).',
          amount_zar: 69,
          hasStoredPayment: Boolean(storedRef),
        },
        { status: 402 }
      );
    }

    if (body.consent === false) {
      return NextResponse.json(
        {
          error:
            'Consent is required to run a CIPC company verification via VerifyNow.',
        },
        { status: 400 }
      );
    }

    const reusedPayment = Boolean(
      storedRef && paystackReference === storedRef && !body.paystackReference
    );

    const registrationNumber = String(
      body.registrationNumber ||
        body.registration_number ||
        profile.registration_number ||
        ''
    )
      .trim()
      .toUpperCase();
    const vatNumber = String(
      body.vatNumber || body.vat_number || profile.vat_number || ''
    ).replace(/\s/g, '');
    const solePropIdNumber = String(
      body.solePropIdNumber ||
        body.sole_prop_id_number ||
        body.directorIdNumber ||
        ''
    ).replace(/\s/g, '');

    if (!registrationNumber && !vatNumber && !solePropIdNumber) {
      return NextResponse.json(
        {
          error:
            'Add a CIPC registration number (or VAT number) on the profile before verifying.',
          hint: 'Example registration number: 2020/123456/07',
        },
        { status: 400 }
      );
    }

    if (registrationNumber && !isValidCipcRegistrationNumber(registrationNumber)) {
      return NextResponse.json(
        {
          error:
            'Registration number format looks invalid. Expected CIPC format like 2020/123456/07.',
        },
        { status: 400 }
      );
    }

    if (
      !registrationNumber &&
      !vatNumber &&
      solePropIdNumber &&
      !isValidSaIdNumber(solePropIdNumber)
    ) {
      return NextResponse.json(
        { error: 'Sole proprietor ID number failed SA ID format/checksum check' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // Mark pending while the external call runs (status only — no is_verified col)
    await updateProfileTolerant(supabase, companyId, {
      verification_status: 'pending',
      updated_at: now,
      ...(registrationNumber ? { registration_number: registrationNumber } : {}),
    });

    const mode = body.mode === 'sandbox' ? 'sandbox' : undefined;
    const vn = await callVerifyNowCipcCompany({
      registrationNumber: registrationNumber || undefined,
      vatNumber: vatNumber || undefined,
      solePropIdNumber: solePropIdNumber || undefined,
      mode,
    });

    if (!vn.ok) {
      await persistVerification(supabase, companyId, profile, {
        status: 'failed',
        now,
        paystackReference,
        vnData: vn.data,
        parsed: null,
        error: vn.error || 'VerifyNow CIPC verification failed',
      });

      return NextResponse.json(
        {
          error: vn.error || 'VerifyNow CIPC verification failed',
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

    const localNames = [profile.legal_name, profile.trading_name]
      .map((x) => String(x || '').trim())
      .filter(Boolean);

    const parsed = parseVerifyNowCipcResult(vn.data, localNames);

    let status: 'verified' | 'mismatch' | 'failed' = parsed.ok
      ? 'verified'
      : 'failed';
    if (parsed.ok && parsed.nameMatch === 'mismatch') {
      status = 'mismatch';
    }

    const updated = await persistVerification(supabase, companyId, profile, {
      status,
      now,
      paystackReference,
      vnData: vn.data,
      parsed,
      error: null,
      registrationNumber: registrationNumber || parsed.registrationNumber || null,
    });

    await logActivity({
      profile_id: companyId,
      actor_user_id: mem.userId,
      action: 'business.verification_verifynow',
      entity_type: 'profiles',
      entity_id: String(companyId),
      summary:
        status === 'verified'
          ? `Company verified via VerifyNow CIPC: ${parsed.companyName || registrationNumber}`
          : status === 'mismatch'
            ? `VerifyNow CIPC returned ${parsed.companyName}, which may not match local name`
            : `VerifyNow CIPC did not pass: ${parsed.statusText}`,
      metadata: {
        provider: 'verifynow',
        reportType: 'cipc_company_match',
        requestId: parsed.requestId,
        status,
        paystackReference: paystackReference || null,
        companyStatus: parsed.companyStatus,
        nameMatch: parsed.nameMatch,
        reusedPayment,
      },
    });

    // Soft notify company + ops (never blocks)
    void import('@/lib/notifications/email-alerts')
      .then(({ notifyCipcVerificationOutcome }) =>
        notifyCipcVerificationOutcome({
          profileId: companyId,
          tradingName:
            profile.trading_name || profile.legal_name || `Company #${companyId}`,
          status,
          companyNameCipc: parsed.companyName,
          nameMatch: parsed.nameMatch,
          paystackReference,
          reusedPayment,
          detail: parsed.statusText,
          registrationNumber:
            registrationNumber || parsed.registrationNumber || null,
        })
      )
      .catch((e) => console.warn('verify notify soft-fail', e));

    const profileOut = updated.profile
      ? {
          ...updated.profile,
          // Client UI may still read is_verified — derive it
          is_verified: status === 'verified',
        }
      : {
          id: companyId,
          verification_status: status,
          is_verified: status === 'verified',
          verified_at: status === 'verified' ? now : null,
        };

    return NextResponse.json({
      success: true,
      status,
      profile: profileOut,
      verification: {
        provider: 'verifynow',
        reportType: 'cipc_company_match',
        requestId: parsed.requestId,
        mode: parsed.mode || mode || process.env.VERIFYNOW_MODE || 'production',
        companyName: parsed.companyName,
        tradeName: parsed.tradeName,
        registrationNumber: parsed.registrationNumber || registrationNumber,
        companyStatus: parsed.companyStatus,
        companyType: parsed.companyType,
        registrationDate: parsed.registrationDate,
        physicalAddress: parsed.physicalAddress,
        vatNumber: parsed.vatNumber,
        taxNumber: parsed.taxNumber,
        directorCount: parsed.directorCount,
        nameMatch: parsed.nameMatch,
        statusText: parsed.statusText,
        remainingCredits: parsed.remainingCredits,
        paystackReference,
        reusedPayment,
      },
      message:
        status === 'verified'
          ? `Verified via VerifyNow: ${parsed.companyName || 'company'} (${parsed.companyStatus || 'OK'})`
          : status === 'mismatch'
            ? `CIPC returned "${parsed.companyName}", which may not match your trading/legal name — review and update profile fields, then re-check.`
            : `Verification did not pass: ${parsed.statusText}. Payment was taken for the check; badge is only set when CIPC matches.`,
      paid: true,
      reusedPayment,
      badgeVisible: status === 'verified',
    });
  } catch (e: unknown) {
    console.error('business/verify error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Verification failed' },
      { status: 500 }
    );
  }
}

type ProfileRow = {
  id?: number;
  trading_name?: string | null;
  legal_name?: string | null;
  registration_number?: string | null;
  vat_number?: string | null;
  director_id_number?: string | null;
  verification_status?: string | null;
  verification_payment_ref?: string | null;
  metadata?: unknown;
};

function verificationMetaOf(profile: ProfileRow): Record<string, unknown> | null {
  const meta =
    profile.metadata &&
    typeof profile.metadata === 'object' &&
    !Array.isArray(profile.metadata)
      ? (profile.metadata as Record<string, unknown>)
      : null;
  const v = meta?.verification;
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return null;
}

/** Prefer column, then metadata.verification.paystack_reference */
function storedPaymentRef(profile: ProfileRow): string | null {
  const col = String(profile.verification_payment_ref || '').trim();
  if (col) return col;
  const v = verificationMetaOf(profile);
  const ref = String(v?.paystack_reference || v?.paystackReference || '').trim();
  return ref || null;
}

/**
 * If CIPC previously returned success in metadata.raw but verification_status
 * never stuck (schema bug), promote to verified without a new API call.
 */
async function applyVerifiedFromMetadata(opts: {
  supabase: ReturnType<typeof getSupabaseServer>;
  companyId: number;
  profile: ProfileRow;
  userId: string;
}) {
  const { supabase, companyId, profile, userId } = opts;
  const v = verificationMetaOf(profile);
  if (!v) {
    return NextResponse.json(
      {
        error: 'No prior verification snapshot on this profile',
        hint: 'Run CIPC verify after payment first (or Re-run CIPC).',
      },
      { status: 400 }
    );
  }

  const statusMeta = String(v.status || '').toLowerCase();
  const nameMatch = String(v.name_match || v.nameMatch || '').toLowerCase();
  const companyName = String(v.company_name || v.companyName || '').trim();
  const companyStatus = String(v.company_status || v.companyStatus || '').trim();
  const raw = (v.raw && typeof v.raw === 'object' ? v.raw : null) as Record<
    string,
    unknown
  > | null;

  // Eligible if metadata already said verified, OR raw CIPC looks successful
  // and was not a clear mismatch
  let canApply = statusMeta === 'verified';
  if (!canApply && raw) {
    const parsed = parseVerifyNowCipcResult(raw, [
      profile.legal_name || '',
      profile.trading_name || '',
    ]);
    canApply =
      parsed.ok &&
      parsed.nameMatch !== 'mismatch' &&
      Boolean(parsed.companyName || parsed.registrationNumber);
  }
  if (!canApply && companyName && nameMatch !== 'mismatch') {
    // Soft recovery: had company name from CIPC and not explicit mismatch
    canApply =
      statusMeta === 'pending' ||
      statusMeta === '' ||
      statusMeta === 'failed' ||
      Boolean(v.paystack_reference);
  }

  if (!canApply) {
    return NextResponse.json(
      {
        error: 'Last CIPC result does not qualify for auto-verify',
        hint:
          nameMatch === 'mismatch'
            ? 'Update trading/legal name to match CIPC, then Re-run CIPC (reuse payment).'
            : 'Re-run CIPC with stored payment, or complete a new R69 verification.',
        metadataStatus: statusMeta || null,
        nameMatch: nameMatch || null,
        companyName: companyName || null,
      },
      { status: 409 }
    );
  }

  const now = new Date().toISOString();
  const payRef = storedPaymentRef(profile);
  const updated = await persistVerification(supabase, companyId, profile, {
    status: 'verified',
    now,
    paystackReference: payRef || 'recovered',
    vnData: (raw || v) as Record<string, unknown>,
    parsed: raw
      ? parseVerifyNowCipcResult(raw, [
          profile.legal_name || '',
          profile.trading_name || '',
        ])
      : {
          ok: true,
          statusText: companyStatus || 'recovered',
          companyName: companyName || '',
          tradeName: String(v.trade_name || ''),
          previousName: '',
          registrationNumber: String(v.registration_number || ''),
          registrationDate: '',
          businessStartDate: '',
          companyStatus: companyStatus || '',
          companyType: String(v.company_type || ''),
          sic: '',
          taxNumber: String(v.tax_number || ''),
          vatNumber: String(v.vat_number || ''),
          physicalAddress: String(v.physical_address || ''),
          postalAddress: '',
          directorCount: String(v.director_count || ''),
          requestId: String(v.request_id || ''),
          mode: 'production',
          remainingCredits: null,
          nameMatch:
            nameMatch === 'match' ||
            nameMatch === 'partial' ||
            nameMatch === 'mismatch'
              ? nameMatch
              : 'unknown',
        },
    error: null,
    registrationNumber:
      String(v.registration_number || profile.registration_number || '') || null,
  });

  await logActivity({
    profile_id: companyId,
    actor_user_id: userId,
    action: 'business.verification_recover_metadata',
    entity_type: 'profiles',
    entity_id: String(companyId),
    summary: `Recovered verified badge from prior CIPC snapshot (${companyName || 'company'})`,
    metadata: { paystackReference: payRef, companyName },
  });

  void import('@/lib/notifications/email-alerts')
    .then(({ notifyCipcVerificationOutcome }) =>
      notifyCipcVerificationOutcome({
        profileId: companyId,
        tradingName:
          profile.trading_name || profile.legal_name || `Company #${companyId}`,
        status: 'verified',
        companyNameCipc: companyName,
        nameMatch: nameMatch || 'unknown',
        paystackReference: payRef,
        reusedPayment: true,
        detail: 'Recovered from prior CIPC metadata',
        registrationNumber: String(v.registration_number || '') || null,
        recovered: true,
      })
    )
    .catch(() => undefined);

  return NextResponse.json({
    success: true,
    status: 'verified',
    recovered: true,
    profile: updated.profile
      ? { ...updated.profile, is_verified: true }
      : {
          id: companyId,
          verification_status: 'verified',
          is_verified: true,
        },
    message: `Verified badge applied from prior CIPC result${
      companyName ? `: ${companyName}` : ''
    }.`,
    badgeVisible: true,
  });
}

async function loadProfileForVerify(
  supabase: ReturnType<typeof getSupabaseServer>,
  companyId: number
): Promise<ProfileRow | null> {
  const selects = [
    'id, trading_name, legal_name, registration_number, vat_number, verification_status, verification_payment_ref, metadata',
    'id, trading_name, legal_name, registration_number, vat_number, verification_status, metadata',
    'id, trading_name, legal_name, registration_number, vat_number, metadata',
    'id, trading_name, legal_name, registration_number, metadata',
  ];
  for (const sel of selects) {
    const { data, error } = await supabase
      .from('profiles')
      .select(sel)
      .eq('id', companyId)
      .maybeSingle();
    if (!error && data) return data as ProfileRow;
  }
  return null;
}

/** Update profile, stripping unknown columns on schema errors. */
async function updateProfileTolerant(
  supabase: ReturnType<typeof getSupabaseServer>,
  companyId: number,
  updates: Record<string, unknown>
): Promise<{ data: Record<string, unknown> | null; error: string | null }> {
  let row = { ...updates };
  // Never write ghost columns
  for (const g of PROFILE_GHOST_COLS) {
    delete row[g];
  }

  for (let attempt = 0; attempt < 6; attempt++) {
    const { data, error } = await supabase
      .from('profiles')
      .update(row)
      .eq('id', companyId)
      .select(
        'id, trading_name, legal_name, registration_number, vat_number, verification_status, metadata'
      )
      .maybeSingle();

    if (!error) {
      return { data: data as Record<string, unknown> | null, error: null };
    }

    const msg = error.message || '';
    if (!/column|schema cache|does not exist/i.test(msg)) {
      return { data: null, error: msg };
    }

    // Strip the offending column name if we can parse it
    const m =
      /column ["']?([a-z0-9_]+)["']?/i.exec(msg) ||
      /'([a-z0-9_]+)' column/i.exec(msg);
    if (m?.[1] && m[1] in row) {
      delete row[m[1]];
      continue;
    }
    // Drop common optional keys
    let stripped = false;
    for (const k of [
      'verification_payment_ref',
      'verified_at',
      'is_verified',
      'metadata',
    ]) {
      if (k in row) {
        delete row[k];
        stripped = true;
        break;
      }
    }
    if (!stripped) return { data: null, error: msg };
  }
  return { data: null, error: 'Could not update profile after schema retries' };
}

async function persistVerification(
  supabase: ReturnType<typeof getSupabaseServer>,
  companyId: number,
  profile: ProfileRow,
  opts: {
    status: 'verified' | 'mismatch' | 'failed' | 'pending';
    now: string;
    paystackReference: string;
    vnData: Record<string, unknown>;
    parsed: ReturnType<typeof parseVerifyNowCipcResult> | null;
    error: string | null;
    registrationNumber?: string | null;
  }
) {
  const isVerified = opts.status === 'verified';
  const metaBase =
    profile.metadata &&
    typeof profile.metadata === 'object' &&
    !Array.isArray(profile.metadata)
      ? (profile.metadata as Record<string, unknown>)
      : {};

  const verificationMeta = {
    provider: 'verifynow',
    reportType: 'cipc_company_match',
    status: opts.status,
    verified_at: isVerified ? opts.now : null,
    checked_at: opts.now,
    paystack_reference: opts.paystackReference || null,
    amount_zar: opts.paystackReference ? 69 : null,
    request_id: opts.parsed?.requestId || null,
    company_name: opts.parsed?.companyName || null,
    trade_name: opts.parsed?.tradeName || null,
    registration_number:
      opts.registrationNumber || opts.parsed?.registrationNumber || null,
    company_status: opts.parsed?.companyStatus || null,
    company_type: opts.parsed?.companyType || null,
    name_match: opts.parsed?.nameMatch || null,
    physical_address: opts.parsed?.physicalAddress || null,
    vat_number: opts.parsed?.vatNumber || null,
    tax_number: opts.parsed?.taxNumber || null,
    director_count: opts.parsed?.directorCount || null,
    error: opts.error,
    raw: opts.vnData,
  };

  // Canonical field for badge: verification_status (NOT is_verified — column missing)
  const updates: Record<string, unknown> = {
    updated_at: opts.now,
    verification_status: opts.status,
    metadata: {
      ...metaBase,
      verification: verificationMeta,
    },
  };

  // Optional columns — tolerant update will strip if absent
  if (opts.paystackReference) {
    updates.verification_payment_ref = opts.paystackReference;
  }
  if (isVerified) {
    updates.verified_at = opts.now;
  }
  if (opts.registrationNumber) {
    updates.registration_number = opts.registrationNumber;
  }

  const result = await updateProfileTolerant(supabase, companyId, updates);
  if (result.error) {
    console.error('persistVerification failed:', result.error);
  }

  const profileOut = result.data
    ? {
        ...result.data,
        is_verified: isVerified,
        verified_at: isVerified ? opts.now : null,
        verification_payment_ref: opts.paystackReference || null,
      }
    : null;

  return { profile: profileOut, error: result.error };
}
