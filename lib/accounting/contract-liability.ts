/**
 * IFRS 15 (simplified, one performance obligation per invoice):
 * cash before an issued invoice is a contract liability (2140), not revenue.
 *
 * A  Dr bank · Cr 2140
 * B  invoice issue (invoice-gl) — Dr AR · Cr 4100/4400 · Cr 2120
 * C  apply open 2140 · Cr AR; amount_paid at least the applied amount
 * D  bank match to an issued invoice settles AR — never a second 4100
 * E  void reverses recognition, settlement, and 2140 application
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  postBalancedJournal,
  reversePostedJournal,
  resolveCoaAccountIdByCode,
  type JournalLineInput,
} from '@/lib/accounting/post-journal';
import { round2 } from '@/lib/accounting/server';

export const CUSTOMER_DEPOSIT_CODE = '2140';
export const SALES_REVENUE_CODE = '4100';
export const MEMBERSHIP_REVENUE_CODE = '4400';
export const DEPOSIT_SOURCE = 'customer_deposit';
export const DEPOSIT_APPLY_SOURCE = 'deposit_application';

function asMeta(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return { ...(raw as Record<string, unknown>) };
  }
  return {};
}

export function depositApplyAmount(open: number, invoiceTotal: number): number {
  return round2(Math.min(Math.max(0, Number(open) || 0), Math.max(0, Number(invoiceTotal) || 0)));
}

/** amount_paid after applying deposits must cover the applied amount without double-counting linked draft payments. */
export function amountPaidAfterDepositApply(
  currentPaid: number,
  applied: number
): number {
  return round2(Math.max(Math.max(0, Number(currentPaid) || 0), Math.max(0, Number(applied) || 0)));
}

export function isRevenueGlAccount(opts: {
  code?: string | null;
  accountType?: string | null;
}): boolean {
  const type = String(opts.accountType || '').toLowerCase();
  const code = String(opts.code || '').trim();
  if (code.includes('-')) return false;
  if (type === 'revenue' || type === 'income' || type === 'sales') return true;
  if (code.startsWith('4') && type !== 'asset' && type !== 'liability') return true;
  return false;
}

export function isReceivableGlAccount(opts: {
  code?: string | null;
  accountType?: string | null;
  subtype?: string | null;
}): boolean {
  const type = String(opts.accountType || '').toLowerCase();
  const sub = String(opts.subtype || '').toLowerCase();
  const code = String(opts.code || '').trim();
  if (type !== 'asset') return false;
  if (sub === 'receivable' || code === '1130' || code === '1180') return true;
  if (code.startsWith('1180-') || code.startsWith('4400-')) return true;
  return false;
}

export function isCustomerDepositAccount(opts: {
  code?: string | null;
}): boolean {
  return String(opts.code || '').trim() === CUSTOMER_DEPOSIT_CODE;
}

/**
 * Where a bank inflow credit should land.
 * Issued invoice match → settle AR (never 4100).
 * No invoice + revenue coding → cash-basis sales (existing).
 * No invoice + AR leaf / 1130 → 2140 contract liability.
 */
export function bankInflowCreditTarget(opts: {
  hasIssuedInvoice: boolean;
  gl: {
    code?: string | null;
    accountType?: string | null;
    subtype?: string | null;
  };
}): 'ar_settle' | 'deposit' | 'cash_sales' | 'keep' {
  if (opts.hasIssuedInvoice) {
    return 'ar_settle';
  }
  if (isCustomerDepositAccount(opts.gl)) return 'deposit';
  if (isRevenueGlAccount(opts.gl)) return 'cash_sales';
  if (isReceivableGlAccount(opts.gl)) return 'deposit';
  return 'keep';
}

export function arRevenueCodeForInvoice(inv: Record<string, unknown>): '4400' | '4100' {
  const meta = asMeta(inv.metadata);
  if (
    meta.advisor_fee ||
    meta.membership ||
    meta.membership_invoice ||
    meta.member_account ||
    String(meta.kind || '').toLowerCase() === 'membership'
  ) {
    return MEMBERSHIP_REVENUE_CODE;
  }
  const items = Array.isArray(inv.items) ? inv.items : [];
  for (const raw of items) {
    if (!raw || typeof raw !== 'object') continue;
    const it = raw as Record<string, unknown>;
    const code = String(it.account_code || it.gl_code || '').trim();
    if (code === MEMBERSHIP_REVENUE_CODE || code.startsWith(`${MEMBERSHIP_REVENUE_CODE}-`)) {
      return MEMBERSHIP_REVENUE_CODE;
    }
  }
  return SALES_REVENUE_CODE;
}

export function prepaidReceiptLines(opts: {
  bankId: number;
  depositId: number;
  amount: number;
  memo?: string;
}): JournalLineInput[] {
  const amount = round2(Math.abs(Number(opts.amount) || 0));
  const memo = opts.memo || 'Customer deposit';
  return [
    { accountId: opts.bankId, debit: amount, credit: 0, memo },
    { accountId: opts.depositId, debit: 0, credit: amount, memo },
  ];
}

export function depositApplicationLines(opts: {
  depositId: number;
  arId: number;
  amount: number;
  memo?: string;
  counterparty?: string | null;
}): JournalLineInput[] {
  const amount = round2(Math.abs(Number(opts.amount) || 0));
  const memo = opts.memo || 'Apply customer deposit';
  return [
    { accountId: opts.depositId, debit: amount, credit: 0, memo },
    {
      accountId: opts.arId,
      debit: 0,
      credit: amount,
      memo,
      counterparty: opts.counterparty || null,
    },
  ];
}

export function voidInvoiceJournalIds(opts: {
  recognitionJournalId?: number | null;
  settlementJournalIds?: unknown;
  depositApplicationJournalId?: number | null;
  cogsJournalId?: number | null;
}): number[] {
  const ids: number[] = [];
  const rec = Number(opts.recognitionJournalId || 0);
  if (rec > 0) ids.push(rec);
  if (Array.isArray(opts.settlementJournalIds)) {
    for (const row of opts.settlementJournalIds) {
      if (row && typeof row === 'object' && 'journal_id' in row) {
        ids.push(Number((row as { journal_id: number }).journal_id));
      } else if (typeof row === 'number') {
        ids.push(row);
      }
    }
  }
  const dep = Number(opts.depositApplicationJournalId || 0);
  if (dep > 0) ids.push(dep);
  const cogs = Number(opts.cogsJournalId || 0);
  if (cogs > 0) ids.push(cogs);
  return [...new Set(ids.filter((n) => Number.isFinite(n) && n > 0))];
}

export function paymentAlreadyDeposited(
  meta: unknown,
  paymentId: number
): boolean {
  const m = asMeta(meta);
  const prior = Array.isArray(m.deposit_journal_ids) ? m.deposit_journal_ids : [];
  return prior.some((row) => {
    if (row && typeof row === 'object' && 'payment_id' in row) {
      return Number((row as { payment_id: number }).payment_id) === paymentId;
    }
    return false;
  });
}

export async function resolveCustomerDepositAccountId(
  profileId: number
): Promise<number | null> {
  return resolveCoaAccountIdByCode(profileId, CUSTOMER_DEPOSIT_CODE);
}

async function resolveBankGl(
  profileId: number,
  bankAccountId?: number | null
): Promise<number | null> {
  const supabase = getSupabaseServer();
  if (bankAccountId && Number.isFinite(bankAccountId) && bankAccountId > 0) {
    const { data: bank } = await supabase
      .from('bank_accounts')
      .select('gl_account_id')
      .eq('id', bankAccountId)
      .eq('profile_id', profileId)
      .maybeSingle();
    if (bank?.gl_account_id) return Number(bank.gl_account_id);
  }
  return (
    (await resolveCoaAccountIdByCode(profileId, '1110')) ||
    (await resolveCoaAccountIdByCode(profileId, '1120'))
  );
}

export async function postCustomerDeposit(opts: {
  profileId: number;
  amount: number;
  paidAt?: string | null;
  bankAccountId?: number | null;
  bankGlId?: number | null;
  customerId?: number | null;
  invoiceId?: number | null;
  paymentId?: number | null;
  counterparty?: string | null;
  createdBy?: string | null;
  memo?: string | null;
}): Promise<{
  ok: boolean;
  journalId?: number;
  skipped?: boolean;
  error?: string;
}> {
  const amount = round2(Math.abs(Number(opts.amount) || 0));
  if (amount < 0.005) return { ok: true, skipped: true };

  const depositId = await resolveCustomerDepositAccountId(opts.profileId);
  const bankGl =
    opts.bankGlId && opts.bankGlId > 0
      ? opts.bankGlId
      : await resolveBankGl(opts.profileId, opts.bankAccountId);
  if (!depositId || !bankGl) {
    return {
      ok: false,
      error: 'COA missing bank (1110) or customer deposits (2140) — seed Chart of Accounts',
    };
  }

  const memo = String(
    opts.memo ||
      `Customer deposit${opts.invoiceId ? ` invoice ${opts.invoiceId}` : ''}`.trim()
  ).slice(0, 500);
  const entryDate = String(opts.paidAt || new Date().toISOString()).slice(0, 10);
  const posted = await postBalancedJournal({
    profileId: opts.profileId,
    entryDate,
    memo,
    source: DEPOSIT_SOURCE,
    sourceId: opts.paymentId
      ? String(opts.paymentId)
      : opts.invoiceId
        ? `inv-${opts.invoiceId}`
        : undefined,
    createdBy: opts.createdBy || null,
    metadata: {
      ifrs15: true,
      contract_liability: true,
      customer_id: opts.customerId || null,
      invoice_id: opts.invoiceId || null,
      payment_id: opts.paymentId || null,
    },
    lines: prepaidReceiptLines({
      bankId: bankGl,
      depositId,
      amount,
      memo,
    }).map((l) => ({
      ...l,
      counterparty: opts.counterparty || null,
    })),
  });
  if (!posted.ok) return { ok: false, error: posted.error };
  return { ok: true, journalId: posted.journalId };
}

type DepositBucket = {
  journalId: number;
  amount: number;
  invoiceId: number | null;
  customerId: number | null;
};

function liveJournal(j: { status?: string | null; metadata?: unknown }): boolean {
  return (
    String(j.status || '') === 'posted' &&
    !asMeta(j.metadata).reversed_by_journal_id
  );
}

async function loadDepositBuckets(opts: {
  profileId: number;
  depositAccountId: number;
}): Promise<DepositBucket[]> {
  const supabase = getSupabaseServer();
  const { data: journals } = await supabase
    .from('journal_entries')
    .select('id, source, status, metadata')
    .eq('profile_id', opts.profileId)
    .in('source', [DEPOSIT_SOURCE, DEPOSIT_APPLY_SOURCE])
    .eq('status', 'posted')
    .order('id', { ascending: true })
    .limit(400);
  const live = (journals || []).filter((j) => liveJournal(j));
  if (!live.length) return [];
  const ids = live.map((j) => Number(j.id));
  const { data: lines } = await supabase
    .from('journal_lines')
    .select('journal_entry_id, account_id, debit, credit')
    .in('journal_entry_id', ids)
    .eq('account_id', opts.depositAccountId);
  const netByJe = new Map<number, number>();
  for (const l of lines || []) {
    const jid = Number(l.journal_entry_id);
    const net = round2(Number(l.credit || 0) - Number(l.debit || 0));
    netByJe.set(jid, round2((netByJe.get(jid) || 0) + net));
  }
  const out: DepositBucket[] = [];
  for (const j of live) {
    const net = netByJe.get(Number(j.id)) || 0;
    if (Math.abs(net) < 0.005) continue;
    const meta = asMeta(j.metadata);
    out.push({
      journalId: Number(j.id),
      amount: net,
      invoiceId: Number(meta.invoice_id || 0) || null,
      customerId: Number(meta.customer_id || 0) || null,
    });
  }
  return out;
}

export function openDepositFromBuckets(opts: {
  buckets: DepositBucket[];
  customerId?: number | null;
  invoiceId?: number | null;
}): number {
  const invoiceId = Number(opts.invoiceId || 0);
  const customerId = Number(opts.customerId || 0);
  let open = 0;
  for (const b of opts.buckets) {
    if (invoiceId > 0 && b.invoiceId === invoiceId) {
      open = round2(open + b.amount);
      continue;
    }
    if (invoiceId > 0 && b.invoiceId && b.invoiceId !== invoiceId) continue;
    if (customerId > 0 && b.customerId === customerId) {
      open = round2(open + b.amount);
    }
  }
  return round2(Math.max(0, open));
}

export async function openDepositBalance(opts: {
  profileId: number;
  customerId?: number | null;
  invoiceId?: number | null;
}): Promise<number> {
  const depositId = await resolveCustomerDepositAccountId(opts.profileId);
  if (!depositId) return 0;
  const buckets = await loadDepositBuckets({
    profileId: opts.profileId,
    depositAccountId: depositId,
  });
  return openDepositFromBuckets({
    buckets,
    customerId: opts.customerId,
    invoiceId: opts.invoiceId,
  });
}

export async function applyDepositsOnInvoice(opts: {
  profileId: number;
  invoice: Record<string, unknown>;
  arAccountId: number | null;
  createdBy?: string | null;
}): Promise<{
  ok: boolean;
  applied: number;
  journalId?: number;
  skipped?: boolean;
  error?: string;
}> {
  const inv = opts.invoice;
  const meta = asMeta(inv.metadata);
  if (Number(meta.deposit_application_journal_id || 0) > 0) {
    return {
      ok: true,
      skipped: true,
      applied: round2(Number(meta.deposit_applied || 0)),
      journalId: Number(meta.deposit_application_journal_id),
    };
  }
  const total = round2(Number(inv.total_amount || 0));
  if (total < 0.005 || !opts.arAccountId) {
    return { ok: true, skipped: true, applied: 0 };
  }
  const open = await openDepositBalance({
    profileId: opts.profileId,
    customerId: Number(inv.customer_id || 0) || null,
    invoiceId: Number(inv.id || 0) || null,
  });
  const applied = depositApplyAmount(open, total);
  if (applied < 0.005) return { ok: true, skipped: true, applied: 0 };

  const depositId = await resolveCustomerDepositAccountId(opts.profileId);
  if (!depositId) {
    return { ok: false, applied: 0, error: 'COA missing customer deposits (2140)' };
  }
  const memo =
    `Apply deposit to ${inv.invoice_number || inv.id}`.slice(0, 500);
  const counterparty = inv.counterparty_name
    ? String(inv.counterparty_name)
    : null;
  const entryDate = String(
    inv.issue_date || new Date().toISOString()
  ).slice(0, 10);
  const posted = await postBalancedJournal({
    profileId: opts.profileId,
    entryDate,
    memo,
    source: DEPOSIT_APPLY_SOURCE,
    sourceId: String(inv.id),
    createdBy: opts.createdBy || null,
    metadata: {
      ifrs15: true,
      invoice_id: inv.id,
      invoice_number: inv.invoice_number || null,
      customer_id: inv.customer_id || null,
      deposit_applied: applied,
    },
    lines: depositApplicationLines({
      depositId,
      arId: opts.arAccountId,
      amount: applied,
      memo,
      counterparty,
    }),
  });
  if (!posted.ok) return { ok: false, applied: 0, error: posted.error };

  const nextPaid = amountPaidAfterDepositApply(
    Number(inv.amount_paid || 0),
    applied
  );
  let status = String(inv.status || 'sent');
  if (nextPaid >= total - 0.005) status = 'paid';
  else if (nextPaid > 0 && !['paid', 'void', 'cancelled', 'canceled'].includes(status)) {
    if (['sent', 'issued', 'viewed', 'unpaid', 'overdue', 'draft', 'partial'].includes(status)) {
      status = 'partial';
    }
  }

  const supabase = getSupabaseServer();
  const nextMeta = {
    ...meta,
    deposit_applied: applied,
    deposit_application_journal_id: posted.journalId,
    deposit_applied_at: new Date().toISOString(),
  };
  await supabase
    .from('invoices')
    .update({
      amount_paid: nextPaid,
      status,
      paid_at: status === 'paid' ? new Date().toISOString() : inv.paid_at || null,
      metadata: nextMeta,
      updated_at: new Date().toISOString(),
    })
    .eq('id', Number(inv.id))
    .eq('profile_id', opts.profileId);

  inv.amount_paid = nextPaid;
  inv.status = status;
  inv.metadata = nextMeta;
  return { ok: true, applied, journalId: posted.journalId };
}

async function journalCreditsRevenue(
  journalId: number,
  revenueIds: Set<number>
): Promise<{ amount: number; bankAccountId: number | null }> {
  const supabase = getSupabaseServer();
  const { data: lines } = await supabase
    .from('journal_lines')
    .select('account_id, debit, credit')
    .eq('journal_entry_id', journalId);
  let amount = 0;
  let bankAccountId: number | null = null;
  let bankDebit = 0;
  for (const l of lines || []) {
    const aid = Number(l.account_id);
    const credit = round2(Number(l.credit || 0));
    const debit = round2(Number(l.debit || 0));
    if (revenueIds.has(aid) && credit > 0) amount = round2(amount + credit);
    if (debit > bankDebit) {
      bankDebit = debit;
      bankAccountId = aid;
    }
  }
  return { amount, bankAccountId };
}

export async function recodeRevenueCreditToDeposits(opts: {
  profileId: number;
  journalId: number;
  invoiceId?: number | null;
  customerId?: number | null;
  invoiceNumber?: string | null;
  createdBy?: string | null;
}): Promise<{
  ok: boolean;
  depositJournalId?: number;
  skipped?: boolean;
  error?: string;
}> {
  const supabase = getSupabaseServer();
  const { data: je } = await supabase
    .from('journal_entries')
    .select('id, status, metadata, memo, entry_date, source')
    .eq('id', opts.journalId)
    .eq('profile_id', opts.profileId)
    .maybeSingle();
  if (!je) return { ok: true, skipped: true };
  if (!liveJournal(je)) return { ok: true, skipped: true };

  const { data: accts } = await supabase
    .from('chart_of_accounts')
    .select('id, code, account_type')
    .eq('profile_id', opts.profileId);
  const revenueIds = new Set<number>();
  for (const a of accts || []) {
    if (isRevenueGlAccount({ code: String(a.code), accountType: String(a.account_type) })) {
      revenueIds.add(Number(a.id));
    }
  }
  const { amount, bankAccountId } = await journalCreditsRevenue(
    opts.journalId,
    revenueIds
  );
  if (amount < 0.005) return { ok: true, skipped: true };

  const reversed = await reversePostedJournal({
    profileId: opts.profileId,
    journalId: opts.journalId,
    createdBy: opts.createdBy,
    memo: `Reverse sales coding for invoice ${opts.invoiceNumber || opts.invoiceId || ''}`.trim(),
    metadata: {
      invoice_id: opts.invoiceId || null,
      recode_to_deposit: true,
    },
  });
  if (!reversed.ok) return { ok: false, error: reversed.error };

  const posted = await postCustomerDeposit({
    profileId: opts.profileId,
    amount,
    paidAt: je.entry_date != null ? String(je.entry_date) : null,
    bankGlId: bankAccountId,
    customerId: opts.customerId,
    invoiceId: opts.invoiceId,
    counterparty: null,
    createdBy: opts.createdBy,
    memo: `Recode receipt to customer deposit ${opts.invoiceNumber || ''}`.trim(),
  });
  if (!posted.ok) return { ok: false, error: posted.error };
  return { ok: true, depositJournalId: posted.journalId };
}

export async function recodeInvoiceBankSales(opts: {
  profileId: number;
  invoice: Record<string, unknown>;
  createdBy?: string | null;
}): Promise<{ ok: boolean; recoded: number[]; error?: string }> {
  const inv = opts.invoice;
  const meta = asMeta(inv.metadata);
  const candidates = new Set<number>();
  const stamped = Number(meta.cash_allocated_journal_id || 0);
  if (stamped > 0) candidates.add(stamped);

  const supabase = getSupabaseServer();
  const invId = Number(inv.id || 0);
  if (invId > 0) {
    const { data: txns } = await supabase
      .from('bank_transactions')
      .select('matched_journal_id')
      .eq('profile_id', opts.profileId)
      .eq('matched_invoice_id', invId)
      .limit(20);
    for (const t of txns || []) {
      const jid = Number(t.matched_journal_id || 0);
      if (jid > 0) candidates.add(jid);
    }
  }

  const number = String(inv.invoice_number || '').trim();
  if (number && (number.length >= 6 || /^INV/i.test(number))) {
    const { data: banks } = await supabase
      .from('journal_entries')
      .select('id, memo, metadata, status, source, entry_date')
      .eq('profile_id', opts.profileId)
      .eq('source', 'bank_allocation')
      .eq('status', 'posted')
      .order('id', { ascending: false })
      .limit(80);
    const needle = number.toUpperCase();
    for (const j of banks || []) {
      if (!liveJournal(j)) continue;
      if (String(j.memo || '').toUpperCase().includes(needle)) {
        candidates.add(Number(j.id));
      }
    }
  }

  const recoded: number[] = [];
  for (const jid of candidates) {
    const r = await recodeRevenueCreditToDeposits({
      profileId: opts.profileId,
      journalId: jid,
      invoiceId: invId || null,
      customerId: Number(inv.customer_id || 0) || null,
      invoiceNumber: number || null,
      createdBy: opts.createdBy,
    });
    if (!r.ok) return { ok: false, recoded, error: r.error };
    if (r.depositJournalId) recoded.push(jid);
  }
  if (recoded.length) {
    const nextMeta = {
      ...meta,
      recoded_revenue_journal_ids: recoded,
      cash_allocated_recode_at: new Date().toISOString(),
      prior_cash_allocated_journal_id: meta.cash_allocated_journal_id || null,
      cash_allocated_journal_id: null,
    };
    await supabase
      .from('invoices')
      .update({
        metadata: nextMeta,
        updated_at: new Date().toISOString(),
      })
      .eq('id', invId)
      .eq('profile_id', opts.profileId);
    inv.metadata = nextMeta;
  }
  return { ok: true, recoded };
}

export async function stampInvoiceDepositJournal(opts: {
  profileId: number;
  invoiceId: number;
  prevMeta: Record<string, unknown>;
  paymentId?: number | null;
  journalId: number;
}) {
  const prior = Array.isArray(opts.prevMeta.deposit_journal_ids)
    ? [...(opts.prevMeta.deposit_journal_ids as unknown[])]
    : [];
  prior.push({
    payment_id: opts.paymentId || null,
    journal_id: opts.journalId,
  });
  const supabase = getSupabaseServer();
  await supabase
    .from('invoices')
    .update({
      metadata: { ...opts.prevMeta, deposit_journal_ids: prior },
      updated_at: new Date().toISOString(),
    })
    .eq('id', opts.invoiceId)
    .eq('profile_id', opts.profileId);
}
