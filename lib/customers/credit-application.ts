/**
 * Trade-credit application: what the customer fills in, and what the seller
 * may decide. No database access — the portal and the Customers page share this.
 */

export const CREDIT_PAYMENT_TERMS = [
  'COD',
  '7 days',
  '14 days',
  '30 days',
  '45 days',
  '60 days',
] as const;

export type CreditPaymentTerm = (typeof CREDIT_PAYMENT_TERMS)[number];

export const CREDIT_APPLICATION_STATUSES = [
  'draft',
  'submitted',
  'in_review',
  'approved',
  'declined',
] as const;

export type CreditApplicationStatus = (typeof CREDIT_APPLICATION_STATUSES)[number];

export type TradeReference = {
  company: string;
  contact: string;
  phone: string;
  email: string;
};

export type CreditApplicationInput = {
  legal_name: string;
  trading_name: string;
  registration_number: string;
  vat_number: string;
  billing_address: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  industry: string;
  years_trading: number | null;
  requested_limit: number | null;
  currency: string;
  payment_terms: string;
  expected_monthly: number | null;
  bank_name: string;
  bank_account_name: string;
  bank_branch_code: string;
  bank_account_number: string;
  trade_references: TradeReference[];
  signatory_name: string;
  signatory_title: string;
  declaration_accepted: boolean;
};

export const CREDIT_DOCUMENT_KINDS = [
  { id: 'cipc', label: 'Company registration (CIPC)' },
  { id: 'bank_letter', label: 'Bank confirmation letter' },
  { id: 'identity', label: 'Signatory identity document' },
] as const;

export type CreditDocumentKind = (typeof CREDIT_DOCUMENT_KINDS)[number]['id'];

export type CreditDocumentMeta = {
  id: string;
  kind: CreditDocumentKind;
  name: string;
  uploaded_at: string;
};

export function creditDocumentKind(value: unknown): CreditDocumentKind | null {
  const id = String(value || '');
  return CREDIT_DOCUMENT_KINDS.some((kind) => kind.id === id)
    ? (id as CreditDocumentKind)
    : null;
}

export function creditDocumentLabel(kind: string): string {
  return CREDIT_DOCUMENT_KINDS.find((row) => row.id === kind)?.label || 'Document';
}

export type CreditApplication = CreditApplicationInput & {
  id: number;
  profile_id: number;
  customer_id: number;
  status: CreditApplicationStatus;
  supporting_documents: CreditDocumentMeta[];
  approved_limit: number | null;
  approved_terms: string | null;
  decision_notes: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  customer_name?: string | null;
  current_credit_limit?: number | null;
};

export const CREDIT_DECLARATION =
  'I confirm this information is true and I authorise the seller to contact the trade references and the bank named on this form.';

const TERM_SET = new Set<string>(CREDIT_PAYMENT_TERMS);

export function emptyCreditInput(): CreditApplicationInput {
  return {
    legal_name: '',
    trading_name: '',
    registration_number: '',
    vat_number: '',
    billing_address: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    industry: '',
    years_trading: null,
    requested_limit: null,
    currency: 'ZAR',
    payment_terms: '',
    expected_monthly: null,
    bank_name: '',
    bank_account_name: '',
    bank_branch_code: '',
    bank_account_number: '',
    trade_references: [],
    signatory_name: '',
    signatory_title: '',
    declaration_accepted: false,
  };
}

function clip(value: unknown, max: number): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function digitsOnly(value: unknown, max: number): string {
  return String(value ?? '')
    .replace(/\D/g, '')
    .slice(0, max);
}

function moneyOrNull(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(String(value).replace(/,/g, '').trim());
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

function yearsOrNull(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(String(value).trim());
  if (!Number.isFinite(n)) return null;
  return Math.round(n);
}

/** Map free-text terms such as "Net 30" onto the form's list, or ''. */
export function normalizePaymentTerms(value: unknown): string {
  const raw = clip(value, 40).toLowerCase().replace(/[_-]+/g, ' ');
  if (!raw) return '';
  if (raw === 'cod' || raw === 'cash' || raw === 'cash on delivery') return 'COD';
  const days = /(\d{1,3})/.exec(raw);
  if (!days) return TERM_SET.has(clip(value, 40)) ? clip(value, 40) : '';
  const label = `${Number(days[1])} days`;
  if (label === '0 days') return '';
  if (TERM_SET.has(label)) return label;
  if (raw === 'cod') return 'COD';
  return '';
}

function normalizeReferences(value: unknown): TradeReference[] {
  if (!Array.isArray(value)) return [];
  const out: TradeReference[] = [];
  for (const row of value) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const ref: TradeReference = {
      company: clip(r.company, 160),
      contact: clip(r.contact, 120),
      phone: digitsOnly(r.phone, 20),
      email: clip(r.email, 240).toLowerCase(),
    };
    if (!ref.company && !ref.contact && !ref.phone && !ref.email) continue;
    out.push(ref);
    if (out.length >= 3) break;
  }
  return out;
}

export function normalizeCreditInput(raw: unknown): CreditApplicationInput {
  const body =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const currency = clip(body.currency, 3).toUpperCase();
  return {
    legal_name: clip(body.legal_name, 200),
    trading_name: clip(body.trading_name, 200),
    registration_number: clip(body.registration_number, 40),
    vat_number: clip(body.vat_number, 40),
    billing_address: clip(body.billing_address, 500),
    contact_name: clip(body.contact_name, 120),
    contact_email: clip(body.contact_email, 240).toLowerCase(),
    contact_phone: digitsOnly(body.contact_phone, 20),
    industry: clip(body.industry, 120),
    years_trading: yearsOrNull(body.years_trading),
    requested_limit: moneyOrNull(body.requested_limit),
    currency: /^[A-Z]{3}$/.test(currency) ? currency : 'ZAR',
    payment_terms: normalizePaymentTerms(body.payment_terms),
    expected_monthly: moneyOrNull(body.expected_monthly),
    bank_name: clip(body.bank_name, 120),
    bank_account_name: clip(body.bank_account_name, 160),
    bank_branch_code: digitsOnly(body.bank_branch_code, 12),
    bank_account_number: digitsOnly(body.bank_account_number, 20),
    trade_references: normalizeReferences(body.trade_references),
    signatory_name: clip(body.signatory_name, 120),
    signatory_title: clip(body.signatory_title, 120),
    declaration_accepted: body.declaration_accepted === true || body.declaration_accepted === 'true',
  };
}

function emailOk(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function validateCreditInput(
  input: CreditApplicationInput,
  mode: 'draft' | 'submit'
): string[] {
  const errors: string[] = [];
  if (input.contact_email && !emailOk(input.contact_email)) {
    errors.push('Enter a valid contact email.');
  }
  if (input.years_trading != null && (input.years_trading < 0 || input.years_trading > 200)) {
    errors.push('Years trading must be between 0 and 200.');
  }
  if (input.requested_limit != null && input.requested_limit <= 0) {
    errors.push('Requested limit must be above 0.');
  }
  if (input.requested_limit != null && input.requested_limit > 1_000_000_000_000) {
    errors.push('Requested limit is too large.');
  }
  if (input.expected_monthly != null && input.expected_monthly < 0) {
    errors.push('Expected monthly purchases cannot be negative.');
  }
  for (const ref of input.trade_references) {
    if (ref.email && !emailOk(ref.email)) {
      errors.push(`Enter a valid email for ${ref.company || 'the trade reference'}.`);
    }
  }
  if (mode === 'draft') return errors;

  if (!input.legal_name && !input.trading_name) {
    errors.push('Add a legal name or a trading name.');
  }
  if (!input.contact_name) errors.push('Add a contact name.');
  if (!input.contact_email) errors.push('Add a contact email.');
  if (input.contact_phone.length < 6) errors.push('Add a contact phone number.');
  if (!input.billing_address) errors.push('Add a billing address.');
  if (input.requested_limit == null || input.requested_limit <= 0) {
    errors.push('Enter the credit limit you are asking for.');
  }
  if (!TERM_SET.has(input.payment_terms)) {
    errors.push('Choose payment terms.');
  }
  if (!input.bank_name) errors.push('Add the bank name.');
  if (!input.bank_account_name) errors.push('Add the bank account name.');
  if (input.bank_account_number.length < 6) {
    errors.push('Add a bank account number of at least 6 digits.');
  }
  if (!input.signatory_name) errors.push('Add the signatory name.');
  if (!input.declaration_accepted) {
    errors.push('Accept the declaration before submitting.');
  }
  const complete = input.trade_references.filter((r) => r.company && r.phone.length >= 6);
  const partial = input.trade_references.some(
    (r) => (r.company || r.phone || r.contact || r.email) && !(r.company && r.phone.length >= 6)
  );
  if (partial) {
    errors.push('Each trade reference needs a company and a phone number.');
  }
  if (complete.length < 1) {
    errors.push('Add at least one trade reference with a company and a phone number.');
  }
  return errors;
}

export function creditInputErrors(
  raw: unknown,
  mode: 'draft' | 'submit'
): { input: CreditApplicationInput; errors: string[] } {
  const input = normalizeCreditInput(raw);
  return { input, errors: validateCreditInput(input, mode) };
}

/** List view shows the last four digits only. */
export function maskAccountNumber(account: string): string {
  const digits = String(account || '').replace(/\D/g, '');
  if (digits.length < 4) return digits ? '••••' : '';
  return `•••• ${digits.slice(-4)}`;
}

export function accountLast4(account: string): string {
  const digits = String(account || '').replace(/\D/g, '');
  return digits.length >= 4 ? digits.slice(-4) : '';
}

/** One open application (draft, submitted, in review). A decision allows a new one. */
export function portalSavePlan(
  status: CreditApplicationStatus | null
): 'update' | 'insert' | 'blocked' {
  if (status == null || status === 'approved' || status === 'declined') return 'insert';
  if (status === 'draft') return 'update';
  return 'blocked';
}

export function sellerDecisionPlan(
  status: CreditApplicationStatus
): 'allow' | 'draft' | 'closed' {
  if (status === 'draft') return 'draft';
  if (status === 'submitted' || status === 'in_review') return 'allow';
  return 'closed';
}

export function parseApprovedLimit(value: unknown): number | null {
  const n = moneyOrNull(value);
  if (n == null || n <= 0 || n > 1_000_000_000_000) return null;
  return n;
}

export function isCreditStatus(value: unknown): value is CreditApplicationStatus {
  return (CREDIT_APPLICATION_STATUSES as readonly string[]).includes(String(value || ''));
}

export function creditStatusLabel(status: CreditApplicationStatus): string {
  if (status === 'in_review') return 'In review';
  if (status === 'draft') return 'Draft';
  if (status === 'submitted') return 'Submitted';
  if (status === 'approved') return 'Approved';
  return 'Declined';
}

type BookPrefill = {
  legal_name?: string;
  trading_name?: string;
  registration_number?: string;
  vat_number?: string;
  address?: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  industry?: string;
  payment_terms?: string;
} | null;

export function prefillCreditFromBook(book: BookPrefill): CreditApplicationInput {
  const base = emptyCreditInput();
  if (!book) return base;
  return normalizeCreditInput({
    ...base,
    legal_name: book.legal_name || '',
    trading_name: book.trading_name || '',
    registration_number: book.registration_number || '',
    vat_number: book.vat_number || '',
    billing_address: book.address || '',
    contact_name: book.contact_name || '',
    contact_email: book.email || '',
    contact_phone: book.phone || '',
    industry: book.industry || '',
    payment_terms: book.payment_terms || '',
  });
}
