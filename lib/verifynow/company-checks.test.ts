/**
 * Company-profile VerifyNow field checks.
 * Run: npx --yes tsx lib/verifynow/company-checks.test.ts
 */
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  DIRECT_VAT_CHECK,
  VAT_CHECK_NOTE,
  applyBankWebhook,
  compareVat,
  fieldIdempotencyKey,
  formatZar,
  isAsyncBusinessBank,
  isReplayable,
  maskAccount,
  maskSaId,
  mergeFieldMetadata,
  publicTrustFromFields,
  summariseAml,
  summariseBank,
  summariseCompanyMatch,
  summariseDirectorSearch,
  summariseSaId,
  supplierBundlePrice,
  verifyWebhookSignature,
  type FieldCheckSummary,
} from './company-checks';
import {
  callVerifyNowCipcDirectorSearch,
  isVerifyNowConfigured,
  resolveMode,
} from './client';

const now = '2026-10-14T12:00:00.000Z';
const base = {
  mode: 'sandbox' as const,
  purpose: 'Supplier due diligence',
  consentAt: now,
  idempotencyKey: 'satestkey0123456789',
  checkedAt: now,
};

const companyPayload = {
  success: true,
  requestId: 'req-cipc',
  mode: 'sandbox',
  results: {
    company_name: 'Big Five Foods Pty Ltd',
    registration_number: '2020/123456/07',
    status: 'In Business',
    physical_address: '12 Dock Road Durban',
    directors: [{ full_name: 'Naledi Khumalo', id_number: '8001015009087' }],
  },
};

const company = summariseCompanyMatch({
  ...base,
  payload: companyPayload,
  legalName: 'Big Five Foods Pty Ltd',
  tradingName: 'Big Five Foods',
  addressParts: ['Durban'],
  directorId: '8001015009087',
  directorName: 'Naledi Khumalo',
  price: 26,
  credits: 10,
});
assert.equal(company.matches.name, 'match');
assert.equal(company.matches.status, 'match');
assert.equal(company.matches.address, 'match');
assert.equal(company.matches.directors, 'match');
assert.equal(company.status, 'match');
assert.equal(JSON.stringify(company).includes('8001015009087'), false);

const director = summariseDirectorSearch({
  ...base,
  payload: {
    success: true,
    requestId: 'req-dir',
    results: {
      directorships: [
        {
          company_registration: '2020/123456/07',
          id_number: '8001015009087',
          vat_number: '4123456789',
        },
      ],
    },
  },
  profileVat: '4123456789',
  registrationNumber: '2020/123456/07',
  directorId: '8001015009087',
});
assert.equal(director.matches.vat, 'match');
assert.equal(director.subject_masked, maskSaId('8001015009087'));
assert.equal(JSON.stringify(director).includes('8001015009087'), false);
assert.equal(JSON.stringify(director).includes('4123456789'), false);
assert.match(director.detail, /no direct VAT|No separate VAT/i);

const vatMiss = compareVat('4999999999', ['4123456789']);
assert.equal(vatMiss, 'mismatch');
const vatAbsent = compareVat('4123456789', []);
assert.equal(vatAbsent, 'unknown');
assert.equal(DIRECT_VAT_CHECK, false);
assert.match(VAT_CHECK_NOTE, /no direct VAT check/i);

const said = summariseSaId({
  ...base,
  payload: {
    success: true,
    requestId: 'req-id',
    results: {
      said_verification: {
        realTimeResults: {
          Status: 'ID Number Valid',
          Verification: { Firstnames: 'NALEDI', Lastname: 'KHUMALO' },
        },
      },
    },
  },
  directorName: 'Naledi Khumalo',
  directorId: '8001015009087',
});
assert.equal(said.matches.name, 'match');
assert.equal(said.status, 'verified');
assert.equal(JSON.stringify(said).includes('NALEDI'), false);

const bank = summariseBank({
  ...base,
  payload: {
    success: true,
    requestId: 'req-bank',
    results: {
      identity_and_account_verified: true,
      verification_results: {
        accountFound: 'Yes',
        accountOpen: 'Yes',
        identityMatch: 'Yes',
        acceptsCredits: 'Yes',
        acceptsDebits: 'No',
        Status: 'Verified',
      },
    },
  },
  accountNumber: '1234567890',
  asyncJob: false,
  price: 15.6,
  credits: 6,
});
assert.equal(bank.subject_masked, maskAccount('1234567890'));
assert.equal(bank.matches.account_open, 'match');
assert.equal(bank.matches.holder, 'match');
assert.equal(bank.matches.accepts_debits, 'mismatch');
assert.equal(JSON.stringify(bank).includes('1234567890'), false);

const aml = summariseAml({
  ...base,
  payload: { success: true, requestId: 'req-aml', results: { matches: [] } },
  directorId: '8001015009087',
});
assert.equal(aml.status, 'clear');
const amlReview = summariseAml({
  ...base,
  payload: { success: true, results: { matches: [{ list: 'pep' }] } },
  directorId: '8001015009087',
});
assert.equal(amlReview.status, 'review');
assert.equal(JSON.stringify(amlReview).includes('"list"'), false);

assert.equal(isAsyncBusinessBank('Capitec Business', '470010'), true);
assert.equal(isAsyncBusinessBank('Mercantile', '123456'), true);
assert.equal(isAsyncBusinessBank('Capitec', '470010'), false);
assert.equal(isAsyncBusinessBank('FNB', '450105'), true);

const pending: FieldCheckSummary = {
  ...bank,
  status: 'pending',
  job_id: 'job-1',
  matches: {},
};
const updated = applyBankWebhook(
  pending,
  {
    type: 'business_bank.verification.completed',
    data: {
      jobId: 'job-1',
      status: 'completed',
      result: {
        outcome: 'verified',
        checks: { accountOpen: true, identityMatch: true, acceptsDebits: true, acceptsCredits: true },
        bank: { accountNumberLast4: '7890' },
      },
    },
  },
  now
);
assert.equal(updated.status, 'verified');
assert.equal(updated.subject_masked, '•••• 7890');

const trust = publicTrustFromFields({
  cipc_company_match: company,
  aml_pep: amlReview,
});
assert.equal(trust?.status, 'review');
assert.equal(trust?.source, 'verifynow');
assert.equal(JSON.stringify(trust).includes('registration'), false);

const merged = mergeFieldMetadata({ trading_name: 'Keep me' }, company, trust, null);
assert.equal(merged.trading_name, 'Keep me');
assert.equal(isReplayable(company, company.idempotency_key), true);
assert.equal(isReplayable(company, 'other'), false);
assert.equal(fieldIdempotencyKey(['sandbox', 'cipc']).length >= 8, true);
assert.equal(formatZar(2.6), 'R2.60');
assert.equal(supplierBundlePrice(false).credits, 28);
assert.equal(supplierBundlePrice(false).priceExclVatZar, 72.8);

const secret = 'webhook-secret-webhook-secret-32';
const raw = '{"ok":true}';
const timestamp = '1700000000';
const good =
  'v1=' + createHmac('sha256', secret).update(`${timestamp}.${raw}`).digest('hex');
assert.equal(
  verifyWebhookSignature({
    secret,
    timestamp,
    rawBody: raw,
    received: good,
    nowMs: 1700000000 * 1000,
  }).ok,
  true
);
assert.equal(
  verifyWebhookSignature({
    secret,
    timestamp,
    rawBody: raw,
    received: 'v1=deadbeef',
    nowMs: 1700000000 * 1000,
  }).ok,
  false
);

const previousMode = process.env.VERIFYNOW_MODE;
delete process.env.VERIFYNOW_MODE;
assert.equal(resolveMode(), 'production');
if (previousMode === undefined) delete process.env.VERIFYNOW_MODE;
else process.env.VERIFYNOW_MODE = previousMode;

const previousKey = process.env.VERIFYNOW_API_KEY;
process.env.VERIFYNOW_API_KEY = 'vn_test_server_only';
assert.equal(isVerifyNowConfigured(), true);
const seen: { key?: string; idem?: string; body?: string } = {};
const originalFetch = global.fetch;
global.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
  const headers = new Headers(init?.headers);
  seen.key = headers.get('x-api-key') || '';
  seen.idem = headers.get('Idempotency-Key') || '';
  seen.body = String(init?.body || '');
  return new Response(JSON.stringify({ success: true, results: { directorships: [] } }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}) as typeof fetch;
void callVerifyNowCipcDirectorSearch({
  idNumber: '8001015009087',
  idempotencyKey: 'sa-stable-director-key',
  mode: 'sandbox',
}).then((called) => {
  global.fetch = originalFetch;
  if (previousKey === undefined) delete process.env.VERIFYNOW_API_KEY;
  else process.env.VERIFYNOW_API_KEY = previousKey;
  assert.equal(called.ok, true);
  assert.equal(seen.key, 'vn_test_server_only');
  assert.equal(seen.idem, 'sa-stable-director-key');
  assert.match(String(seen.body), /cipc_director_search/);
  console.log('company-checks.test.ts ok');
});

const profile = readFileSync(
  resolve(process.cwd(), 'app/dashboard/my-business/profile/page.tsx'),
  'utf8'
);
assert.match(profile, /dynamic\(\(\) => import\('@\/components\/business\/CompanyFieldVerify'\)/);
assert.equal(profile.includes("from '@/components/business/CompanyFieldVerify'"), false);
const login = readFileSync(resolve(process.cwd(), 'app/login/page.tsx'), 'utf8');
assert.equal(login.includes('@privy-io/react-auth'), false);
const verifyUi = readFileSync(
  resolve(process.cwd(), 'components/business/CompanyFieldVerify.tsx'),
  'utf8'
);
assert.equal(verifyUi.includes('VERIFYNOW_API_KEY'), false);
assert.equal(verifyUi.includes('@privy-io/react-auth'), false);
