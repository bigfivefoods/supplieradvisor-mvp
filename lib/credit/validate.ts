import { fieldDefForCountry } from '@/lib/credit/fields';
import { CREDIT_TERM_OPTIONS, normalizeRequestedTerms } from '@/lib/credit/terms';
import type {
  CreditApplicationDocument,
  CreditApplicationDocumentType,
  CreditApplicationInput,
  CreditApplicationPrincipalInput,
} from '@/lib/credit/types';

const MAX_TEXT = 240;

type ValidationResult =
  | { ok: true; value: CreditApplicationInput }
  | { ok: false; errors: string[] };

function asObject(input: unknown): Record<string, unknown> {
  if (input && typeof input === 'object' && !Array.isArray(input)) return input as Record<string, unknown>;
  return {};
}

function clamp(input: unknown, max = MAX_TEXT): string {
  return String(input || '').trim().slice(0, max);
}

function rejectUnknownKeys(obj: Record<string, unknown>, allowed: readonly string[], errors: string[], path: string) {
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) {
      errors.push(`${path}.${key} is not allowed`);
    }
  }
}

function luhnDigits(value: string): boolean {
  let sum = 0;
  let alt = false;
  for (let i = value.length - 1; i >= 0; i -= 1) {
    let n = Number(value[i]);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function validDate(y: number, m: number, d: number) {
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function isValidSaId(value: unknown): boolean {
  const d = String(value || '').replace(/\D/g, '');
  if (!/^\d{13}$/.test(d)) return false;
  const yy = Number(d.slice(0, 2));
  const mm = Number(d.slice(2, 4));
  const dd = Number(d.slice(4, 6));
  const nowYear = new Date().getUTCFullYear() % 100;
  const century = yy <= nowYear ? 2000 : 1900;
  if (!validDate(century + yy, mm, dd)) return false;
  return luhnDigits(d);
}

export function isValidCipc(value: unknown): boolean {
  return /^\d{4}\/\d{6}\/\d{2}$/.test(clamp(value, 40));
}

export function isValidSarsVat(value: unknown): boolean {
  return /^4\d{9}$/.test(clamp(value, 20));
}

export function sanitizeCreditInput(input: CreditApplicationInput): CreditApplicationInput {
  const business = asObject(input.business);
  const addresses = asObject(input.addresses);
  const contacts = asObject(input.contacts);
  const bank = asObject(input.bank);

  const out: CreditApplicationInput = {
    country_code: clamp(input.country_code || 'ZA', 2).toUpperCase() || 'ZA',
    form_version: Number.isFinite(Number(input.form_version)) ? Number(input.form_version) : 1,
    business: {
      trading_name: clamp(business.trading_name),
      registered_name: clamp(business.registered_name),
      entity_type: clamp(business.entity_type, 80),
      registration_number: clamp(business.registration_number, 80),
      vat_number: clamp(business.vat_number, 40),
      years_trading: clamp(business.years_trading, 12),
      industry: clamp(business.industry, 80),
    },
    addresses: {
      physical: sanitizeAddress(addresses.physical),
      postal: sanitizeAddress(addresses.postal),
      delivery: sanitizeAddress(addresses.delivery),
    },
    contacts: {
      accounts: sanitizeContact(asObject(contacts.accounts)),
      buyer: sanitizeContact(asObject(contacts.buyer)),
    },
    trade_references: Array.isArray(input.trade_references)
      ? input.trade_references.slice(0, 8).map((row) => sanitizeTradeReference(asObject(row)))
      : [],
    bank: {
      bank_name: clamp(bank.bank_name, 120),
      branch_name: clamp(bank.branch_name, 120),
      branch_code: clamp(bank.branch_code, 20),
      account_type: clamp(bank.account_type, 32),
      account_holder: clamp(bank.account_holder, 120),
      account_number: clamp(bank.account_number, 40),
      account_number_enc: clamp(bank.account_number_enc, 600),
      account_number_last4: clamp(bank.account_number_last4, 4),
    },
    requested_limit: input.requested_limit != null ? Number(input.requested_limit) : undefined,
    requested_terms: clamp(input.requested_terms, 80),
    requested_terms_other: clamp(input.requested_terms_other, 80),
    currency: clamp(input.currency || 'ZAR', 8).toUpperCase(),
    principals: Array.isArray(input.principals)
      ? input.principals.slice(0, 20).map((row) => sanitizePrincipal(asObject(row)))
      : [],
    consent: {
      popia: input.consent?.popia === true,
      credit_check: input.consent?.credit_check === true,
      terms_accepted: input.consent?.terms_accepted === true,
    },
    signature: {
      typed_name: clamp(input.signature?.typed_name, 120),
      capacity: clamp(input.signature?.capacity, 120),
    },
    info_response: clamp(input.info_response, 1000),
  };
  return out;
}

function sanitizeAddress(input: unknown) {
  const row = asObject(input);
  return {
    line1: clamp(row.line1, 160),
    line2: clamp(row.line2, 160),
    suburb: clamp(row.suburb, 80),
    city: clamp(row.city, 80),
    province: clamp(row.province, 80),
    postal_code: clamp(row.postal_code, 20),
    country: clamp(row.country, 80),
  };
}

function sanitizeContact(row: Record<string, unknown>) {
  return {
    name: clamp(row.name, 120),
    email: clamp(row.email, 120).toLowerCase(),
    phone: clamp(row.phone, 40),
    job_title: clamp(row.job_title, 80),
  };
}

function sanitizeTradeReference(row: Record<string, unknown>) {
  return {
    company: clamp(row.company, 160),
    contact: clamp(row.contact, 120),
    phone: clamp(row.phone, 40),
    email: clamp(row.email, 120).toLowerCase(),
    account_since: clamp(row.account_since, 40),
    typical_monthly_spend: clamp(row.typical_monthly_spend, 40),
    terms: clamp(row.terms, 80),
  };
}

function sanitizePrincipal(row: Record<string, unknown>): CreditApplicationPrincipalInput {
  return {
    id: Number.isFinite(Number(row.id)) ? Number(row.id) : undefined,
    full_name: clamp(row.full_name, 120),
    role: clamp(row.role, 80),
    id_type: ['sa_id', 'passport', 'other'].includes(String(row.id_type))
      ? (String(row.id_type) as 'sa_id' | 'passport' | 'other')
      : 'other',
    id_number: clamp(row.id_number, 40),
    id_number_enc: clamp(row.id_number_enc, 600),
    id_number_last4: clamp(row.id_number_last4, 4),
    nationality: clamp(row.nationality, 80),
    residential_address: sanitizeAddress(row.residential_address),
    email: clamp(row.email, 120).toLowerCase(),
    phone: clamp(row.phone, 40),
    shareholding_pct: row.shareholding_pct != null ? Number(row.shareholding_pct) : undefined,
    surety_offered: row.surety_offered === true,
    surety_signature: {
      typed_name: clamp(asObject(row.surety_signature).typed_name, 120),
      capacity: clamp(asObject(row.surety_signature).capacity, 120),
      signed_at: clamp(asObject(row.surety_signature).signed_at, 40),
    },
  };
}

function validateCommon(input: CreditApplicationInput): string[] {
  const errors: string[] = [];
  const root = asObject(input);
  rejectUnknownKeys(root, [
    'country_code', 'form_version', 'business', 'addresses', 'contacts', 'trade_references', 'bank',
    'requested_limit', 'requested_terms', 'requested_terms_other', 'currency', 'principals', 'consent', 'signature', 'info_response',
  ], errors, 'data');
  rejectUnknownKeys(asObject(input.business), ['trading_name', 'registered_name', 'entity_type', 'registration_number', 'vat_number', 'years_trading', 'industry'], errors, 'data.business');
  rejectUnknownKeys(asObject(input.addresses), ['physical', 'postal', 'delivery'], errors, 'data.addresses');
  rejectUnknownKeys(asObject(input.contacts), ['accounts', 'buyer'], errors, 'data.contacts');
  rejectUnknownKeys(asObject(asObject(input.contacts).accounts), ['name', 'email', 'phone', 'job_title'], errors, 'data.contacts.accounts');
  rejectUnknownKeys(asObject(asObject(input.contacts).buyer), ['name', 'email', 'phone', 'job_title'], errors, 'data.contacts.buyer');
  rejectUnknownKeys(asObject(input.bank), ['bank_name', 'branch_name', 'branch_code', 'account_type', 'account_holder', 'account_number', 'account_number_enc', 'account_number_last4'], errors, 'data.bank');
  rejectUnknownKeys(asObject(input.consent), ['popia', 'credit_check', 'terms_accepted'], errors, 'data.consent');
  rejectUnknownKeys(asObject(input.signature), ['typed_name', 'capacity'], errors, 'data.signature');

  const refs = Array.isArray(input.trade_references) ? input.trade_references : [];
  refs.forEach((row, i) => {
    rejectUnknownKeys(asObject(row), ['company', 'contact', 'phone', 'email', 'account_since', 'typical_monthly_spend', 'terms'], errors, `data.trade_references[${i}]`);
  });
  const principals = Array.isArray(input.principals) ? input.principals : [];
  principals.forEach((row, i) => {
    rejectUnknownKeys(asObject(row), ['id', 'full_name', 'role', 'id_type', 'id_number', 'id_number_enc', 'id_number_last4', 'nationality', 'residential_address', 'email', 'phone', 'shareholding_pct', 'surety_offered', 'surety_signature'], errors, `data.principals[${i}]`);
  });

  return errors;
}

export function validateDraft(input: CreditApplicationInput): ValidationResult {
  const errors = validateCommon(input);
  const sanitized = sanitizeCreditInput(input);
  if (sanitized.requested_limit != null && (!Number.isFinite(Number(sanitized.requested_limit)) || Number(sanitized.requested_limit) < 0)) {
    errors.push('requested_limit must be >= 0');
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, value: sanitized };
}

function requireField(value: unknown, label: string, errors: string[]) {
  if (!clamp(value)) errors.push(`${label} is required`);
}

export function validateSubmit(input: CreditApplicationInput, documents: CreditApplicationDocument[]): ValidationResult {
  const errors = validateCommon(input);
  const sanitized = sanitizeCreditInput(input);
  const fieldDef = fieldDefForCountry(sanitized.country_code);

  requireField(sanitized.business?.trading_name, 'business.trading_name', errors);
  requireField(sanitized.business?.registered_name, 'business.registered_name', errors);
  requireField(sanitized.business?.entity_type, 'business.entity_type', errors);
  requireField(sanitized.business?.registration_number, 'business.registration_number', errors);
  requireField(sanitized.contacts?.accounts?.name, 'contacts.accounts.name', errors);
  requireField(sanitized.contacts?.accounts?.email, 'contacts.accounts.email', errors);
  requireField(sanitized.contacts?.buyer?.name, 'contacts.buyer.name', errors);
  requireField(sanitized.contacts?.buyer?.email, 'contacts.buyer.email', errors);
  requireField(sanitized.bank?.bank_name, 'bank.bank_name', errors);
  requireField(sanitized.bank?.branch_code, 'bank.branch_code', errors);
  requireField(sanitized.bank?.account_holder, 'bank.account_holder', errors);
  requireField(sanitized.bank?.account_number, 'bank.account_number', errors);

  if (!fieldDef.registration_format.test(String(sanitized.business?.registration_number || ''))) {
    errors.push('business.registration_number format is invalid');
  }
  if (sanitized.business?.vat_number && fieldDef.vat_format && !fieldDef.vat_format.test(String(sanitized.business.vat_number))) {
    errors.push('business.vat_number format is invalid');
  }
  if (fieldDef.branch_code_format && !fieldDef.branch_code_format.test(String(sanitized.bank?.branch_code || ''))) {
    errors.push('bank.branch_code format is invalid');
  }

  const termsSelected = String(sanitized.requested_terms || '');
  if (!termsSelected) errors.push('requested_terms is required');
  if (termsSelected && !CREDIT_TERM_OPTIONS.includes(termsSelected as (typeof CREDIT_TERM_OPTIONS)[number])) {
    errors.push('requested_terms is invalid');
  }
  if (termsSelected === 'Other' && !normalizeRequestedTerms(sanitized)) {
    errors.push('requested_terms_other is required when terms is Other');
  }

  if (!Array.isArray(sanitized.trade_references) || sanitized.trade_references.length < 3) {
    errors.push('At least 3 trade references are required');
  }
  for (const [i, ref] of (sanitized.trade_references || []).entries()) {
    requireField(ref.company, `trade_references[${i}].company`, errors);
    requireField(ref.contact, `trade_references[${i}].contact`, errors);
    requireField(ref.phone, `trade_references[${i}].phone`, errors);
    requireField(ref.email, `trade_references[${i}].email`, errors);
  }

  const principals = sanitized.principals || [];
  if (!principals.length) errors.push('At least one principal is required');
  for (const [i, p] of principals.entries()) {
    requireField(p.full_name, `principals[${i}].full_name`, errors);
    requireField(p.role, `principals[${i}].role`, errors);
    if (p.id_type === 'sa_id' && !isValidSaId(p.id_number)) {
      errors.push(`principals[${i}].id_number invalid SA ID`);
    }
    if (p.id_type !== 'sa_id' && !clamp(p.id_number)) {
      errors.push(`principals[${i}].id_number is required`);
    }
  }

  if (sanitized.consent?.popia !== true) errors.push('POPIA consent is required');
  if (sanitized.consent?.credit_check !== true) errors.push('Credit check consent is required');
  if (sanitized.consent?.terms_accepted !== true) errors.push('Terms acceptance is required');
  requireField(sanitized.signature?.typed_name, 'signature.typed_name', errors);
  requireField(sanitized.signature?.capacity, 'signature.capacity', errors);

  const docs = Array.isArray(documents) ? documents : [];
  const byType = new Map<CreditApplicationDocumentType, CreditApplicationDocument[]>();
  for (const d of docs) {
    if (!byType.has(d.doc_type)) byType.set(d.doc_type, []);
    byType.get(d.doc_type)?.push(d);
  }
  if (!byType.get('cipc_registration')?.length) errors.push('cipc_registration document is required');
  if (!byType.get('bank_confirmation')?.length) errors.push('bank_confirmation document is required');
  if (sanitized.business?.vat_number && !byType.get('vat_certificate')?.length) {
    errors.push('vat_certificate document is required when vat_number is provided');
  }

  const idCopyDocs = byType.get('id_copy') || [];
  if (idCopyDocs.length < principals.length) {
    errors.push('id_copy documents are required for each principal');
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, value: sanitized };
}

export type SniffedFileType = 'application/pdf' | 'image/png' | 'image/jpeg' | 'image/webp' | null;

export function sniffFileType(bytes: Uint8Array): SniffedFileType {
  if (bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return 'application/pdf';
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'image/webp';
  return null;
}

const ALLOWED_UPLOAD_TYPES = new Set<SniffedFileType>(['application/pdf', 'image/png', 'image/jpeg', 'image/webp']);

export function validateUploadFile(opts: {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  bytes: Uint8Array;
}): { ok: true; mimeType: NonNullable<SniffedFileType> } | { ok: false; error: string } {
  const size = Number(opts.sizeBytes) || 0;
  if (size <= 0) return { ok: false, error: 'Empty file' };
  if (size > 10 * 1024 * 1024) return { ok: false, error: 'File exceeds 10MB limit' };
  const sniffed = sniffFileType(opts.bytes);
  if (!sniffed || !ALLOWED_UPLOAD_TYPES.has(sniffed)) return { ok: false, error: 'Unsupported file type' };
  const ext = String(opts.fileName || '').toLowerCase().split('.').pop() || '';
  const extMap: Record<string, string> = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
  if (ext && extMap[ext] && extMap[ext] !== sniffed) return { ok: false, error: 'File extension does not match file content' };
  if (opts.mimeType && opts.mimeType !== 'application/octet-stream' && opts.mimeType !== sniffed) {
    return { ok: false, error: 'File MIME does not match file content' };
  }
  return { ok: true, mimeType: sniffed };
}
