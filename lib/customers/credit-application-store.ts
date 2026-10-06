import { getSupabaseServer } from '@/lib/supabase/server-client';
import { missingSchemaColumn } from '@/lib/customers/schema-column';
import {
  accountLast4,
  creditInputErrors,
  isCreditStatus,
  maskAccountNumber,
  normalizePaymentTerms,
  parseApprovedLimit,
  portalSavePlan,
  sellerDecisionPlan,
  type CreditApplication,
  type CreditApplicationInput,
  type CreditApplicationStatus,
  type TradeReference,
} from '@/lib/customers/credit-application';

const APP_COLS =
  'id, profile_id, customer_id, status, legal_name, trading_name, registration_number, vat_number, billing_address, contact_name, contact_email, contact_phone, industry, years_trading, requested_limit, currency, payment_terms, expected_monthly, bank_name, bank_account_name, bank_branch_code, bank_account_number, trade_references, signatory_name, signatory_title, declaration_accepted, approved_limit, approved_terms, decision_notes, submitted_at, reviewed_at, reviewed_by, created_at, updated_at' as const;

const LIST_COLS =
  'id, profile_id, customer_id, status, legal_name, trading_name, requested_limit, currency, payment_terms, bank_name, bank_account_number, submitted_at, updated_at' as const;

export class CreditApplicationError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

type AppRow = {
  id: number;
  profile_id: number;
  customer_id: number;
  status: string | null;
  legal_name: string | null;
  trading_name: string | null;
  registration_number: string | null;
  vat_number: string | null;
  billing_address: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  industry: string | null;
  years_trading: number | null;
  requested_limit: number | string | null;
  currency: string | null;
  payment_terms: string | null;
  expected_monthly: number | string | null;
  bank_name: string | null;
  bank_account_name: string | null;
  bank_branch_code: string | null;
  bank_account_number: string | null;
  trade_references: unknown;
  signatory_name: string | null;
  signatory_title: string | null;
  declaration_accepted: boolean | null;
  approved_limit: number | string | null;
  approved_terms: string | null;
  decision_notes: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type CreditApplicationListItem = {
  id: number;
  customer_id: number;
  customer_name: string;
  status: CreditApplicationStatus;
  requested_limit: number | null;
  currency: string;
  payment_terms: string;
  bank_name: string;
  bank_last4: string;
  bank_masked: string;
  submitted_at: string | null;
  updated_at: string | null;
};

function text(value: string | null | undefined): string {
  return value == null ? '' : String(value);
}

function money(value: number | string | null | undefined): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

function isMissingSchema(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const msg = String(error.message || '');
  return (
    error.code === '42P01' ||
    error.code === 'PGRST204' ||
    error.code === 'PGRST205' ||
    /schema cache|does not exist|could not find the/i.test(msg)
  );
}

function schemaError(): CreditApplicationError {
  return new CreditApplicationError(
    'Credit applications are not on the database yet. Run RUN_THIS_FOR_CREDIT_APPLICATIONS.sql in the Supabase SQL editor.',
    503
  );
}

function referencesOf(value: unknown): TradeReference[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 3).map((row) => {
    const r = row && typeof row === 'object' ? (row as Record<string, unknown>) : {};
    return {
      company: text(r.company as string),
      contact: text(r.contact as string),
      phone: text(r.phone as string),
      email: text(r.email as string),
    };
  });
}

function toApplication(row: AppRow): CreditApplication {
  const status: CreditApplicationStatus = isCreditStatus(row.status) ? row.status : 'draft';
  return {
    id: Number(row.id),
    profile_id: Number(row.profile_id),
    customer_id: Number(row.customer_id),
    status,
    legal_name: text(row.legal_name),
    trading_name: text(row.trading_name),
    registration_number: text(row.registration_number),
    vat_number: text(row.vat_number),
    billing_address: text(row.billing_address),
    contact_name: text(row.contact_name),
    contact_email: text(row.contact_email),
    contact_phone: text(row.contact_phone),
    industry: text(row.industry),
    years_trading: row.years_trading != null ? Number(row.years_trading) : null,
    requested_limit: money(row.requested_limit),
    currency: text(row.currency) || 'ZAR',
    payment_terms: text(row.payment_terms),
    expected_monthly: money(row.expected_monthly),
    bank_name: text(row.bank_name),
    bank_account_name: text(row.bank_account_name),
    bank_branch_code: text(row.bank_branch_code),
    bank_account_number: text(row.bank_account_number),
    trade_references: referencesOf(row.trade_references),
    signatory_name: text(row.signatory_name),
    signatory_title: text(row.signatory_title),
    declaration_accepted: row.declaration_accepted === true,
    approved_limit: money(row.approved_limit),
    approved_terms: row.approved_terms ? text(row.approved_terms) : null,
    decision_notes: row.decision_notes ? text(row.decision_notes) : null,
    submitted_at: row.submitted_at,
    reviewed_at: row.reviewed_at,
    reviewed_by: row.reviewed_by ? text(row.reviewed_by) : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function blank(value: string): string | null {
  const t = value.trim();
  return t ? t : null;
}

function columnsFromInput(
  input: CreditApplicationInput,
  mode: 'draft' | 'submit',
  now: string
): Record<string, unknown> {
  return {
    legal_name: blank(input.legal_name),
    trading_name: blank(input.trading_name),
    registration_number: blank(input.registration_number),
    vat_number: blank(input.vat_number),
    billing_address: blank(input.billing_address),
    contact_name: blank(input.contact_name),
    contact_email: blank(input.contact_email),
    contact_phone: blank(input.contact_phone),
    industry: blank(input.industry),
    years_trading: input.years_trading,
    requested_limit: input.requested_limit,
    currency: input.currency || 'ZAR',
    payment_terms: blank(input.payment_terms),
    expected_monthly: input.expected_monthly,
    bank_name: blank(input.bank_name),
    bank_account_name: blank(input.bank_account_name),
    bank_branch_code: blank(input.bank_branch_code),
    bank_account_number: blank(input.bank_account_number),
    trade_references: input.trade_references,
    signatory_name: blank(input.signatory_name),
    signatory_title: blank(input.signatory_title),
    declaration_accepted: input.declaration_accepted,
    status: mode === 'submit' ? 'submitted' : 'draft',
    submitted_at: mode === 'submit' ? now : null,
    updated_at: now,
  };
}

async function openApplication(
  companyId: number,
  customerId: number
): Promise<CreditApplication | null> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('customer_credit_applications')
    .select(APP_COLS)
    .eq('profile_id', companyId)
    .eq('customer_id', customerId)
    .in('status', ['draft', 'submitted', 'in_review'])
    .maybeSingle();
  if (isMissingSchema(error)) throw schemaError();
  if (error) throw new CreditApplicationError(error.message, 500);
  if (!data) return null;
  return toApplication(data as AppRow);
}

async function latestApplication(
  companyId: number,
  customerId: number
): Promise<CreditApplication | null> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('customer_credit_applications')
    .select(APP_COLS)
    .eq('profile_id', companyId)
    .eq('customer_id', customerId)
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (isMissingSchema(error)) return null;
  if (error || !data) return null;
  return toApplication(data as AppRow);
}

/** Portal load. A missing table leaves the rest of the portal usable. */
export async function loadPortalCreditApplication(opts: {
  companyId: number;
  customerId: number;
}): Promise<CreditApplication | null> {
  try {
    return await latestApplication(opts.companyId, opts.customerId);
  } catch {
    return null;
  }
}

async function readById(companyId: number, id: number): Promise<CreditApplication | null> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('customer_credit_applications')
    .select(APP_COLS)
    .eq('profile_id', companyId)
    .eq('id', id)
    .maybeSingle();
  if (isMissingSchema(error)) throw schemaError();
  if (error) throw new CreditApplicationError(error.message, 500);
  if (!data) return null;
  return toApplication(data as AppRow);
}

export async function savePortalCreditApplication(opts: {
  companyId: number;
  customerId: number;
  mode: unknown;
  input: unknown;
}): Promise<CreditApplication> {
  const mode = opts.mode === 'submit' ? 'submit' : opts.mode === 'draft' ? 'draft' : null;
  if (!mode) {
    throw new CreditApplicationError('Choose save draft or submit.');
  }
  const { input, errors } = creditInputErrors(opts.input, mode);
  if (errors.length) {
    throw new CreditApplicationError(errors.join(' '));
  }
  const open = await openApplication(opts.companyId, opts.customerId);
  const plan = portalSavePlan(open?.status ?? null);
  if (plan === 'blocked') {
    throw new CreditApplicationError(
      'This application is with the seller. You can apply again after they decide.'
    );
  }
  const supabase = getSupabaseServer();
  const now = new Date().toISOString();
  const columns = columnsFromInput(input, mode, now);
  if (plan === 'update' && open) {
    const { data, error } = await supabase
      .from('customer_credit_applications')
      .update(columns)
      .eq('id', open.id)
      .eq('profile_id', opts.companyId)
      .eq('customer_id', opts.customerId)
      .select(APP_COLS)
      .maybeSingle();
    if (isMissingSchema(error)) throw schemaError();
    if (error || !data) {
      throw new CreditApplicationError(error?.message || 'Could not save the draft', 500);
    }
    return toApplication(data as AppRow);
  }
  const inserted = await supabase
    .from('customer_credit_applications')
    .insert({
      ...columns,
      profile_id: opts.companyId,
      customer_id: opts.customerId,
      created_at: now,
    })
    .select(APP_COLS)
    .maybeSingle();
  if (inserted.error && inserted.error.code === '23505') {
    const again = await openApplication(opts.companyId, opts.customerId);
    if (again?.status === 'draft') {
      const { data, error } = await supabase
        .from('customer_credit_applications')
        .update(columns)
        .eq('id', again.id)
        .eq('profile_id', opts.companyId)
        .select(APP_COLS)
        .maybeSingle();
      if (error || !data) {
        throw new CreditApplicationError(error?.message || 'Could not save the application', 500);
      }
      return toApplication(data as AppRow);
    }
    throw new CreditApplicationError(
      'This application is with the seller. You can apply again after they decide.'
    );
  }
  if (isMissingSchema(inserted.error)) throw schemaError();
  if (inserted.error || !inserted.data) {
    throw new CreditApplicationError(
      inserted.error?.message || 'Could not save the application',
      500
    );
  }
  return toApplication(inserted.data as AppRow);
}

async function customerFacts(
  companyId: number,
  ids: number[]
): Promise<Map<number, { name: string; credit_limit: number | null }>> {
  const map = new Map<number, { name: string; credit_limit: number | null }>();
  const unique = [...new Set(ids.filter((id) => id > 0))];
  if (!unique.length) return map;
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('customers')
    .select('id, trading_name, legal_name, credit_limit')
    .eq('profile_id', companyId)
    .in('id', unique);
  if (error) return map;
  for (const row of (data || []) as Array<{
    id: number;
    trading_name: string | null;
    legal_name: string | null;
    credit_limit: number | string | null;
  }>) {
    const name = String(row.trading_name || row.legal_name || '').trim();
    map.set(Number(row.id), {
      name: name || `Customer ${row.id}`,
      credit_limit: money(row.credit_limit),
    });
  }
  return map;
}

export async function listCreditApplications(opts: {
  companyId: number;
}): Promise<CreditApplicationListItem[]> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('customer_credit_applications')
    .select(LIST_COLS)
    .eq('profile_id', opts.companyId)
    .order('updated_at', { ascending: false })
    .limit(300);
  if (isMissingSchema(error)) throw schemaError();
  if (error) throw new CreditApplicationError(error.message, 500);
  const rows = (data || []) as Array<{
    id: number;
    customer_id: number;
    status: string | null;
    legal_name: string | null;
    trading_name: string | null;
    requested_limit: number | string | null;
    currency: string | null;
    payment_terms: string | null;
    bank_name: string | null;
    bank_account_number: string | null;
    submitted_at: string | null;
    updated_at: string | null;
  }>;
  const names = await customerFacts(
    opts.companyId,
    rows.map((r) => Number(r.customer_id))
  );
  const rank: Record<string, number> = {
    submitted: 0,
    in_review: 1,
    draft: 2,
    approved: 3,
    declined: 4,
  };
  return rows
    .map((row) => {
      const status: CreditApplicationStatus = isCreditStatus(row.status) ? row.status : 'draft';
      const account = text(row.bank_account_number);
      const named = names.get(Number(row.customer_id));
      const fallback = String(row.trading_name || row.legal_name || '').trim();
      return {
        id: Number(row.id),
        customer_id: Number(row.customer_id),
        customer_name: named?.name || fallback || `Customer ${row.customer_id}`,
        status,
        requested_limit: money(row.requested_limit),
        currency: text(row.currency) || 'ZAR',
        payment_terms: text(row.payment_terms),
        bank_name: text(row.bank_name),
        bank_last4: accountLast4(account),
        bank_masked: maskAccountNumber(account),
        submitted_at: row.submitted_at,
        updated_at: row.updated_at,
      };
    })
    .sort((a, b) => {
      const d = (rank[a.status] ?? 9) - (rank[b.status] ?? 9);
      if (d !== 0) return d;
      return String(b.updated_at || '').localeCompare(String(a.updated_at || ''));
    });
}

export async function getCreditApplication(opts: {
  companyId: number;
  id: number;
}): Promise<CreditApplication | null> {
  const app = await readById(opts.companyId, opts.id);
  if (!app) return null;
  const facts = await customerFacts(opts.companyId, [app.customer_id]);
  const fact = facts.get(app.customer_id);
  app.customer_name =
    fact?.name ||
    app.trading_name ||
    app.legal_name ||
    `Customer ${app.customer_id}`;
  app.current_credit_limit = fact?.credit_limit ?? null;
  return app;
}

async function writeApprovedCustomer(opts: {
  companyId: number;
  customerId: number;
  limit: number;
  terms: string;
}): Promise<void> {
  const supabase = getSupabaseServer();
  const { data: cust, error: findError } = await supabase
    .from('customers')
    .select('id')
    .eq('id', opts.customerId)
    .eq('profile_id', opts.companyId)
    .maybeSingle();
  if (findError) throw new CreditApplicationError(findError.message, 500);
  if (!cust) throw new CreditApplicationError('Customer not found', 404);
  const patch: Record<string, unknown> = {
    credit_limit: opts.limit,
    updated_at: new Date().toISOString(),
  };
  if (opts.terms) patch.payment_terms = opts.terms;
  let { error } = await supabase
    .from('customers')
    .update(patch)
    .eq('id', opts.customerId)
    .eq('profile_id', opts.companyId);
  if (error) {
    const col = missingSchemaColumn(error.message);
    if (col && col !== 'credit_limit' && Object.prototype.hasOwnProperty.call(patch, col)) {
      delete patch[col];
      const retry = await supabase
        .from('customers')
        .update(patch)
        .eq('id', opts.customerId)
        .eq('profile_id', opts.companyId);
      error = retry.error;
    }
  }
  if (error) throw new CreditApplicationError(error.message, 500);
}

export async function decideCreditApplication(opts: {
  companyId: number;
  id: number;
  decision: unknown;
  approvedLimit: unknown;
  approvedTerms: unknown;
  notes: unknown;
  reviewedBy: string;
}): Promise<CreditApplication> {
  const decision = String(opts.decision || '');
  if (decision !== 'in_review' && decision !== 'approved' && decision !== 'declined') {
    throw new CreditApplicationError('Choose in review, approve, or decline.');
  }
  const app = await readById(opts.companyId, opts.id);
  if (!app) throw new CreditApplicationError('Application not found', 404);
  const plan = sellerDecisionPlan(app.status);
  if (plan === 'draft') {
    throw new CreditApplicationError('The customer has not submitted this application.');
  }
  if (plan === 'closed') {
    throw new CreditApplicationError('This application is already decided.');
  }
  const notes = String(opts.notes ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 2000);
  const terms = normalizePaymentTerms(opts.approvedTerms);
  if (String(opts.approvedTerms ?? '').trim() && !terms) {
    throw new CreditApplicationError('Choose payment terms from the list.');
  }
  let approvedLimit = app.approved_limit;
  if (decision === 'approved') {
    approvedLimit = parseApprovedLimit(opts.approvedLimit);
    if (approvedLimit == null) {
      throw new CreditApplicationError('Enter an approved credit limit above 0.');
    }
    await writeApprovedCustomer({
      companyId: opts.companyId,
      customerId: app.customer_id,
      limit: approvedLimit,
      terms,
    });
  }
  const now = new Date().toISOString();
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('customer_credit_applications')
    .update({
      status: decision,
      approved_limit: decision === 'approved' ? approvedLimit : app.approved_limit,
      approved_terms: decision === 'approved' ? terms || null : app.approved_terms,
      decision_notes: notes || null,
      reviewed_at: now,
      reviewed_by: opts.reviewedBy.slice(0, 200) || null,
      updated_at: now,
    })
    .eq('id', app.id)
    .eq('profile_id', opts.companyId)
    .select(APP_COLS)
    .maybeSingle();
  if (error || !data) {
    throw new CreditApplicationError(error?.message || 'Could not save the decision', 500);
  }
  const saved = toApplication(data as AppRow);
  const facts = await customerFacts(opts.companyId, [saved.customer_id]);
  const fact = facts.get(saved.customer_id);
  saved.customer_name = fact?.name || saved.trading_name || saved.legal_name;
  saved.current_credit_limit = fact?.credit_limit ?? null;
  return saved;
}
