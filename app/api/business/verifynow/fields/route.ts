import { NextRequest, NextResponse } from 'next/server';
import { legacyPrivyFrom, requireCompanyPermission } from '@/lib/auth/api-auth';
import { logActivity } from '@/lib/customers/access';
import { canAccess } from '@/lib/business/permissions';
import { rateLimit } from '@/lib/http/rate-limit';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  callVerifyNowAmlScreening,
  callVerifyNowBankAccount,
  callVerifyNowBusinessBank,
  callVerifyNowCipcCompany,
  callVerifyNowCipcDirectorSearch,
  callVerifyNowSaid,
  getVerifyNowBusinessBankJob,
  isVerifyNowConfigured,
  resolveMode,
} from '@/lib/verifynow/client';
import {
  DIRECT_VAT_CHECK,
  FIELD_META_KEY,
  SUPPLIER_BUNDLE_NOTE,
  VAT_CHECK_NOTE,
  VERIFYNOW_FIELD_PRODUCTS,
  applyBankWebhook,
  fieldIdempotencyKey,
  formatZar,
  isAsyncBusinessBank,
  isReplayable,
  mergeFieldMetadata,
  publicTrustFromFields,
  readFieldChecks,
  readPublicTrust,
  summariseAml,
  summariseBank,
  summariseCompanyMatch,
  summariseDirectorSearch,
  summariseSaId,
  supplierBundlePrice,
  type FieldCheckId,
  type FieldCheckSummary,
} from '@/lib/verifynow/company-checks';

const CHECKS = new Set<FieldCheckId>([
  'cipc_company_match',
  'cipc_director_search',
  'said_verification',
  'bank_account',
  'aml_pep',
  'supplier_bundle',
]);

type ProfileRow = Record<string, unknown>;

function text(row: ProfileRow, key: string): string {
  const value = row[key];
  return value == null ? '' : String(value).trim();
}

function webhookUrl(): string | null {
  const explicit = process.env.VERIFYNOW_WEBHOOK_URL?.trim();
  if (explicit) return explicit;
  const site = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    ''
  ).replace(/\/$/, '');
  if (site) return `${site}/api/webhooks/verifynow`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}/api/webhooks/verifynow`;
  return null;
}

function productList(asyncBank: boolean) {
  const bank = asyncBank
    ? VERIFYNOW_FIELD_PRODUCTS.business_bank_account
    : VERIFYNOW_FIELD_PRODUCTS.bank_account;
  const bundle = supplierBundlePrice(asyncBank);
  return {
    directVatCheck: DIRECT_VAT_CHECK,
    vatNote: VAT_CHECK_NOTE,
    supplierBundleNote: SUPPLIER_BUNDLE_NOTE,
    supplierBundle: {
      availableAsSingleApi: false,
      credits: bundle.credits,
      priceExclVatZar: bundle.priceExclVatZar,
      priceLabel: formatZar(bundle.priceExclVatZar),
    },
    catalogue: [
      VERIFYNOW_FIELD_PRODUCTS.cipc_company_match,
      VERIFYNOW_FIELD_PRODUCTS.cipc_director_search,
      VERIFYNOW_FIELD_PRODUCTS.said_verification,
      bank,
      VERIFYNOW_FIELD_PRODUCTS.aml_pep,
    ].map((product) => ({
      ...product,
      priceLabel: formatZar(product.priceExclVatZar),
    })),
  };
}

async function loadProfile(companyId: number): Promise<ProfileRow | null> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', companyId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ProfileRow) || null;
}

async function saveMetadata(companyId: number, metadata: Record<string, unknown>) {
  const supabase = getSupabaseServer();
  const { error } = await supabase
    .from('profiles')
    .update({ metadata, updated_at: new Date().toISOString() })
    .eq('id', companyId);
  if (error) throw new Error(error.message);
}

function inputKey(
  check: FieldCheckId,
  profile: ProfileRow,
  mode: string,
  asyncBank: boolean
): string {
  const reg = text(profile, 'registration_number').toUpperCase();
  const id = text(profile, 'director_id_number').replace(/\D/g, '');
  const legal = text(profile, 'legal_name').toLowerCase();
  const trading = text(profile, 'trading_name').toLowerCase();
  const vat = text(profile, 'vat_number').replace(/\D/g, '');
  const contact = text(profile, 'contact_name').toLowerCase();
  const account = text(profile, 'account_number').replace(/\D/g, '');
  const branch = text(profile, 'branch_code').replace(/\D/g, '');
  const bank = text(profile, 'bank_name').toLowerCase();
  const address = [text(profile, 'address'), text(profile, 'street'), text(profile, 'city')]
    .join(' ')
    .toLowerCase();
  if (check === 'cipc_company_match') {
    return fieldIdempotencyKey([mode, check, reg, legal, trading, address, id, contact]);
  }
  if (check === 'cipc_director_search') {
    return fieldIdempotencyKey([mode, check, id, reg, vat]);
  }
  if (check === 'said_verification') {
    return fieldIdempotencyKey([mode, check, id, contact]);
  }
  if (check === 'aml_pep') {
    return fieldIdempotencyKey([mode, check, id, contact]);
  }
  if (check === 'bank_account') {
    return fieldIdempotencyKey([
      mode,
      check,
      reg,
      legal,
      account,
      branch,
      bank,
      asyncBank ? 'async' : 'realtime',
    ]);
  }
  return fieldIdempotencyKey([mode, check, reg, id, account, branch, asyncBank ? 'async' : 'realtime']);
}

export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyPermission(request, companyId, 'verification', 'view', {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const profile = await loadProfile(companyId);
    if (!profile) return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    const asyncBank = isAsyncBusinessBank(text(profile, 'bank_name'), text(profile, 'branch_code'));
    return NextResponse.json({
      configured: isVerifyNowConfigured(),
      mode: resolveMode(),
      canRun: canAccess(gate.role, 'verification', 'admin'),
      checks: readFieldChecks(profile.metadata),
      publicTrust: readPublicTrust(profile.metadata),
      asyncBank,
      ...productList(asyncBank),
      disabledReason: isVerifyNowConfigured()
        ? null
        : 'VERIFYNOW_API_KEY is not configured on this server, so checks stay off.',
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not load checks' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: 'JSON body required' }, { status: 400 });
    const companyId = Number(body.companyId);
    const check = String(body.check || '') as FieldCheckId;
    if (!CHECKS.has(check)) {
      return NextResponse.json({ error: 'Unknown check' }, { status: 400 });
    }
    const gate = await requireCompanyPermission(request, companyId, 'verification', 'admin', {
      legacyPrivyUserId: legacyPrivyFrom(request, body),
    });
    if (!gate.ok) return gate.response;
    if (!isVerifyNowConfigured()) {
      return NextResponse.json(
        {
          configured: false,
          error: 'VERIFYNOW_API_KEY is not configured on the server',
        },
        { status: 503 }
      );
    }

    const limited = rateLimit(`verifynow-fields:${companyId}`, {
      limit: 12,
      windowMs: 10 * 60 * 1000,
    });
    if (!limited.ok) {
      return NextResponse.json(
        { error: 'Too many verification attempts. Wait before trying again.' },
        { status: 429, headers: { 'Retry-After': String(limited.retryAfterSec) } }
      );
    }

    const profile = await loadProfile(companyId);
    if (!profile) return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    const mode = resolveMode();
    const asyncBank = isAsyncBusinessBank(text(profile, 'bank_name'), text(profile, 'branch_code'));

    if (body.action === 'refresh' && check === 'bank_account') {
      const existing = readFieldChecks(profile.metadata).bank_account;
      const jobId = existing?.job_id;
      if (!jobId) {
        return NextResponse.json({ error: 'No bank job to refresh' }, { status: 404 });
      }
      const job = await getVerifyNowBusinessBankJob(jobId);
      if (!job.ok) {
        return NextResponse.json({ error: job.error || 'Could not read the bank job' }, { status: job.status });
      }
      const summary = applyBankWebhook(
        existing,
        {
          type:
            job.data.status === 'failed'
              ? 'business_bank.verification.failed'
              : 'business_bank.verification.completed',
          data: job.data,
        },
        new Date().toISOString()
      );
      if (job.data.status === 'pending' || job.data.status === 'processing') {
        summary.status = 'pending';
      }
      const trust = publicTrustFromFields({ ...readFieldChecks(profile.metadata), bank_account: summary });
      await saveMetadata(companyId, mergeFieldMetadata(profile.metadata, summary, trust, jobId));
      return NextResponse.json({ summary, replayed: false, refreshed: true });
    }

    const purpose = String(body.purpose || '').trim();
    if (body.consent !== true) {
      return NextResponse.json(
        { error: 'POPIA consent is required before this check runs.' },
        { status: 400 }
      );
    }
    if (purpose.length < 10) {
      return NextResponse.json(
        { error: 'Add the purpose for this check before it runs.' },
        { status: 400 }
      );
    }

    if (check === 'supplier_bundle') {
      const registration = text(profile, 'registration_number');
      const directorId = text(profile, 'director_id_number').replace(/\D/g, '');
      const account = text(profile, 'account_number').replace(/\D/g, '');
      const branch = text(profile, 'branch_code').replace(/\D/g, '');
      if (!registration || directorId.length !== 13 || !text(profile, 'contact_name')) {
        return NextResponse.json(
          {
            error:
              'Supplier bundle needs a CIPC number, a 13-digit director SA ID, and the director name in the contact name field.',
          },
          { status: 400 }
        );
      }
      if (!text(profile, 'legal_name') || account.length < 7 || branch.length !== 6) {
        return NextResponse.json(
          {
            error:
              'Supplier bundle needs the registered legal name, account number and 6-digit branch code.',
          },
          { status: 400 }
        );
      }
      if (asyncBank) {
        const url = webhookUrl();
        const secret = process.env.VERIFYNOW_WEBHOOK_SECRET?.trim() || '';
        if (!url || secret.length < 32) {
          return NextResponse.json(
            {
              error:
                'Capitec Business and Mercantile need VERIFYNOW_WEBHOOK_SECRET (32+ characters) and a public site URL before the bundle can include that bank check.',
            },
            { status: 503 }
          );
        }
      }
      const quoted = supplierBundlePrice(asyncBank);
      const parts: FieldCheckId[] = [
        'cipc_company_match',
        'cipc_director_search',
        'aml_pep',
        'bank_account',
      ];
      const stored = readFieldChecks(profile.metadata);
      const ran: FieldCheckSummary[] = [];
      let metadata = (profile.metadata as Record<string, unknown>) || {};
      for (const part of parts) {
        const outcome = await runOne({
          check: part,
          profile: { ...profile, metadata },
          mode,
          asyncBank,
          purpose,
          userId: gate.userId,
          companyId,
        });
        if (!outcome.ok) {
          return NextResponse.json(outcome.body, { status: outcome.status });
        }
        ran.push(outcome.summary);
        metadata = outcome.metadata;
      }
      const statuses = ran.map((row) => row.status);
      const bundleStatus: FieldCheckSummary['status'] = statuses.every((status) =>
        ['match', 'verified', 'clear'].includes(status)
      )
        ? 'match'
        : statuses.some((status) => status === 'pending')
          ? 'pending'
          : statuses.some((status) => ['mismatch', 'review', 'failed'].includes(status))
            ? 'review'
            : 'error';
      const summary: FieldCheckSummary = {
        check: 'supplier_bundle',
        status: bundleStatus,
        source: 'verifynow',
        checked_at: new Date().toISOString(),
        request_id: null,
        job_id: ran.find((row) => row.job_id)?.job_id || null,
        mode,
        price_excl_vat_zar: quoted.priceExclVatZar,
        credits: quoted.credits,
        purpose,
        consent_at: new Date().toISOString(),
        idempotency_key: inputKey('supplier_bundle', profile, mode, asyncBank),
        subject_masked: null,
        matches: {},
        detail: SUPPLIER_BUNDLE_NOTE,
      };
      const trust = publicTrustFromFields({
        ...stored,
        ...(Object.fromEntries(ran.map((row) => [row.check, row])) as Partial<
          Record<FieldCheckId, FieldCheckSummary>
        >),
      });
      await saveMetadata(companyId, mergeFieldMetadata(metadata, summary, trust, summary.job_id));
      return NextResponse.json({
        summary,
        components: ran,
        replayed: false,
        directVatCheck: DIRECT_VAT_CHECK,
      });
    }

    const outcome = await runOne({
      check,
      profile,
      mode,
      asyncBank,
      purpose,
      userId: gate.userId,
      companyId,
    });
    if (!outcome.ok) return NextResponse.json(outcome.body, { status: outcome.status });
    return NextResponse.json({
      summary: outcome.summary,
      replayed: outcome.replayed,
      directVatCheck: DIRECT_VAT_CHECK,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Verification failed' },
      { status: 500 }
    );
  }
}

async function runOne(opts: {
  check: Exclude<FieldCheckId, 'supplier_bundle'>;
  profile: ProfileRow;
  mode: 'sandbox' | 'production';
  asyncBank: boolean;
  purpose: string;
  userId: string;
  companyId: number;
}): Promise<
  | { ok: true; summary: FieldCheckSummary; replayed: boolean; metadata: Record<string, unknown> }
  | { ok: false; status: number; body: Record<string, unknown> }
> {
  const key = inputKey(opts.check, opts.profile, opts.mode, opts.asyncBank);
  const existing = readFieldChecks(opts.profile.metadata)[opts.check];
  if (isReplayable(existing, key)) {
    return {
      ok: true,
      summary: existing as FieldCheckSummary,
      replayed: true,
      metadata: (opts.profile.metadata as Record<string, unknown>) || {},
    };
  }

  const now = new Date().toISOString();
  const registration = text(opts.profile, 'registration_number');
  const directorId = text(opts.profile, 'director_id_number').replace(/\D/g, '');
  const contact = text(opts.profile, 'contact_name');
  const legal = text(opts.profile, 'legal_name');
  let summary: FieldCheckSummary;

  if (opts.check === 'cipc_company_match') {
    if (!registration) {
      return { ok: false, status: 400, body: { error: 'Add a CIPC registration number first.' } };
    }
    const called = await callVerifyNowCipcCompany({
      registrationNumber: registration,
      mode: opts.mode,
      idempotencyKey: key,
    });
    if (!called.ok) return { ok: false, status: called.status, body: { error: called.error } };
    summary = summariseCompanyMatch({
      payload: called.data,
      legalName: legal,
      tradingName: text(opts.profile, 'trading_name'),
      addressParts: [text(opts.profile, 'address'), text(opts.profile, 'street'), text(opts.profile, 'city'), text(opts.profile, 'province')],
      directorId,
      directorName: contact,
      profileVat: text(opts.profile, 'vat_number'),
      mode: opts.mode,
      purpose: opts.purpose,
      consentAt: now,
      idempotencyKey: key,
      price: VERIFYNOW_FIELD_PRODUCTS.cipc_company_match.priceExclVatZar,
      credits: VERIFYNOW_FIELD_PRODUCTS.cipc_company_match.credits,
      checkedAt: now,
    });
  } else if (opts.check === 'cipc_director_search') {
    if (directorId.length !== 13) {
      return { ok: false, status: 400, body: { error: 'Add the director SA ID on the profile first.' } };
    }
    const called = await callVerifyNowCipcDirectorSearch({
      idNumber: directorId,
      mode: opts.mode,
      idempotencyKey: key,
    });
    if (!called.ok) return { ok: false, status: called.status, body: { error: called.error } };
    summary = summariseDirectorSearch({
      payload: called.data,
      profileVat: text(opts.profile, 'vat_number'),
      registrationNumber: registration,
      directorId,
      mode: opts.mode,
      purpose: opts.purpose,
      consentAt: now,
      idempotencyKey: key,
      checkedAt: now,
    });
  } else if (opts.check === 'said_verification') {
    if (directorId.length !== 13) {
      return { ok: false, status: 400, body: { error: 'Add the director SA ID on the profile first.' } };
    }
    const called = await callVerifyNowSaid({
      idNumber: directorId,
      mode: opts.mode,
      idempotencyKey: key,
    });
    if (!called.ok) return { ok: false, status: called.status, body: { error: called.error } };
    summary = summariseSaId({
      payload: called.data,
      directorName: contact,
      directorId,
      mode: opts.mode,
      purpose: opts.purpose,
      consentAt: now,
      idempotencyKey: key,
      checkedAt: now,
    });
  } else if (opts.check === 'aml_pep') {
    if (!contact) {
      return {
        ok: false,
        status: 400,
        body: { error: 'Add the director name as the company contact name before AML screening.' },
      };
    }
    const called = await callVerifyNowAmlScreening({
      name: contact,
      mode: opts.mode,
      idempotencyKey: key,
    });
    if (!called.ok) return { ok: false, status: called.status, body: { error: called.error } };
    summary = summariseAml({
      payload: called.data,
      directorId,
      mode: opts.mode,
      purpose: opts.purpose,
      consentAt: now,
      idempotencyKey: key,
      checkedAt: now,
    });
  } else {
    const account = text(opts.profile, 'account_number').replace(/\D/g, '');
    const branch = text(opts.profile, 'branch_code').replace(/\D/g, '');
    const accountType = text(opts.profile, 'account_type') || 'Current';
    if (!legal || !registration || account.length < 7 || branch.length !== 6) {
      return {
        ok: false,
        status: 400,
        body: {
          error:
            'Company bank checks need the registered legal name, CIPC number, account number and 6-digit branch code.',
        },
      };
    }
    const price = opts.asyncBank
      ? VERIFYNOW_FIELD_PRODUCTS.business_bank_account
      : VERIFYNOW_FIELD_PRODUCTS.bank_account;
    if (opts.asyncBank) {
      const url = webhookUrl();
      const secret = process.env.VERIFYNOW_WEBHOOK_SECRET?.trim() || '';
      if (!url || secret.length < 32) {
        return {
          ok: false,
          status: 503,
          body: {
            error:
              'Capitec Business and Mercantile need VERIFYNOW_WEBHOOK_SECRET (32+ characters) and a public site URL for the signed webhook.',
          },
        };
      }
      const called = await callVerifyNowBusinessBank({
        companyName: legal,
        registrationNumber: registration,
        bankName: text(opts.profile, 'bank_name'),
        bankAccountNumber: account,
        bankBranchCode: branch,
        bankAccountType: accountType,
        purpose: opts.purpose,
        webhookUrl: url,
        webhookSecret: secret,
        mode: opts.mode,
        idempotencyKey: key,
      });
      if (!called.ok) return { ok: false, status: called.status, body: { error: called.error } };
      summary = summariseBank({
        payload: called.data,
        accountNumber: account,
        asyncJob: true,
        mode: opts.mode,
        purpose: opts.purpose,
        consentAt: now,
        idempotencyKey: key,
        checkedAt: now,
        price: price.priceExclVatZar,
        credits: price.credits,
      });
    } else {
      const called = await callVerifyNowBankAccount({
        type: 'Company',
        surname: legal,
        identityNumber: registration,
        identityType: 'CompanyRegNumber',
        bankName: text(opts.profile, 'bank_name'),
        bankAccountNumber: account,
        bankBranchCode: branch,
        bankAccountType: accountType,
        mode: opts.mode,
        idempotencyKey: key,
      });
      if (!called.ok) return { ok: false, status: called.status, body: { error: called.error } };
      summary = summariseBank({
        payload: called.data,
        accountNumber: account,
        asyncJob: false,
        mode: opts.mode,
        purpose: opts.purpose,
        consentAt: now,
        idempotencyKey: key,
        checkedAt: now,
        price: price.priceExclVatZar,
        credits: price.credits,
      });
    }
  }

  const fields = { ...readFieldChecks(opts.profile.metadata), [summary.check]: summary };
  const trust = publicTrustFromFields(fields);
  const metadata = mergeFieldMetadata(opts.profile.metadata, summary, trust, summary.job_id);
  await saveMetadata(opts.companyId, metadata);
  void logActivity({
    profile_id: opts.companyId,
    actor_user_id: opts.userId,
    action: 'business.verifynow_field_check',
    entity_type: 'profile',
    entity_id: String(opts.companyId),
    summary: `VerifyNow ${summary.check} ${summary.status}`,
    metadata: { check: summary.check, status: summary.status, source: 'verifynow' },
  });
  return { ok: true, summary, replayed: false, metadata };
}

export const FIELD_CHECKS_META = FIELD_META_KEY;
