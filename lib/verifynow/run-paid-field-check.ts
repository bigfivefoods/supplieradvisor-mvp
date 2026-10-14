/**
 * Run a company-profile VerifyNow check only after Paystack has verified the payment.
 * The browser callback and the Paystack webhook both call this, so one reference
 * cannot start a second provider charge.
 */
import { logActivity } from '@/lib/customers/access';
import { refundPaystackTransaction, verifyPaystackTransaction } from '@/lib/billing/paystack';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  callVerifyNowAmlScreening,
  callVerifyNowBankAccount,
  callVerifyNowBusinessBank,
  callVerifyNowCipcCompany,
  callVerifyNowCipcDirectorSearch,
  callVerifyNowSaid,
  getVerifyNowBusinessBankJob,
  resolveMode,
} from '@/lib/verifynow/client';
import {
  DIRECT_VAT_CHECK,
  SUPPLIER_BUNDLE_NOTE,
  applyBankWebhook,
  fieldIdempotencyKey,
  isAsyncBusinessBank,
  mergeFieldMetadata,
  publicTrustFromFields,
  readFieldChecks,
  summariseAml,
  summariseBank,
  summariseCompanyMatch,
  summariseDirectorSearch,
  summariseSaId,
  supplierBundlePrice,
  type FieldCheckId,
  type FieldCheckSummary,
} from '@/lib/verifynow/company-checks';
import {
  decideComponent,
  decidePaidCheck,
  type StoredPayment,
} from '@/lib/verifynow/pay-then-check';
import { customerPriceFor, type CustomerPrice, type PricedCheck } from '@/lib/verifynow/prices';

type ProfileRow = Record<string, unknown>;

export type FulfillResult = {
  httpStatus: number;
  body: Record<string, unknown>;
};

type Receipt = {
  reference: string;
  amountCents: number;
  amountZar: number;
  paidAt: string | null;
};

const PARTS: Array<Exclude<FieldCheckId, 'supplier_bundle'>> = [
  'cipc_company_match',
  'cipc_director_search',
  'aml_pep',
  'bank_account',
];

function text(row: ProfileRow, key: string): string {
  const value = row[key];
  return value == null ? '' : String(value).trim();
}

function webhookUrl(): string | null {
  const explicit = process.env.VERIFYNOW_WEBHOOK_URL?.trim();
  if (explicit) return explicit;
  const site = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || '').replace(
    /\/$/,
    ''
  );
  if (site) return `${site}/api/webhooks/verifynow`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}/api/webhooks/verifynow`;
  return null;
}

async function loadProfile(companyId: number): Promise<ProfileRow | null> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase.from('profiles').select('*').eq('id', companyId).maybeSingle();
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
  asyncBank: boolean,
  paystackReference: string
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
  const head = [paystackReference, mode, check];
  if (check === 'cipc_company_match') {
    return fieldIdempotencyKey([...head, reg, legal, trading, address, id, contact]);
  }
  if (check === 'cipc_director_search') {
    return fieldIdempotencyKey([...head, id, reg, vat]);
  }
  if (check === 'said_verification' || check === 'aml_pep') {
    return fieldIdempotencyKey([...head, id, contact]);
  }
  if (check === 'bank_account') {
    return fieldIdempotencyKey([
      ...head,
      reg,
      legal,
      account,
      branch,
      bank,
      asyncBank ? 'async' : 'realtime',
    ]);
  }
  return fieldIdempotencyKey([...head, reg, id, account, branch, asyncBank ? 'async' : 'realtime']);
}

function withReceipt(
  summary: FieldCheckSummary,
  receipt: Receipt,
  partOf?: 'supplier_bundle' | null
): FieldCheckSummary {
  return {
    ...summary,
    paystack_reference: receipt.reference,
    amount_cents: receipt.amountCents,
    amount_zar: receipt.amountZar,
    currency: 'ZAR',
    paid_at: receipt.paidAt,
    payment_status: 'paid',
    part_of: partOf ?? summary.part_of ?? null,
  };
}

function errorShell(opts: {
  check: FieldCheckId;
  mode: 'sandbox' | 'production';
  purpose: string;
  detail: string;
  idempotencyKey: string;
  providerAttempted: boolean;
  price: CustomerPrice;
}): FieldCheckSummary {
  const now = new Date().toISOString();
  return {
    check: opts.check,
    status: 'error',
    source: 'verifynow',
    checked_at: now,
    request_id: null,
    job_id: null,
    mode: opts.mode,
    price_excl_vat_zar: opts.price.costExclVatZar,
    credits: opts.price.credits,
    purpose: opts.purpose,
    consent_at: now,
    idempotency_key: opts.idempotencyKey,
    provider_attempted: opts.providerAttempted,
    subject_masked: null,
    matches: {},
    detail: opts.detail,
  };
}

function asStored(summary: FieldCheckSummary | undefined): StoredPayment | null {
  if (!summary) return null;
  return summary;
}

export async function fulfillPaidFieldCheck(opts: {
  companyId: number;
  check: FieldCheckId;
  action?: 'run' | 'refund' | 'refresh';
  paystackReference?: string;
  purpose?: string;
  consent?: boolean;
  userId: string;
}): Promise<FulfillResult> {
  const profile = await loadProfile(opts.companyId);
  if (!profile) return { httpStatus: 404, body: { error: 'Company not found' } };
  const mode = resolveMode();
  const asyncBank = isAsyncBusinessBank(text(profile, 'bank_name'), text(profile, 'branch_code'));
  const action = opts.action || 'run';

  if (action === 'refresh') {
    if (opts.check !== 'bank_account') {
      return { httpStatus: 400, body: { error: 'Only a bank check can be refreshed.' } };
    }
    const existing = readFieldChecks(profile.metadata).bank_account;
    const jobId = existing?.job_id;
    if (!jobId) return { httpStatus: 404, body: { error: 'No bank job to refresh' } };
    const job = await getVerifyNowBusinessBankJob(jobId);
    if (!job.ok) {
      return { httpStatus: job.status, body: { error: job.error || 'Could not read the bank job' } };
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
    if (job.data.status === 'pending' || job.data.status === 'processing') summary.status = 'pending';
    const trust = publicTrustFromFields({ ...readFieldChecks(profile.metadata), bank_account: summary });
    await saveMetadata(opts.companyId, mergeFieldMetadata(profile.metadata, summary, trust, jobId));
    return { httpStatus: 200, body: { summary, replayed: false, refreshed: true } };
  }

  const reference = String(opts.paystackReference || '').trim();
  const purpose = String(opts.purpose || '').trim();
  const price = customerPriceFor(opts.check as PricedCheck, asyncBank);
  const existing = readFieldChecks(profile.metadata)[opts.check];
  const freshKey = reference
    ? inputKey(opts.check, profile, mode, asyncBank, reference)
    : '';

  if (action === 'refund') {
    const decision = decidePaidCheck({
      intent: 'refund',
      reference,
      companyId: opts.companyId,
      check: opts.check as PricedCheck,
      asyncBank,
      paidAmountCents: null,
      existing: asStored(existing),
      freshIdempotencyKey: freshKey,
    });
    if (decision.action === 'reject') {
      return { httpStatus: decision.httpStatus, body: { error: decision.error } };
    }
    if (decision.action !== 'refund') {
      return { httpStatus: 409, body: { error: 'This reference cannot be refunded.' } };
    }
    const refunded = await refundPaystackTransaction(reference);
    if (!refunded.ok) {
      return { httpStatus: refunded.status || 502, body: { error: refunded.error, canRefund: true } };
    }
    const metadata = markRefunded(profile.metadata, reference, opts.check, mode, purpose || existing?.purpose || '');
    await saveMetadata(opts.companyId, metadata);
    return {
      httpStatus: 200,
      body: {
        refunded: true,
        paystack_reference: reference,
        summary: readFieldChecks(metadata)[opts.check],
      },
    };
  }

  const decisionPreview = decidePaidCheck({
    intent: 'run',
    reference,
    companyId: opts.companyId,
    check: opts.check as PricedCheck,
    asyncBank,
    paidAmountCents: price.cents,
    existing: asStored(existing),
    freshIdempotencyKey: freshKey,
  });
  if (decisionPreview.action === 'reject' && decisionPreview.httpStatus === 400) {
    return { httpStatus: 400, body: { error: decisionPreview.error, amount_zar: price.zar } };
  }
  if (decisionPreview.action === 'reject' && !reference) {
    return {
      httpStatus: 402,
      body: {
        error: decisionPreview.error,
        amount_zar: price.zar,
        amount_cents: price.cents,
        currency: 'ZAR',
      },
    };
  }
  if (decisionPreview.action === 'replay') {
    return {
      httpStatus: 200,
      body: { summary: existing, replayed: true, directVatCheck: DIRECT_VAT_CHECK },
    };
  }
  if (decisionPreview.action === 'reject' && decisionPreview.httpStatus === 409) {
    return { httpStatus: 409, body: { error: decisionPreview.error, canRefund: false } };
  }

  const verified = await verifyPaystackTransaction(reference, {
    expectedAmountCents: price.cents,
    expectedCurrency: 'ZAR',
  });
  if (!verified.ok) {
    return {
      httpStatus: 402,
      body: { error: verified.error, amount_zar: price.zar, amount_cents: price.cents },
    };
  }

  const decision = decidePaidCheck({
    intent: 'run',
    reference,
    companyId: opts.companyId,
    check: opts.check as PricedCheck,
    asyncBank,
    paidAmountCents: verified.amount,
    existing: asStored(existing),
    freshIdempotencyKey: freshKey,
  });
  if (decision.action === 'replay') {
    return { httpStatus: 200, body: { summary: existing, replayed: true, directVatCheck: DIRECT_VAT_CHECK } };
  }
  if (decision.action === 'reject') {
    return { httpStatus: decision.httpStatus, body: { error: decision.error, amount_zar: price.zar } };
  }
  if (decision.action !== 'run' && decision.action !== 'retry') {
    return { httpStatus: 409, body: { error: 'This payment cannot start a check.' } };
  }

  const receipt: Receipt = {
    reference,
    amountCents: price.cents,
    amountZar: price.zar,
    paidAt: verified.paidAt,
  };

  if (opts.consent !== true || purpose.length < 10) {
    const saved = await persistError({
      companyId: opts.companyId,
      profile,
      receipt,
      summary: errorShell({
        check: opts.check,
        mode,
        purpose: purpose || 'Missing purpose',
        detail:
          opts.consent !== true
            ? 'POPIA consent is required before this check runs.'
            : 'Add the purpose for this check before it runs.',
        idempotencyKey: '',
        providerAttempted: false,
        price,
      }),
    });
    return {
      httpStatus: 400,
      body: {
        error: saved.summary.detail,
        summary: saved.summary,
        saved: true,
        canRetry: true,
        canRefund: true,
        paystack_reference: reference,
      },
    };
  }

  if (opts.check === 'supplier_bundle') {
    return runBundle({
      profile,
      mode,
      asyncBank,
      purpose,
      userId: opts.userId,
      companyId: opts.companyId,
      receipt,
      idempotencyKey: decision.idempotencyKey,
    });
  }

  const outcome = await runOne({
    check: opts.check,
    profile,
    mode,
    asyncBank,
    purpose,
    userId: opts.userId,
    companyId: opts.companyId,
    idempotencyKey: decision.idempotencyKey,
    receipt,
  });
  if (!outcome.ok) return { httpStatus: outcome.status, body: outcome.body };
  return {
    httpStatus: 200,
    body: { summary: outcome.summary, replayed: outcome.replayed, directVatCheck: DIRECT_VAT_CHECK },
  };
}

function markRefunded(
  metadata: unknown,
  reference: string,
  check: FieldCheckId,
  mode: 'sandbox' | 'production',
  purpose: string
): Record<string, unknown> {
  const prev =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? { ...(metadata as Record<string, unknown>) }
      : {};
  const fields = readFieldChecks(prev);
  const now = new Date().toISOString();
  const touch = (id: FieldCheckId, summary: FieldCheckSummary | undefined) => {
    const base =
      summary ||
      errorShell({
        check: id,
        mode,
        purpose,
        detail: 'Refunded before VerifyNow returned a result.',
        idempotencyKey: '',
        providerAttempted: false,
        price: customerPriceFor(id === 'supplier_bundle' || id === 'bank_account' ? id : (id as PricedCheck), false),
      });
    const next: FieldCheckSummary = {
      ...base,
      payment_status: 'refunded',
      paystack_reference: reference,
      detail: base.detail || 'Paystack refund recorded. This reference cannot run another check.',
    };
    const merged = mergeFieldMetadata(prev, next, null, null);
    Object.assign(prev, merged);
  };
  touch(check, fields[check]);
  if (check === 'supplier_bundle') {
    for (const part of PARTS) {
      const row = readFieldChecks(prev)[part];
      if (row?.paystack_reference === reference) touch(part, row);
    }
  }
  return prev;
}

async function persistError(opts: {
  companyId: number;
  profile: ProfileRow;
  summary: FieldCheckSummary;
  receipt: Receipt;
}): Promise<{ summary: FieldCheckSummary; metadata: Record<string, unknown> }> {
  const saved = withReceipt(opts.summary, opts.receipt, opts.summary.part_of);
  const trust = publicTrustFromFields({ ...readFieldChecks(opts.profile.metadata), [saved.check]: saved });
  const metadata = mergeFieldMetadata(opts.profile.metadata, saved, trust, saved.job_id);
  await saveMetadata(opts.companyId, metadata);
  return { summary: saved, metadata };
}

async function runBundle(opts: {
  profile: ProfileRow;
  mode: 'sandbox' | 'production';
  asyncBank: boolean;
  purpose: string;
  userId: string;
  companyId: number;
  receipt: Receipt;
  idempotencyKey: string;
}): Promise<FulfillResult> {
  const price = customerPriceFor('supplier_bundle', opts.asyncBank);
  const registration = text(opts.profile, 'registration_number');
  const directorId = text(opts.profile, 'director_id_number').replace(/\D/g, '');
  const account = text(opts.profile, 'account_number').replace(/\D/g, '');
  const branch = text(opts.profile, 'branch_code').replace(/\D/g, '');
  const missing =
    !registration || directorId.length !== 13 || !text(opts.profile, 'contact_name')
      ? 'Supplier bundle needs a CIPC number, a 13-digit director SA ID, and the director name in the contact name field.'
      : !text(opts.profile, 'legal_name') || account.length < 7 || branch.length !== 6
        ? 'Supplier bundle needs the registered legal name, account number and 6-digit branch code.'
        : null;
  if (missing) {
    const saved = await persistError({
      companyId: opts.companyId,
      profile: opts.profile,
      receipt: opts.receipt,
      summary: errorShell({
        check: 'supplier_bundle',
        mode: opts.mode,
        purpose: opts.purpose,
        detail: missing,
        idempotencyKey: '',
        providerAttempted: false,
        price,
      }),
    });
    return {
      httpStatus: 400,
      body: { error: missing, summary: saved.summary, saved: true, canRetry: true, canRefund: true },
    };
  }
  if (opts.asyncBank) {
    const url = webhookUrl();
    const secret = process.env.VERIFYNOW_WEBHOOK_SECRET?.trim() || '';
    if (!url || secret.length < 32) {
      const error =
        'Capitec Business and Mercantile need VERIFYNOW_WEBHOOK_SECRET (32+ characters) and a public site URL before the bundle can include that bank check.';
      const saved = await persistError({
        companyId: opts.companyId,
        profile: opts.profile,
        receipt: opts.receipt,
        summary: errorShell({
          check: 'supplier_bundle',
          mode: opts.mode,
          purpose: opts.purpose,
          detail: error,
          idempotencyKey: '',
          providerAttempted: false,
          price,
        }),
      });
      return {
        httpStatus: 503,
        body: { error, summary: saved.summary, saved: true, canRetry: true, canRefund: true },
      };
    }
  }

  const quoted = supplierBundlePrice(opts.asyncBank);
  const ran: FieldCheckSummary[] = [];
  let metadata = (opts.profile.metadata as Record<string, unknown>) || {};
  let profile = opts.profile;
  for (const part of PARTS) {
    const outcome = await runOne({
      check: part,
      profile,
      mode: opts.mode,
      asyncBank: opts.asyncBank,
      purpose: opts.purpose,
      userId: opts.userId,
      companyId: opts.companyId,
      idempotencyKey: inputKey(part, opts.profile, opts.mode, opts.asyncBank, opts.receipt.reference),
      receipt: opts.receipt,
      partOf: 'supplier_bundle',
    });
    if (!outcome.ok) {
      const providerAttempted = ran.some((row) => row.provider_attempted) || outcome.providerAttempted;
      const bundle = await persistError({
        companyId: opts.companyId,
        profile: { ...opts.profile, metadata: outcome.metadata || metadata },
        receipt: opts.receipt,
        summary: errorShell({
          check: 'supplier_bundle',
          mode: opts.mode,
          purpose: opts.purpose,
          detail: String(outcome.body.error || 'A bundle check failed after payment.'),
          idempotencyKey: providerAttempted ? opts.idempotencyKey : '',
          providerAttempted,
          price,
        }),
      });
      return {
        httpStatus: outcome.status,
        body: { ...outcome.body, summary: bundle.summary, components: ran, canRetry: true, canRefund: true },
      };
    }
    ran.push(outcome.summary);
    metadata = outcome.metadata;
    profile = { ...profile, metadata };
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
  const summary = withReceipt(
    {
      check: 'supplier_bundle',
      status: bundleStatus,
      source: 'verifynow',
      checked_at: new Date().toISOString(),
      request_id: null,
      job_id: ran.find((row) => row.job_id)?.job_id || null,
      mode: opts.mode,
      price_excl_vat_zar: quoted.priceExclVatZar,
      credits: quoted.credits,
      purpose: opts.purpose,
      consent_at: new Date().toISOString(),
      idempotency_key: opts.idempotencyKey,
      provider_attempted: true,
      subject_masked: null,
      matches: {},
      detail: SUPPLIER_BUNDLE_NOTE,
    },
    opts.receipt
  );
  const trust = publicTrustFromFields({
    ...readFieldChecks(metadata),
    ...(Object.fromEntries(ran.map((row) => [row.check, row])) as Partial<
      Record<FieldCheckId, FieldCheckSummary>
    >),
    supplier_bundle: summary,
  });
  await saveMetadata(opts.companyId, mergeFieldMetadata(metadata, summary, trust, summary.job_id));
  return {
    httpStatus: 200,
    body: { summary, components: ran, replayed: false, directVatCheck: DIRECT_VAT_CHECK },
  };
}

async function runOne(opts: {
  check: Exclude<FieldCheckId, 'supplier_bundle'>;
  profile: ProfileRow;
  mode: 'sandbox' | 'production';
  asyncBank: boolean;
  purpose: string;
  userId: string;
  companyId: number;
  idempotencyKey: string;
  receipt: Receipt;
  partOf?: 'supplier_bundle';
}): Promise<
  | { ok: true; summary: FieldCheckSummary; replayed: boolean; metadata: Record<string, unknown> }
  | {
      ok: false;
      status: number;
      providerAttempted: boolean;
      metadata: Record<string, unknown>;
      body: Record<string, unknown>;
    }
> {
  const existing = readFieldChecks(opts.profile.metadata)[opts.check];
  const component = decideComponent({
    existing: asStored(existing),
    reference: opts.receipt.reference,
    freshIdempotencyKey: opts.idempotencyKey,
  });
  if (component === 'replay' && existing) {
    return {
      ok: true,
      summary: existing,
      replayed: true,
      metadata: (opts.profile.metadata as Record<string, unknown>) || {},
    };
  }
  if (component === 'blocked') {
    return {
      ok: false,
      status: 409,
      providerAttempted: true,
      metadata: (opts.profile.metadata as Record<string, unknown>) || {},
      body: {
        error:
          'The profile details changed after this payment. Refund it, or restore the details that were paid for, then retry.',
        canRefund: true,
      },
    };
  }
  const key =
    component === 'retry' && existing?.provider_attempted && existing.idempotency_key
      ? existing.idempotency_key
      : opts.idempotencyKey;

  const now = new Date().toISOString();
  const registration = text(opts.profile, 'registration_number');
  const directorId = text(opts.profile, 'director_id_number').replace(/\D/g, '');
  const contact = text(opts.profile, 'contact_name');
  const legal = text(opts.profile, 'legal_name');
  const price = customerPriceFor(opts.check, opts.asyncBank);

  const fail = async (status: number, error: string, providerAttempted: boolean) => {
    const saved = await persistError({
      companyId: opts.companyId,
      profile: opts.profile,
      receipt: opts.receipt,
      summary: {
        ...errorShell({
          check: opts.check,
          mode: opts.mode,
          purpose: opts.purpose,
          detail: error,
          idempotencyKey: providerAttempted ? key : '',
          providerAttempted,
          price,
        }),
        part_of: opts.partOf || null,
      },
    });
    return {
      ok: false as const,
      status,
      providerAttempted,
      metadata: saved.metadata,
      body: {
        error,
        summary: saved.summary,
        saved: true,
        canRetry: true,
        canRefund: true,
        paystack_reference: opts.receipt.reference,
      },
    };
  };

  let summary: FieldCheckSummary;
  if (opts.check === 'cipc_company_match') {
    if (!registration) return fail(400, 'Add a CIPC registration number first.', false);
    const called = await callVerifyNowCipcCompany({
      registrationNumber: registration,
      mode: opts.mode,
      idempotencyKey: key,
    });
    if (!called.ok) return fail(502, called.error || 'VerifyNow company match failed.', true);
    summary = summariseCompanyMatch({
      payload: called.data,
      legalName: legal,
      tradingName: text(opts.profile, 'trading_name'),
      addressParts: [
        text(opts.profile, 'address'),
        text(opts.profile, 'street'),
        text(opts.profile, 'city'),
        text(opts.profile, 'province'),
      ],
      directorId,
      directorName: contact,
      profileVat: text(opts.profile, 'vat_number'),
      mode: opts.mode,
      purpose: opts.purpose,
      consentAt: now,
      idempotencyKey: key,
      price: price.costExclVatZar,
      credits: price.credits,
      checkedAt: now,
    });
  } else if (opts.check === 'cipc_director_search') {
    if (directorId.length !== 13) return fail(400, 'Add the director SA ID on the profile first.', false);
    const called = await callVerifyNowCipcDirectorSearch({
      idNumber: directorId,
      mode: opts.mode,
      idempotencyKey: key,
    });
    if (!called.ok) return fail(502, called.error || 'VerifyNow director search failed.', true);
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
    if (directorId.length !== 13) return fail(400, 'Add the director SA ID on the profile first.', false);
    const called = await callVerifyNowSaid({
      idNumber: directorId,
      mode: opts.mode,
      idempotencyKey: key,
    });
    if (!called.ok) return fail(502, called.error || 'VerifyNow SA ID check failed.', true);
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
      return fail(400, 'Add the director name as the company contact name before AML screening.', false);
    }
    const called = await callVerifyNowAmlScreening({
      name: contact,
      mode: opts.mode,
      idempotencyKey: key,
    });
    if (!called.ok) return fail(502, called.error || 'VerifyNow AML screening failed.', true);
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
      return fail(
        400,
        'Company bank checks need the registered legal name, CIPC number, account number and 6-digit branch code.',
        false
      );
    }
    if (opts.asyncBank) {
      const url = webhookUrl();
      const secret = process.env.VERIFYNOW_WEBHOOK_SECRET?.trim() || '';
      if (!url || secret.length < 32) {
        return fail(
          503,
          'Capitec Business and Mercantile need VERIFYNOW_WEBHOOK_SECRET (32+ characters) and a public site URL for the signed webhook.',
          false
        );
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
      if (!called.ok) return fail(502, called.error || 'VerifyNow business bank check failed.', true);
      summary = summariseBank({
        payload: called.data,
        accountNumber: account,
        asyncJob: true,
        mode: opts.mode,
        purpose: opts.purpose,
        consentAt: now,
        idempotencyKey: key,
        checkedAt: now,
        price: price.costExclVatZar,
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
      if (!called.ok) return fail(502, called.error || 'VerifyNow bank check failed.', true);
      summary = summariseBank({
        payload: called.data,
        accountNumber: account,
        asyncJob: false,
        mode: opts.mode,
        purpose: opts.purpose,
        consentAt: now,
        idempotencyKey: key,
        checkedAt: now,
        price: price.costExclVatZar,
        credits: price.credits,
      });
    }
  }

  summary = withReceipt({ ...summary, provider_attempted: true }, opts.receipt, opts.partOf || null);
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
    metadata: {
      check: summary.check,
      status: summary.status,
      source: 'verifynow',
      paystack_reference: opts.receipt.reference,
      amount_zar: opts.receipt.amountZar,
    },
  });
  return { ok: true, summary, replayed: false, metadata };
}
