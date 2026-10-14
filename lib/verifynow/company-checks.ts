/**
 * Company-profile field checks on top of the existing VerifyNow client.
 * Prices are the product-guide amounts excluding VAT (reviewed 2026-10-14).
 * Stored summaries keep match flags and masked identifiers only.
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import {
  compareCompanyNames,
  parseVerifyNowBankResult,
  parseVerifyNowCipcResult,
  parseVerifyNowSaidResult,
  type CipcCompanyResult,
} from '@/lib/verifynow/client';

export type FieldCheckId =
  | 'cipc_company_match'
  | 'cipc_director_search'
  | 'said_verification'
  | 'bank_account'
  | 'aml_pep'
  | 'supplier_bundle';

export type MatchFlag = 'match' | 'mismatch' | 'partial' | 'unknown';

export type FieldCheckStatus =
  | 'match'
  | 'mismatch'
  | 'verified'
  | 'failed'
  | 'pending'
  | 'review'
  | 'clear'
  | 'error';

export type FieldCheckSummary = {
  check: FieldCheckId;
  status: FieldCheckStatus;
  source: 'verifynow';
  checked_at: string;
  request_id: string | null;
  job_id: string | null;
  mode: 'sandbox' | 'production';
  price_excl_vat_zar: number;
  credits: number;
  purpose: string;
  consent_at: string;
  idempotency_key: string;
  subject_masked: string | null;
  matches: Partial<
    Record<
      | 'name'
      | 'status'
      | 'address'
      | 'directors'
      | 'vat'
      | 'account_open'
      | 'holder'
      | 'accepts_debits'
      | 'accepts_credits',
      MatchFlag
    >
  >;
  detail: string;
};

export type PublicTrust = {
  source: 'verifynow';
  status: 'verified' | 'review';
  checked_at: string;
};

export const FIELD_META_KEY = 'verifynow_fields';
export const PUBLIC_META_KEY = 'verifynow_public';
export const BANK_JOB_META_KEY = 'verifynow_bank_job_id';
export const WEBHOOK_EVENTS_META_KEY = 'verifynow_webhook_events';

/**
 * VerifyNow does not publish a VAT verification product or endpoint.
 * VAT numbers can appear inside CIPC Director Search (and sometimes company match).
 */
export const DIRECT_VAT_CHECK = false as const;

export const VAT_CHECK_NOTE =
  'VerifyNow has no direct VAT check. SupplierAdvisor® cross-checks the profile VAT number against VAT numbers returned on a CIPC Director Search, when the registry includes them.';

/** Product-guide prices, excluding VAT. Supplier Bundle is not an API product. */
export const VERIFYNOW_FIELD_PRODUCTS = {
  cipc_company_match: {
    id: 'cipc_company_match' as const,
    label: 'CIPC company match',
    guideName: 'CIPC Company Search',
    credits: 10,
    priceExclVatZar: 26,
  },
  cipc_director_search: {
    id: 'cipc_director_search' as const,
    label: 'CIPC director search',
    guideName: 'CIPC Director Search',
    credits: 10,
    priceExclVatZar: 26,
  },
  said_verification: {
    id: 'said_verification' as const,
    label: 'Director SA ID',
    guideName: 'SA ID Verification',
    credits: 1,
    priceExclVatZar: 2.6,
  },
  bank_account: {
    id: 'bank_account' as const,
    label: 'Company bank account',
    guideName: 'Bank Account Verification',
    credits: 6,
    priceExclVatZar: 15.6,
  },
  business_bank_account: {
    id: 'business_bank_account' as const,
    label: 'Capitec Business / Mercantile',
    guideName: 'Capitec Business Bank Verification',
    credits: 7,
    priceExclVatZar: 18.2,
  },
  aml_pep: {
    id: 'aml_pep' as const,
    label: 'AML, PEP and sanctions',
    guideName: 'AML, PEP & Sanctions Screening',
    credits: 2,
    priceExclVatZar: 5.2,
  },
} as const;

export function formatZar(amount: number): string {
  return `R${amount.toFixed(2)}`;
}

export function maskSaId(value: string): string {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length < 4) return '';
  return `${'•'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}

export function maskAccount(value: string): string {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length < 4) return '';
  return `•••• ${digits.slice(-4)}`;
}

/** Capitec Business and Mercantile use the async business-bank route (branch 450105). */
export function isAsyncBusinessBank(bankName: string, branchCode: string): boolean {
  const branch = String(branchCode || '').replace(/\D/g, '');
  if (branch === '450105') return true;
  const name = String(bankName || '').toLowerCase();
  if (name.includes('mercantile')) return true;
  return name.includes('capitec') && name.includes('business');
}

export function fieldIdempotencyKey(parts: string[]): string {
  const hash = createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 40);
  return `sa${hash}`;
}

const TERMINAL = new Set<FieldCheckStatus>([
  'match',
  'mismatch',
  'verified',
  'failed',
  'pending',
  'review',
  'clear',
]);

export function isReplayable(summary: FieldCheckSummary | undefined, key: string): boolean {
  if (!summary) return false;
  if (summary.idempotency_key !== key) return false;
  return TERMINAL.has(summary.status);
}

export function verifyWebhookSignature(opts: {
  secret: string;
  timestamp: string;
  rawBody: string;
  received: string;
  nowMs?: number;
}): { ok: true } | { ok: false; reason: string } {
  const secret = opts.secret.trim();
  const timestamp = opts.timestamp.trim();
  const received = opts.received.trim();
  if (!secret) return { ok: false, reason: 'missing_secret' };
  if (!timestamp || !received) return { ok: false, reason: 'missing_headers' };
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return { ok: false, reason: 'bad_timestamp' };
  const now = (opts.nowMs ?? Date.now()) / 1000;
  if (Math.abs(now - ts) > 300) return { ok: false, reason: 'stale' };
  const expected =
    'v1=' + createHmac('sha256', secret).update(`${timestamp}.${opts.rawBody}`).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: 'bad_signature' };
  }
  return { ok: true };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function compareCompanyStatus(remote: string): MatchFlag {
  const status = String(remote || '').trim();
  if (!status) return 'unknown';
  if (/deregister|liquidat|business rescue|inactive|dissolv|final de|removed/i.test(status)) {
    return 'mismatch';
  }
  if (/in business|active|registered|trading/i.test(status)) return 'match';
  return 'unknown';
}

export function compareAddress(localParts: string[], remote: string): MatchFlag {
  const remoteN = normalizeText(remote);
  if (!remoteN) return 'unknown';
  const locals = localParts.map(normalizeText).filter((part) => part.length > 3);
  if (!locals.length) return 'unknown';
  for (const local of locals) {
    if (remoteN.includes(local) || local.includes(remoteN)) return 'match';
  }
  const tokens = locals.flatMap((part) => part.split(' ').filter((token) => token.length > 3));
  if (tokens.some((token) => remoteN.includes(token))) return 'partial';
  return 'mismatch';
}

type DirectorHit = { name: string; idDigits: string };

function collectDirectors(node: unknown, out: DirectorHit[], depth: number): void {
  if (depth > 6 || node == null) return;
  if (Array.isArray(node)) {
    for (const item of node) collectDirectors(item, out, depth + 1);
    return;
  }
  const row = asRecord(node);
  if (!row) return;
  const name = String(
    row.full_name || row.fullName || row.name || row.director_name || row.DirectorName || ''
  ).trim();
  const idDigits = String(
    row.id_number || row.idNumber || row.identity_number || row.sa_id || ''
  ).replace(/\D/g, '');
  if (name || idDigits.length === 13) out.push({ name, idDigits });
  for (const value of Object.values(row)) {
    if (value && typeof value === 'object') collectDirectors(value, out, depth + 1);
  }
}

export function extractDirectors(payload: Record<string, unknown>): DirectorHit[] {
  const out: DirectorHit[] = [];
  collectDirectors(payload.results ?? payload, out, 0);
  const seen = new Set<string>();
  return out.filter((hit) => {
    const key = `${hit.idDigits}|${normalizeText(hit.name)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function collectVatNumbers(node: unknown, out: Set<string>, depth: number): void {
  if (depth > 6 || node == null) return;
  if (Array.isArray(node)) {
    for (const item of node) collectVatNumbers(item, out, depth + 1);
    return;
  }
  const row = asRecord(node);
  if (!row) return;
  for (const [key, value] of Object.entries(row)) {
    if (/vat/i.test(key) && (typeof value === 'string' || typeof value === 'number')) {
      const digits = String(value).replace(/\D/g, '');
      if (digits.length >= 9 && digits.length <= 12) out.add(digits);
    } else if (value && typeof value === 'object') {
      collectVatNumbers(value, out, depth + 1);
    }
  }
}

export function extractVatNumbers(payload: Record<string, unknown>): string[] {
  const out = new Set<string>();
  collectVatNumbers(payload.results ?? payload, out, 0);
  return [...out];
}

export function compareDirectors(
  localId: string,
  localName: string,
  directors: DirectorHit[]
): MatchFlag {
  if (!directors.length) return 'unknown';
  const id = String(localId || '').replace(/\D/g, '');
  if (id.length === 13) {
    return directors.some((director) => director.idDigits === id) ? 'match' : 'mismatch';
  }
  const local = normalizeText(localName);
  if (!local) return 'unknown';
  const names = directors.map((director) => normalizeText(director.name)).filter(Boolean);
  if (!names.length) return 'unknown';
  if (names.some((name) => name === local || name.includes(local) || local.includes(name))) {
    return 'match';
  }
  return 'mismatch';
}

export function compareVat(profileVat: string, returned: string[]): MatchFlag {
  const local = String(profileVat || '').replace(/\D/g, '');
  if (!local) return 'unknown';
  if (!returned.length) return 'unknown';
  return returned.some((vat) => vat === local || vat.endsWith(local) || local.endsWith(vat))
    ? 'match'
    : 'mismatch';
}

function yesFlag(value: string): MatchFlag {
  if (/^yes$/i.test(value)) return 'match';
  if (/^no$/i.test(value)) return 'mismatch';
  return 'unknown';
}

export function summariseCompanyMatch(opts: {
  payload: Record<string, unknown>;
  legalName: string;
  tradingName: string;
  addressParts: string[];
  directorId: string;
  directorName: string;
  profileVat?: string;
  mode: 'sandbox' | 'production';
  purpose: string;
  consentAt: string;
  idempotencyKey: string;
  price: number;
  credits: number;
  checkedAt: string;
}): FieldCheckSummary {
  const parsed: CipcCompanyResult = parseVerifyNowCipcResult(opts.payload, [
    opts.legalName,
    opts.tradingName,
  ]);
  const name = parsed.nameMatch === 'partial' ? 'partial' : parsed.nameMatch;
  const status = compareCompanyStatus(parsed.companyStatus);
  const address = compareAddress(
    opts.addressParts,
    [parsed.physicalAddress, parsed.postalAddress].filter(Boolean).join(' ')
  );
  const directors = compareDirectors(
    opts.directorId,
    opts.directorName,
    extractDirectors(opts.payload)
  );
  const vat = compareVat(opts.profileVat || '', extractVatNumbers(opts.payload));
  const flags = [name, status, address, directors];
  const failed = !parsed.ok && parsed.nameMatch === 'unknown' && !parsed.companyName;
  let summaryStatus: FieldCheckStatus = 'match';
  if (failed) summaryStatus = 'failed';
  else if (flags.some((flag) => flag === 'mismatch')) summaryStatus = 'mismatch';
  else if (flags.some((flag) => flag === 'partial' || flag === 'unknown')) summaryStatus = 'review';
  return {
    check: 'cipc_company_match',
    status: summaryStatus,
    source: 'verifynow',
    checked_at: opts.checkedAt,
    request_id: parsed.requestId || null,
    job_id: null,
    mode: opts.mode,
    price_excl_vat_zar: opts.price,
    credits: opts.credits,
    purpose: opts.purpose,
    consent_at: opts.consentAt,
    idempotency_key: opts.idempotencyKey,
    subject_masked: null,
    matches: { name, status, address, directors, vat },
    detail: failed
      ? 'CIPC company match did not return a company record.'
      : 'Name, status, address and director flags are stored without the registry payload.',
  };
}

export function summariseDirectorSearch(opts: {
  payload: Record<string, unknown>;
  profileVat: string;
  registrationNumber: string;
  directorId: string;
  mode: 'sandbox' | 'production';
  purpose: string;
  consentAt: string;
  idempotencyKey: string;
  checkedAt: string;
}): FieldCheckSummary {
  const directors = extractDirectors(opts.payload);
  const vats = extractVatNumbers(opts.payload);
  const linked = compareDirectors(opts.directorId, '', directors);
  const registration = String(opts.registrationNumber || '').replace(/\s/g, '').toUpperCase();
  const blob = JSON.stringify(opts.payload.results || {}).toUpperCase();
  const companyLink: MatchFlag = !registration
    ? 'unknown'
    : blob.includes(registration)
      ? 'match'
      : directors.length
        ? 'mismatch'
        : 'unknown';
  const vat = compareVat(opts.profileVat, vats);
  const ok = opts.payload.success !== false && (directors.length > 0 || vats.length > 0);
  let status: FieldCheckStatus = 'match';
  if (!ok) status = 'failed';
  else if ([linked, companyLink, vat].some((flag) => flag === 'mismatch')) status = 'mismatch';
  else if ([linked, companyLink, vat].some((flag) => flag === 'unknown')) status = 'review';
  return {
    check: 'cipc_director_search',
    status,
    source: 'verifynow',
    checked_at: opts.checkedAt,
    request_id: String(opts.payload.requestId || opts.payload.request_id || '') || null,
    job_id: null,
    mode: opts.mode,
    price_excl_vat_zar: VERIFYNOW_FIELD_PRODUCTS.cipc_director_search.priceExclVatZar,
    credits: VERIFYNOW_FIELD_PRODUCTS.cipc_director_search.credits,
    purpose: opts.purpose,
    consent_at: opts.consentAt,
    idempotency_key: opts.idempotencyKey,
    subject_masked: maskSaId(opts.directorId) || null,
    matches: { directors: companyLink === 'match' ? 'match' : linked, vat },
    detail: DIRECT_VAT_CHECK
      ? 'VAT checked directly.'
      : vats.length
        ? 'VAT cross-check used numbers returned with the director search. No separate VAT product was called.'
        : 'Director search returned no VAT number to cross-check. VerifyNow has no direct VAT check.',
  };
}

export function summariseSaId(opts: {
  payload: Record<string, unknown>;
  directorName: string;
  directorId: string;
  mode: 'sandbox' | 'production';
  purpose: string;
  consentAt: string;
  idempotencyKey: string;
  checkedAt: string;
}): FieldCheckSummary {
  const parsed = parseVerifyNowSaidResult(opts.payload);
  const remote = normalizeText(parsed.fullName);
  const local = normalizeText(opts.directorName);
  let name: MatchFlag = 'unknown';
  if (remote && local) {
    name = remote === local || remote.includes(local) || local.includes(remote) ? 'match' : 'mismatch';
  }
  let status: FieldCheckStatus = 'verified';
  if (!parsed.ok) status = 'failed';
  else if (name === 'mismatch') status = 'mismatch';
  else if (name === 'unknown') status = 'review';
  return {
    check: 'said_verification',
    status,
    source: 'verifynow',
    checked_at: opts.checkedAt,
    request_id: parsed.requestId || null,
    job_id: null,
    mode: opts.mode,
    price_excl_vat_zar: VERIFYNOW_FIELD_PRODUCTS.said_verification.priceExclVatZar,
    credits: VERIFYNOW_FIELD_PRODUCTS.said_verification.credits,
    purpose: opts.purpose,
    consent_at: opts.consentAt,
    idempotency_key: opts.idempotencyKey,
    subject_masked: maskSaId(opts.directorId) || null,
    matches: { name },
    detail:
      name === 'mismatch'
        ? 'Home Affairs name does not match the contact name on this profile.'
        : 'SA ID check stored as a match flag. The ID number is masked.',
  };
}

export function summariseBank(opts: {
  payload: Record<string, unknown>;
  accountNumber: string;
  asyncJob: boolean;
  mode: 'sandbox' | 'production';
  purpose: string;
  consentAt: string;
  idempotencyKey: string;
  checkedAt: string;
  price: number;
  credits: number;
}): FieldCheckSummary {
  const jobId = String(opts.payload.jobId || opts.payload.job_id || '').trim();
  if (opts.asyncJob && (opts.payload.status === 'pending' || jobId) && !opts.payload.result) {
    return {
      check: 'bank_account',
      status: 'pending',
      source: 'verifynow',
      checked_at: opts.checkedAt,
      request_id: String(opts.payload.requestId || '') || null,
      job_id: jobId || null,
      mode: opts.mode,
      price_excl_vat_zar: opts.price,
      credits: opts.credits,
      purpose: opts.purpose,
      consent_at: opts.consentAt,
      idempotency_key: opts.idempotencyKey,
      subject_masked: maskAccount(opts.accountNumber) || null,
      matches: {},
      detail: 'Capitec Business / Mercantile check is waiting for the signed webhook.',
    };
  }
  const parsed = parseVerifyNowBankResult(opts.payload);
  const accountOpen = yesFlag(parsed.accountOpen);
  const holder = yesFlag(parsed.identityMatch);
  const debits = yesFlag(parsed.acceptsDebits);
  const credits = yesFlag(parsed.acceptsCredits);
  const flags = [accountOpen, holder];
  let status: FieldCheckStatus = parsed.ok ? 'verified' : 'failed';
  if (parsed.ok && flags.some((flag) => flag === 'mismatch')) status = 'mismatch';
  else if (parsed.ok && flags.some((flag) => flag === 'unknown')) status = 'review';
  return {
    check: 'bank_account',
    status,
    source: 'verifynow',
    checked_at: opts.checkedAt,
    request_id: parsed.requestId || null,
    job_id: jobId || null,
    mode: opts.mode,
    price_excl_vat_zar: opts.price,
    credits: opts.credits,
    purpose: opts.purpose,
    consent_at: opts.consentAt,
    idempotency_key: opts.idempotencyKey,
    subject_masked: maskAccount(opts.accountNumber) || null,
    matches: {
      account_open: accountOpen,
      holder,
      accepts_debits: debits,
      accepts_credits: credits,
    },
    detail: 'Account number stored as last four digits only.',
  };
}

export function summariseAml(opts: {
  payload: Record<string, unknown>;
  directorId: string;
  mode: 'sandbox' | 'production';
  purpose: string;
  consentAt: string;
  idempotencyKey: string;
  checkedAt: string;
}): FieldCheckSummary {
  const results = asRecord(opts.payload.results) || {};
  const matches = results.matches ?? results.Matches ?? results.hits ?? results.potential_matches;
  const count = Array.isArray(matches)
    ? matches.length
    : Number(results.matchCount ?? results.match_count ?? results.totalMatches ?? NaN);
  let status: FieldCheckStatus = 'clear';
  if (opts.payload.success === false) status = 'failed';
  else if ((Array.isArray(matches) && matches.length > 0) || (Number.isFinite(count) && count > 0)) {
    status = 'review';
  }
  return {
    check: 'aml_pep',
    status,
    source: 'verifynow',
    checked_at: opts.checkedAt,
    request_id: String(opts.payload.requestId || opts.payload.request_id || '') || null,
    job_id: null,
    mode: opts.mode,
    price_excl_vat_zar: VERIFYNOW_FIELD_PRODUCTS.aml_pep.priceExclVatZar,
    credits: VERIFYNOW_FIELD_PRODUCTS.aml_pep.credits,
    purpose: opts.purpose,
    consent_at: opts.consentAt,
    idempotency_key: opts.idempotencyKey,
    subject_masked: maskSaId(opts.directorId) || null,
    matches: {},
    detail:
      status === 'review'
        ? 'Potential AML, PEP or sanctions matches need a person to review. Hit details are not stored.'
        : status === 'clear'
          ? 'No AML, PEP or sanctions matches were returned.'
          : 'AML screening did not complete.',
  };
}

export function applyBankWebhook(
  existing: FieldCheckSummary,
  event: Record<string, unknown>,
  checkedAt: string
): FieldCheckSummary {
  const data = asRecord(event.data) || {};
  const result = asRecord(data.result) || asRecord(event.result) || {};
  const checks = asRecord(result.checks) || {};
  const type = String(event.type || '');
  const failed = type.endsWith('failed') || String(data.status || '') === 'failed';
  const flag = (value: unknown): MatchFlag => {
    if (value === true || value === 'Yes') return 'match';
    if (value === false || value === 'No') return 'mismatch';
    return 'unknown';
  };
  const accountOpen = flag(checks.accountOpen);
  const holder = flag(
    checks.identityMatch ?? checks.companyMatch ?? checks.registrationMatch ?? checks.surnameMatch
  );
  const outcome = String(result.outcome || '').toLowerCase();
  let status: FieldCheckStatus = 'review';
  if (failed) status = 'failed';
  else if (outcome === 'verified' && accountOpen !== 'mismatch' && holder !== 'mismatch') {
    status = 'verified';
  } else if (accountOpen === 'mismatch' || holder === 'mismatch' || outcome === 'rejected') {
    status = 'mismatch';
  }
  const bank = asRecord(result.bank);
  const last4 = String(bank?.accountNumberLast4 || '').replace(/\D/g, '');
  return {
    ...existing,
    status,
    checked_at: checkedAt,
    job_id: String(data.jobId || existing.job_id || '') || existing.job_id,
    matches: {
      account_open: accountOpen,
      holder,
      accepts_debits: flag(checks.acceptsDebits),
      accepts_credits: flag(checks.acceptsCredits),
    },
    subject_masked: last4 ? `•••• ${last4.slice(-4)}` : existing.subject_masked,
    detail: 'Updated from the signed VerifyNow bank webhook. Full account numbers are not stored.',
  };
}

export function publicTrustFromFields(
  fields: Partial<Record<FieldCheckId, FieldCheckSummary>>
): PublicTrust | null {
  const company = fields.cipc_company_match;
  if (!company) return null;
  const aml = fields.aml_pep;
  const nameOk = company.matches.name === 'match';
  const statusOk = company.matches.status === 'match';
  const amlBlocks = aml?.status === 'review' || aml?.status === 'failed';
  return {
    source: 'verifynow',
    status: nameOk && statusOk && !amlBlocks ? 'verified' : 'review',
    checked_at: company.checked_at,
  };
}

export function supplierBundlePrice(asyncBank: boolean): { credits: number; priceExclVatZar: number } {
  const bank = asyncBank
    ? VERIFYNOW_FIELD_PRODUCTS.business_bank_account
    : VERIFYNOW_FIELD_PRODUCTS.bank_account;
  const parts = [
    VERIFYNOW_FIELD_PRODUCTS.cipc_company_match,
    VERIFYNOW_FIELD_PRODUCTS.cipc_director_search,
    VERIFYNOW_FIELD_PRODUCTS.aml_pep,
    bank,
  ];
  return {
    credits: parts.reduce((sum, part) => sum + part.credits, 0),
    priceExclVatZar: parts.reduce((sum, part) => sum + part.priceExclVatZar, 0),
  };
}

export const SUPPLIER_BUNDLE_NOTE =
  'VerifyNow exposes the Supplier Bundle in the dashboard, not as one public API call. SupplierAdvisor® runs the component checks (company match, director search, AML screening, company bank) and stores one combined summary.';

export function readFieldChecks(
  metadata: unknown
): Partial<Record<FieldCheckId, FieldCheckSummary>> {
  const meta = asRecord(metadata);
  const raw = asRecord(meta?.[FIELD_META_KEY]);
  if (!raw) return {};
  const out: Partial<Record<FieldCheckId, FieldCheckSummary>> = {};
  for (const [key, value] of Object.entries(raw)) {
    const row = asRecord(value);
    if (!row || typeof row.check !== 'string') continue;
    out[key as FieldCheckId] = row as unknown as FieldCheckSummary;
  }
  return out;
}

export function readPublicTrust(metadata: unknown): PublicTrust | null {
  const meta = asRecord(metadata);
  const raw = asRecord(meta?.[PUBLIC_META_KEY]);
  if (!raw) return null;
  if (raw.source !== 'verifynow') return null;
  if (raw.status !== 'verified' && raw.status !== 'review') return null;
  return {
    source: 'verifynow',
    status: raw.status,
    checked_at: String(raw.checked_at || ''),
  };
}

export function mergeFieldMetadata(
  metadata: unknown,
  summary: FieldCheckSummary,
  trust: PublicTrust | null,
  bankJobId?: string | null
): Record<string, unknown> {
  const prev = asRecord(metadata) ? { ...(metadata as Record<string, unknown>) } : {};
  const fields = asRecord(prev[FIELD_META_KEY]) ? { ...(prev[FIELD_META_KEY] as object) } : {};
  fields[summary.check] = summary;
  prev[FIELD_META_KEY] = fields;
  if (trust) prev[PUBLIC_META_KEY] = trust;
  if (bankJobId) prev[BANK_JOB_META_KEY] = bankJobId;
  return prev;
}

export function rememberWebhookEvent(metadata: unknown, eventId: string): {
  metadata: Record<string, unknown>;
  duplicate: boolean;
} {
  const prev = asRecord(metadata) ? { ...(metadata as Record<string, unknown>) } : {};
  const existing = Array.isArray(prev[WEBHOOK_EVENTS_META_KEY])
    ? (prev[WEBHOOK_EVENTS_META_KEY] as unknown[]).map(String)
    : [];
  if (eventId && existing.includes(eventId)) {
    return { metadata: prev, duplicate: true };
  }
  prev[WEBHOOK_EVENTS_META_KEY] = [eventId, ...existing].filter(Boolean).slice(0, 40);
  return { metadata: prev, duplicate: false };
}

/** Re-export so field comparisons stay on the existing name matcher. */
export { compareCompanyNames };
