import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  postBalancedJournal,
  resolveCoaAccountIdByCode,
  reversePostedJournal,
} from '@/lib/accounting/post-journal';
import {
  REFERRAL_EXPENSE_CODES,
  REFERRAL_PAYABLE_CODE,
  referralJournalLines,
} from '@/lib/accounting/referral-commission-journal';
import { bookIlikeOr } from '@/lib/security/book-search';
import {
  buildReferralCommission,
  normalizeRedeemMethod,
  normalizeReferralBasis,
  normalizeReferralEarnOn,
  roundMoney,
  type PartnerCommissionStatement,
  type ReferralAgreement,
  type ReferralCustomerLink,
  type ReferralInvoice,
  type ReferralPayment,
  type ReferralRedemption,
} from '@/lib/accounting/referral-commission';

const AGREEMENT_COLS =
  'id, profile_id, partner_profile_id, partner_name, rate_pct, basis, earn_on, status, notes';
const INVOICE_COLS =
  'id, profile_id, invoice_number, customer_id, customer_name, status, issue_date, subtotal, total_amount, amount_paid, referral_partner_profile_id';
const CUSTOMER_COLS =
  'id, trading_name, legal_name, referral_partner_profile_id';
const PAYMENT_COLS = 'id, invoice_id, amount, paid_at, reference';
const REDEEM_COLS =
  'id, profile_id, partner_profile_id, amount, redeemed_on, method, reference, notes, journal_entry_id';

export class ReferralSchemaError extends Error {
  constructor() {
    super(
      'Referral commission is not on the database yet. Run RUN_THIS_FOR_REFERRAL_COMMISSION.sql in the Supabase SQL editor.'
    );
  }
}

type AgreementRow = {
  id: number;
  profile_id: number;
  partner_profile_id: number;
  partner_name: string | null;
  rate_pct: number | string | null;
  basis: string | null;
  earn_on: string | null;
  status: string | null;
  notes: string | null;
};

type InvoiceRow = {
  id: number;
  profile_id: number;
  invoice_number: string | null;
  customer_id: number | null;
  customer_name: string | null;
  status: string | null;
  issue_date: string | null;
  subtotal: number | string | null;
  total_amount: number | string | null;
  amount_paid: number | string | null;
  referral_partner_profile_id: number | null;
};

type CustomerRow = {
  id: number;
  trading_name: string | null;
  legal_name: string | null;
  referral_partner_profile_id: number | null;
};

type PaymentRow = {
  id: number;
  invoice_id: number;
  amount: number | string | null;
  paid_at: string | null;
  reference: string | null;
};

type RedeemRow = {
  id: number;
  profile_id: number;
  partner_profile_id: number;
  amount: number | string | null;
  redeemed_on: string | null;
  method: string | null;
  reference: string | null;
  notes: string | null;
  journal_entry_id?: number | string | null;
};

export type ReferralCustomerChoice = {
  id: number;
  name: string;
  referral_partner_profile_id: number | null;
};

export type ReferralCompanyHit = {
  id: number;
  name: string;
  legal_name: string;
};

function asNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
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

function throwIfSchema(error: { message?: string; code?: string } | null): void {
  if (isMissingSchema(error)) throw new ReferralSchemaError();
}

function dayOnly(value: string | null | undefined): string {
  return String(value || '').slice(0, 10);
}

function companyLabel(
  trading: string | null | undefined,
  legal: string | null | undefined,
  id: number
): string {
  const name = String(trading || legal || '').trim();
  return name || `Company ${id}`;
}

async function profileNames(ids: number[]): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  const unique = [...new Set(ids.filter((id) => id > 0))];
  if (!unique.length) return map;
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, trading_name, legal_name')
    .in('id', unique);
  if (error) throw new Error(error.message);
  for (const row of (data || []) as Array<{
    id: number;
    trading_name: string | null;
    legal_name: string | null;
  }>) {
    map.set(row.id, companyLabel(row.trading_name, row.legal_name, row.id));
  }
  return map;
}

function toAgreement(row: AgreementRow, sellerName: string): ReferralAgreement {
  return {
    seller_profile_id: Number(row.profile_id),
    seller_name: sellerName,
    partner_profile_id: Number(row.partner_profile_id),
    partner_name:
      String(row.partner_name || '').trim() ||
      `Company ${row.partner_profile_id}`,
    rate_pct: asNumber(row.rate_pct),
    basis: normalizeReferralBasis(row.basis),
    earn_on: normalizeReferralEarnOn(row.earn_on),
    status: String(row.status || 'active'),
    notes: row.notes,
  };
}

function toInvoice(row: InvoiceRow): ReferralInvoice {
  return {
    id: Number(row.id),
    seller_profile_id: Number(row.profile_id),
    invoice_number: String(row.invoice_number || `#${row.id}`),
    customer_id: row.customer_id != null ? Number(row.customer_id) : null,
    customer_name: String(row.customer_name || '').trim() || 'Customer',
    status: String(row.status || ''),
    issue_date: dayOnly(row.issue_date) || null,
    subtotal: asNumber(row.subtotal),
    total_amount: asNumber(row.total_amount),
    amount_paid: asNumber(row.amount_paid),
    referral_partner_profile_id:
      row.referral_partner_profile_id != null
        ? Number(row.referral_partner_profile_id)
        : null,
  };
}

function toCustomerLink(row: CustomerRow): ReferralCustomerLink {
  return {
    id: Number(row.id),
    referral_partner_profile_id:
      row.referral_partner_profile_id != null
        ? Number(row.referral_partner_profile_id)
        : null,
  };
}

function toPayment(row: PaymentRow): ReferralPayment {
  return {
    id: Number(row.id),
    invoice_id: Number(row.invoice_id),
    amount: asNumber(row.amount),
    paid_at: String(row.paid_at || ''),
    reference: row.reference,
  };
}

function toRedemption(row: RedeemRow): ReferralRedemption {
  return {
    id: Number(row.id),
    seller_profile_id: Number(row.profile_id),
    partner_profile_id: Number(row.partner_profile_id),
    amount: asNumber(row.amount),
    redeemed_on: dayOnly(row.redeemed_on),
    method: String(row.method || 'paid'),
    reference: row.reference,
    notes: row.notes,
    journal_entry_id:
      row.journal_entry_id != null && Number(row.journal_entry_id) > 0
        ? Number(row.journal_entry_id)
        : null,
  };
}

async function loadAgreements(filter: {
  sellerId?: number;
  partnerId?: number;
}): Promise<AgreementRow[]> {
  const supabase = getSupabaseServer();
  let query = supabase.from('referral_commission_agreements').select(AGREEMENT_COLS);
  if (filter.sellerId) query = query.eq('profile_id', filter.sellerId);
  if (filter.partnerId) query = query.eq('partner_profile_id', filter.partnerId);
  const { data, error } = await query.order('partner_name');
  throwIfSchema(error);
  if (error) throw new Error(error.message);
  return (data || []) as AgreementRow[];
}

async function loadSellerBooks(sellerId: number, partnerId?: number): Promise<{
  invoices: ReferralInvoice[];
  customers: CustomerRow[];
  payments: ReferralPayment[];
  redemptions: ReferralRedemption[];
  truncated: boolean;
}> {
  const supabase = getSupabaseServer();
  let customerQuery = supabase
    .from('customers')
    .select(CUSTOMER_COLS)
    .eq('profile_id', sellerId)
    .order('trading_name')
    .limit(2000);
  if (partnerId) customerQuery = customerQuery.eq('referral_partner_profile_id', partnerId);
  const { data: customerData, error: customerError } = await customerQuery;
  throwIfSchema(customerError);
  if (customerError) throw new Error(customerError.message);
  const customers = (customerData || []) as CustomerRow[];

  let invoiceQuery = supabase
    .from('customer_invoices')
    .select(INVOICE_COLS)
    .eq('profile_id', sellerId)
    .order('issue_date', { ascending: false })
    .limit(5000);
  if (partnerId) {
    const ids = customers.map((row) => Number(row.id)).filter((id) => id > 0);
    const parts = [`referral_partner_profile_id.eq.${partnerId}`];
    if (ids.length) parts.push(`customer_id.in.(${ids.join(',')})`);
    invoiceQuery = invoiceQuery.or(parts.join(','));
  }
  let redeemQuery = supabase
    .from('referral_commission_redemptions')
    .select(REDEEM_COLS)
    .eq('profile_id', sellerId);
  if (partnerId) redeemQuery = redeemQuery.eq('partner_profile_id', partnerId);
  const [invoiceResult, redeemResult] = await Promise.all([invoiceQuery, redeemQuery]);
  const { data: invoiceData, error: invoiceError } = invoiceResult;
  throwIfSchema(invoiceError);
  if (invoiceError) throw new Error(invoiceError.message);
  const invoiceRows = (invoiceData || []) as InvoiceRow[];
  const { data: redeemData, error: redeemError } = redeemResult;
  throwIfSchema(redeemError);
  if (redeemError) throw new Error(redeemError.message);

  const invoiceIds = invoiceRows.map((row) => Number(row.id));
  const slices: number[][] = [];
  for (let i = 0; i < invoiceIds.length; i += 150) {
    slices.push(invoiceIds.slice(i, i + 150));
  }
  const paymentBatches = await Promise.all(
    slices.map((slice) =>
      supabase
        .from('customer_invoice_payments')
        .select(PAYMENT_COLS)
        .eq('profile_id', sellerId)
        .in('invoice_id', slice)
    )
  );
  const payments: ReferralPayment[] = [];
  for (const batch of paymentBatches) {
    if (batch.error) throw new Error(batch.error.message);
    payments.push(...((batch.data || []) as PaymentRow[]).map(toPayment));
  }

  return {
    invoices: invoiceRows.map(toInvoice),
    customers,
    payments,
    redemptions: ((redeemData || []) as RedeemRow[]).map(toRedemption),
    truncated: invoiceRows.length >= 5000,
  };
}

export async function loadSellerCommission(opts: {
  sellerId: number;
  from: string;
  to: string;
}): Promise<{
  partners: PartnerCommissionStatement[];
  customers: ReferralCustomerChoice[];
  warning: string | null;
}> {
  const rows = await loadAgreements({ sellerId: opts.sellerId });
  const [names, books] = await Promise.all([
    profileNames([
      opts.sellerId,
      ...rows.map((row) => Number(row.partner_profile_id)),
    ]),
    loadSellerBooks(opts.sellerId),
  ]);
  const sellerName = names.get(opts.sellerId) || `Company ${opts.sellerId}`;
  const agreements = rows.map((row) => {
    const agreement = toAgreement(row, sellerName);
    agreement.partner_name =
      names.get(agreement.partner_profile_id) || agreement.partner_name;
    return agreement;
  });
  const partners = buildReferralCommission({
    from: opts.from,
    to: opts.to,
    agreements,
    invoices: books.invoices,
    customers: books.customers.map(toCustomerLink),
    payments: books.payments,
    redemptions: books.redemptions,
  });
  return {
    partners,
    customers: books.customers.map((row) => ({
      id: Number(row.id),
      name: companyLabel(row.trading_name, row.legal_name, Number(row.id)),
      referral_partner_profile_id:
        row.referral_partner_profile_id != null
          ? Number(row.referral_partner_profile_id)
          : null,
    })),
    warning: books.truncated
      ? 'Only the latest 5,000 invoices were included.'
      : null,
  };
}

export async function loadPartnerCommission(opts: {
  partnerId: number;
  from: string;
  to: string;
}): Promise<PartnerCommissionStatement[]> {
  const rows = await loadAgreements({ partnerId: opts.partnerId });
  if (!rows.length) return [];
  const sellerIds = [...new Set(rows.map((row) => Number(row.profile_id)))];
  const [names, booksBySeller] = await Promise.all([
    profileNames([opts.partnerId, ...sellerIds]),
    Promise.all(sellerIds.map((sellerId) => loadSellerBooks(sellerId, opts.partnerId))),
  ]);
  const statements: PartnerCommissionStatement[] = [];
  sellerIds.forEach((sellerId, index) => {
    const books = booksBySeller[index];
    const sellerRows = rows.filter((row) => Number(row.profile_id) === sellerId);
    const sellerName = names.get(sellerId) || `Company ${sellerId}`;
    const agreements = sellerRows.map((row) => {
      const agreement = toAgreement(row, sellerName);
      agreement.partner_name =
        names.get(opts.partnerId) || agreement.partner_name;
      return agreement;
    });
    statements.push(
      ...buildReferralCommission({
        from: opts.from,
        to: opts.to,
        agreements,
        invoices: books.invoices,
        customers: books.customers.map(toCustomerLink),
        payments: books.payments,
        redemptions: books.redemptions,
      })
    );
  });
  return statements;
}

export async function searchReferralCompanies(opts: {
  sellerId: number;
  q: string;
}): Promise<ReferralCompanyHit[]> {
  const or = bookIlikeOr(opts.q, ['trading_name', 'legal_name']);
  if (!or) return [];
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, trading_name, legal_name')
    .or(or)
    .limit(8);
  if (error) throw new Error(error.message);
  return ((data || []) as Array<{
    id: number;
    trading_name: string | null;
    legal_name: string | null;
  }>)
    .filter((row) => Number(row.id) !== opts.sellerId)
    .map((row) => ({
      id: Number(row.id),
      name: companyLabel(row.trading_name, row.legal_name, Number(row.id)),
      legal_name: String(row.legal_name || '').trim(),
    }));
}

export function parseReferralRate(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0 || n > 100) return null;
  return Math.round(n * 10000) / 10000;
}

export async function saveReferralAgreement(opts: {
  sellerId: number;
  partnerProfileId: number;
  ratePct: number;
  basis: string;
  earnOn: string;
  status: string;
  notes: string | null;
}): Promise<void> {
  if (opts.partnerProfileId === opts.sellerId) {
    throw new Error('A company cannot earn commission on its own sales.');
  }
  const names = await profileNames([opts.partnerProfileId]);
  const partnerName = names.get(opts.partnerProfileId);
  if (!partnerName) throw new Error('Choose a company on SupplierAdvisor.');
  const supabase = getSupabaseServer();
  const payload = {
    profile_id: opts.sellerId,
    partner_profile_id: opts.partnerProfileId,
    partner_name: partnerName,
    rate_pct: opts.ratePct,
    basis: normalizeReferralBasis(opts.basis),
    earn_on: normalizeReferralEarnOn(opts.earnOn),
    status: opts.status === 'paused' ? 'paused' : 'active',
    notes: opts.notes ? opts.notes.slice(0, 500) : null,
    updated_at: new Date().toISOString(),
  };
  const { data: existing, error: loadError } = await supabase
    .from('referral_commission_agreements')
    .select('id')
    .eq('profile_id', opts.sellerId)
    .eq('partner_profile_id', opts.partnerProfileId)
    .maybeSingle();
  throwIfSchema(loadError);
  if (loadError) throw new Error(loadError.message);
  if (existing?.id) {
    const { error } = await supabase
      .from('referral_commission_agreements')
      .update(payload)
      .eq('id', existing.id)
      .eq('profile_id', opts.sellerId);
    if (error) throw new Error(error.message);
    return;
  }
  const { error } = await supabase
    .from('referral_commission_agreements')
    .insert(payload);
  throwIfSchema(error);
  if (error) throw new Error(error.message);
}

export async function assignReferralCustomers(opts: {
  sellerId: number;
  partnerProfileId: number;
  customerIds: number[];
}): Promise<void> {
  const supabase = getSupabaseServer();
  const { data: agreement, error: agreementError } = await supabase
    .from('referral_commission_agreements')
    .select('id')
    .eq('profile_id', opts.sellerId)
    .eq('partner_profile_id', opts.partnerProfileId)
    .maybeSingle();
  throwIfSchema(agreementError);
  if (agreementError) throw new Error(agreementError.message);
  if (!agreement?.id) throw new Error('Save the commission rate before assigning customers.');

  const wanted = [...new Set(opts.customerIds.filter((id) => id > 0))];
  const { data: owned, error: ownedError } = await supabase
    .from('customers')
    .select('id, referral_partner_profile_id')
    .eq('profile_id', opts.sellerId)
    .limit(2000);
  throwIfSchema(ownedError);
  if (ownedError) throw new Error(ownedError.message);
  const rows = (owned || []) as Array<{
    id: number;
    referral_partner_profile_id: number | null;
  }>;
  const ownedIds = new Set(rows.map((row) => Number(row.id)));
  const assign = wanted.filter((id) => ownedIds.has(id));
  const clear = rows
    .filter(
      (row) =>
        Number(row.referral_partner_profile_id) === opts.partnerProfileId &&
        !assign.includes(Number(row.id))
    )
    .map((row) => Number(row.id));

  if (assign.length) {
    const { error } = await supabase
      .from('customers')
      .update({ referral_partner_profile_id: opts.partnerProfileId })
      .eq('profile_id', opts.sellerId)
      .in('id', assign);
    throwIfSchema(error);
    if (error) throw new Error(error.message);
    const { error: invoiceError } = await supabase
      .from('customer_invoices')
      .update({ referral_partner_profile_id: opts.partnerProfileId })
      .eq('profile_id', opts.sellerId)
      .in('customer_id', assign)
      .or(
        `referral_partner_profile_id.is.null,referral_partner_profile_id.eq.${opts.partnerProfileId}`
      );
    throwIfSchema(invoiceError);
    if (invoiceError) throw new Error(invoiceError.message);
  }
  if (clear.length) {
    const { error } = await supabase
      .from('customers')
      .update({ referral_partner_profile_id: null })
      .eq('profile_id', opts.sellerId)
      .eq('referral_partner_profile_id', opts.partnerProfileId)
      .in('id', clear);
    if (error) throw new Error(error.message);
    const { error: invoiceError } = await supabase
      .from('customer_invoices')
      .update({ referral_partner_profile_id: null })
      .eq('profile_id', opts.sellerId)
      .eq('referral_partner_profile_id', opts.partnerProfileId)
      .in('customer_id', clear);
    if (invoiceError) throw new Error(invoiceError.message);
  }
}

export async function addReferralRedemption(opts: {
  sellerId: number;
  partnerProfileId: number;
  amount: number;
  redeemedOn: string;
  method: string;
  reference: string | null;
  notes: string | null;
  createdBy: string | null;
}): Promise<void> {
  const amount = roundMoney(opts.amount);
  if (amount <= 0) throw new Error('Enter the amount redeemed.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(opts.redeemedOn)) {
    throw new Error('Choose the date it was redeemed.');
  }
  const supabase = getSupabaseServer();
  const { data: agreement, error: agreementError } = await supabase
    .from('referral_commission_agreements')
    .select('id')
    .eq('profile_id', opts.sellerId)
    .eq('partner_profile_id', opts.partnerProfileId)
    .maybeSingle();
  throwIfSchema(agreementError);
  if (agreementError) throw new Error(agreementError.message);
  if (!agreement?.id) throw new Error('That partner is not on this commission book.');
  const method = normalizeRedeemMethod(opts.method);
  const names = await profileNames([opts.partnerProfileId]);
  const partnerName = names.get(opts.partnerProfileId) || `Company ${opts.partnerProfileId}`;
  const accounts = await referralAccounts(opts.sellerId);
  const { data: inserted, error } = await supabase
    .from('referral_commission_redemptions')
    .insert({
      profile_id: opts.sellerId,
      partner_profile_id: opts.partnerProfileId,
      amount,
      redeemed_on: opts.redeemedOn,
      method,
      reference: opts.reference ? opts.reference.slice(0, 80) : null,
      notes: opts.notes ? opts.notes.slice(0, 500) : null,
      created_by: opts.createdBy,
    })
    .select('id')
    .single();
  throwIfSchema(error);
  if (error || !inserted?.id) throw new Error(error?.message || 'Could not record the redemption');
  const redemptionId = Number(inserted.id);
  const posted = await postBalancedJournal({
    profileId: opts.sellerId,
    entryDate: opts.redeemedOn,
    memo: `Referral commission ${method} — ${partnerName}`.slice(0, 500),
    source: 'referral_redemption',
    sourceId: String(redemptionId),
    createdBy: opts.createdBy,
    metadata: {
      partner_profile_id: opts.partnerProfileId,
      method,
      redemption_id: redemptionId,
    },
    lines: referralJournalLines({
      expenseAccountId: accounts.expenseId,
      payableAccountId: accounts.payableId,
      amount,
      partnerName,
      method,
    }),
  });
  if (!posted.ok) {
    await supabase
      .from('referral_commission_redemptions')
      .delete()
      .eq('id', redemptionId)
      .eq('profile_id', opts.sellerId);
    throw new Error(posted.error);
  }
  const { error: stampError } = await supabase
    .from('referral_commission_redemptions')
    .update({ journal_entry_id: posted.journalId })
    .eq('id', redemptionId)
    .eq('profile_id', opts.sellerId);
  if (stampError) {
    await reversePostedJournal({
      profileId: opts.sellerId,
      journalId: posted.journalId,
      createdBy: opts.createdBy,
      memo: `Reversal of referral commission — ${partnerName}`,
    });
    await supabase
      .from('referral_commission_redemptions')
      .delete()
      .eq('id', redemptionId)
      .eq('profile_id', opts.sellerId);
    throw new Error(stampError.message);
  }
}

export async function deleteReferralRedemption(opts: {
  sellerId: number;
  id: number;
}): Promise<void> {
  const supabase = getSupabaseServer();
  const { data: existing, error: findError } = await supabase
    .from('referral_commission_redemptions')
    .select('id, journal_entry_id')
    .eq('id', opts.id)
    .eq('profile_id', opts.sellerId)
    .maybeSingle();
  throwIfSchema(findError);
  if (findError) throw new Error(findError.message);
  if (!existing?.id) throw new Error('Redemption not found.');
  const journalId = Number(
    (existing as { journal_entry_id?: number | null }).journal_entry_id
  );
  if (Number.isFinite(journalId) && journalId > 0) {
    const reversed = await reversePostedJournal({
      profileId: opts.sellerId,
      journalId,
      memo: 'Reversal of referral commission redemption',
    });
    if (!reversed.ok) throw new Error(reversed.error);
  }
  const { data, error } = await supabase
    .from('referral_commission_redemptions')
    .delete()
    .eq('id', opts.id)
    .eq('profile_id', opts.sellerId)
    .select('id');
  throwIfSchema(error);
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error('Redemption not found.');
}

async function referralAccounts(
  sellerId: number
): Promise<{ expenseId: number; payableId: number }> {
  let expenseId: number | null = null;
  for (const code of REFERRAL_EXPENSE_CODES) {
    expenseId = await resolveCoaAccountIdByCode(sellerId, code);
    if (expenseId) break;
  }
  const payableId = await resolveCoaAccountIdByCode(sellerId, REFERRAL_PAYABLE_CODE);
  if (!expenseId || !payableId) {
    throw new Error(
      'The chart needs Marketing & sales (6400) or Professional fees (6600), and Accounts payable (2110), before a redemption can be recorded.'
    );
  }
  return { expenseId, payableId };
}
