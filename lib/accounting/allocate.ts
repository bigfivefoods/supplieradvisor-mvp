import { getSupabaseServer } from '@/lib/supabase/server-client';
import { nextDocumentNumber, round2 } from '@/lib/accounting/server';

/**
 * Resolve the GL cash/bank account for a bank account.
 * Prefer bank_accounts.gl_account_id, else first active asset account with subtype bank/cash or code 1110.
 */
export async function resolveBankGlAccountId(
  profileId: number,
  bankAccountId: number
): Promise<number | null> {
  const supabase = getSupabaseServer();
  const { data: bank } = await supabase
    .from('bank_accounts')
    .select('id, gl_account_id')
    .eq('id', bankAccountId)
    .eq('profile_id', profileId)
    .maybeSingle();

  if (bank?.gl_account_id) return Number(bank.gl_account_id);

  const { data: coa } = await supabase
    .from('chart_of_accounts')
    .select('id, code, subtype, account_type, is_header, is_active')
    .eq('profile_id', profileId)
    .eq('is_active', true);

  const rows = (coa || []).filter((a) => !a.is_header);
  const byCode = rows.find((a) => a.code === '1110');
  if (byCode) return Number(byCode.id);
  const bySubtype = rows.find(
    (a) =>
      a.account_type === 'asset' &&
      ['bank', 'cash'].includes(String(a.subtype || '').toLowerCase())
  );
  if (bySubtype) return Number(bySubtype.id);
  const anyAsset = rows.find((a) => a.account_type === 'asset');
  return anyAsset ? Number(anyAsset.id) : null;
}

export type AllocateParams = {
  profileId: number;
  bankTxnId: number | string;
  glAccountId: number;
  privyUserId?: string | null;
  taxAmount?: number;
  taxGlAccountId?: number | null;
  memo?: string | null;
  counterparty?: string | null;
  /** If true, also mark bank status reconciled */
  markReconciled?: boolean;
};

/**
 * Post double-entry journal from a bank transaction allocation:
 *  Income (+amount): Dr Bank, Cr Income (and optional Cr VAT output if tax separate — simplified: tax on expense/income handled separately)
 *  Expense (−amount): Dr Expense, Cr Bank
 *
 * amount is signed: +in, −out
 */
export async function allocateBankTransaction(params: AllocateParams): Promise<
  | { ok: true; journalId: number; entryNumber: string }
  | { ok: false; error: string; status: number }
> {
  const supabase = getSupabaseServer();
  const { data: txn, error: txnErr } = await supabase
    .from('bank_transactions')
    .select('*')
    .eq('id', params.bankTxnId)
    .eq('profile_id', params.profileId)
    .maybeSingle();

  if (txnErr || !txn) {
    return { ok: false, error: 'Bank transaction not found', status: 404 };
  }
  if (txn.allocation_status === 'allocated' && txn.matched_journal_id) {
    return { ok: false, error: 'Transaction already allocated', status: 400 };
  }
  if (txn.allocation_status === 'excluded') {
    return { ok: false, error: 'Transaction is excluded', status: 400 };
  }

  const amount = round2(Number(txn.amount || 0));
  if (amount === 0) {
    return { ok: false, error: 'Zero-amount transaction cannot be allocated', status: 400 };
  }

  let bankAccountId = Number(txn.bank_account_id);
  if (!Number.isFinite(bankAccountId) || bankAccountId <= 0) {
    // Legacy rows without bank_account_id: use company default / first bank
    const { data: fallbackBank } = await supabase
      .from('bank_accounts')
      .select('id')
      .eq('profile_id', params.profileId)
      .order('is_default', { ascending: false })
      .limit(1)
      .maybeSingle();
    bankAccountId = fallbackBank ? Number(fallbackBank.id) : 0;
  }

  const bankGlId = await resolveBankGlAccountId(params.profileId, bankAccountId);
  if (!bankGlId) {
    return {
      ok: false,
      error:
        'No bank GL account found. Open Chart of Accounts and seed defaults, or set a GL cash account on the bank account.',
      status: 400,
    };
  }
  if (Number(params.glAccountId) === bankGlId) {
    return {
      ok: false,
      error: 'Choose an income/expense account, not the bank account itself',
      status: 400,
    };
  }

  const abs = Math.abs(amount);
  const tax = round2(Number(params.taxAmount || 0));
  const net = tax > 0 && tax < abs ? round2(abs - tax) : abs;
  const isInflow = amount > 0;

  type Line = {
    account_id: number;
    debit: number;
    credit: number;
    memo?: string;
    counterparty?: string;
  };
  const lines: Line[] = [];
  const memo =
    params.memo ||
    txn.description ||
    `Bank ${isInflow ? 'receipt' : 'payment'} ${txn.reference || ''}`.trim();
  const counterparty = params.counterparty || txn.counterparty_name || null;

  if (isInflow) {
    // Dr Bank, Cr Income (net), Cr Tax (optional)
    lines.push({ account_id: bankGlId, debit: abs, credit: 0, memo: memo || undefined });
    lines.push({
      account_id: Number(params.glAccountId),
      debit: 0,
      credit: net,
      memo: memo || undefined,
      counterparty: counterparty || undefined,
    });
    if (tax > 0 && params.taxGlAccountId) {
      lines.push({
        account_id: Number(params.taxGlAccountId),
        debit: 0,
        credit: tax,
        memo: 'VAT',
      });
    } else if (tax > 0) {
      lines[1].credit = abs;
    }
  } else {
    // Dr Expense (net), Dr Tax (optional), Cr Bank
    lines.push({
      account_id: Number(params.glAccountId),
      debit: net,
      credit: 0,
      memo: memo || undefined,
      counterparty: counterparty || undefined,
    });
    if (tax > 0 && params.taxGlAccountId) {
      lines.push({
        account_id: Number(params.taxGlAccountId),
        debit: tax,
        credit: 0,
        memo: 'VAT',
      });
    } else if (tax > 0) {
      lines[0].debit = abs;
    }
    lines.push({ account_id: bankGlId, debit: 0, credit: abs, memo: memo || undefined });
  }

  const entryNumber = await nextDocumentNumber(params.profileId, 'journal');
  const entryDate =
    (txn.txn_date as string | null) ||
    (txn.tx_date ? String(txn.tx_date).slice(0, 10) : null) ||
    new Date().toISOString().slice(0, 10);
  const { data: entry, error: jeErr } = await supabase
    .from('journal_entries')
    .insert({
      profile_id: params.profileId,
      entry_number: entryNumber,
      entry_date: entryDate,
      memo,
      status: 'posted',
      source: 'bank_allocation',
      source_id: String(txn.id),
      currency: txn.currency || 'ZAR',
      created_by: params.privyUserId || null,
      posted_at: new Date().toISOString(),
      metadata: { bank_transaction_id: txn.id, bank_account_id: txn.bank_account_id },
    })
    .select('*')
    .single();

  if (jeErr || !entry) {
    return { ok: false, error: jeErr?.message || 'Failed to create journal', status: 400 };
  }

  const lineRows = lines.map((l) => ({
    journal_entry_id: entry.id,
    profile_id: params.profileId,
    account_id: l.account_id,
    debit: l.debit,
    credit: l.credit,
    memo: l.memo || null,
    counterparty: l.counterparty || null,
  }));

  const { error: lineErr } = await supabase.from('journal_lines').insert(lineRows);
  if (lineErr) {
    await supabase.from('journal_entries').delete().eq('id', entry.id);
    return { ok: false, error: lineErr.message, status: 400 };
  }

  const patch: Record<string, unknown> = {
    allocation_status: 'allocated',
    gl_account_id: Number(params.glAccountId),
    matched_journal_id: entry.id,
    allocated_at: new Date().toISOString(),
    allocated_by: params.privyUserId || null,
    tax_amount: tax,
    counterparty_name: counterparty,
    status: params.markReconciled !== false ? 'reconciled' : txn.status,
    updated_at: new Date().toISOString(),
  };
  if (params.memo) patch.notes = params.memo;

  const { error: upErr } = await supabase
    .from('bank_transactions')
    .update(patch)
    .eq('id', txn.id)
    .eq('profile_id', params.profileId);

  if (upErr) {
    return { ok: false, error: upErr.message, status: 400 };
  }

  return { ok: true, journalId: entry.id, entryNumber };
}

/**
 * Undo a bank allocation:
 * - Void the linked allocation journal (if still posted)
 * - Reset bank line to unallocated so it can be re-coded / re-VAT'd
 */
export async function unallocateBankTransaction(params: {
  profileId: number;
  bankTxnId: number | string;
  privyUserId?: string | null;
  /** Also clear tax_code / tax_amount so VAT can be re-picked */
  clearTax?: boolean;
}): Promise<
  | { ok: true; voidedJournalId: number | null }
  | { ok: false; error: string; status: number }
> {
  const supabase = getSupabaseServer();
  const { data: txn, error: txnErr } = await supabase
    .from('bank_transactions')
    .select('*')
    .eq('id', params.bankTxnId)
    .eq('profile_id', params.profileId)
    .maybeSingle();

  if (txnErr || !txn) {
    return { ok: false, error: 'Bank transaction not found', status: 404 };
  }

  const status = String(txn.allocation_status || 'unallocated');
  if (status === 'unallocated') {
    return { ok: false, error: 'Transaction is already unallocated', status: 400 };
  }
  if (status === 'excluded') {
    return {
      ok: false,
      error: 'Transaction is excluded — use Unexclude first',
      status: 400,
    };
  }

  let voidedJournalId: number | null = null;
  const journalId = txn.matched_journal_id ? Number(txn.matched_journal_id) : null;

  if (journalId && Number.isFinite(journalId)) {
    const { data: je } = await supabase
      .from('journal_entries')
      .select('id, status, source, source_id')
      .eq('id', journalId)
      .eq('profile_id', params.profileId)
      .maybeSingle();

    if (je && String(je.status) !== 'void') {
      const { error: voidErr } = await supabase
        .from('journal_entries')
        .update({
          status: 'void',
          updated_at: new Date().toISOString(),
        })
        .eq('id', journalId)
        .eq('profile_id', params.profileId);

      if (voidErr) {
        return {
          ok: false,
          error: `Could not void linked journal: ${voidErr.message}`,
          status: 400,
        };
      }
      voidedJournalId = journalId;
    }
  }

  const patch: Record<string, unknown> = {
    allocation_status: 'unallocated',
    gl_account_id: null,
    matched_journal_id: null,
    matched_invoice_id: null,
    matched_payment_id: null,
    allocated_at: null,
    allocated_by: null,
    status: 'unreconciled',
    updated_at: new Date().toISOString(),
  };
  if (params.clearTax) {
    patch.tax_code = null;
    patch.tax_amount = 0;
  }

  const { error: upErr } = await supabase
    .from('bank_transactions')
    .update(patch)
    .eq('id', txn.id)
    .eq('profile_id', params.profileId);

  if (upErr) {
    return { ok: false, error: upErr.message, status: 400 };
  }

  return { ok: true, voidedJournalId };
}

/**
 * Match bank receipt/payment to an invoice and record a payment.
 * Inflow → AR invoice; Outflow → AP bill.
 */
export async function matchBankToInvoice(params: {
  profileId: number;
  bankTxnId: number | string;
  invoiceId: number;
  privyUserId?: string | null;
  method?: string;
}): Promise<
  | { ok: true; paymentId: number }
  | { ok: false; error: string; status: number }
> {
  const supabase = getSupabaseServer();
  const { data: txn } = await supabase
    .from('bank_transactions')
    .select('*')
    .eq('id', params.bankTxnId)
    .eq('profile_id', params.profileId)
    .maybeSingle();
  if (!txn) return { ok: false, error: 'Bank transaction not found', status: 404 };
  const txnDate =
    (txn.txn_date as string | null) ||
    (txn.tx_date ? String(txn.tx_date).slice(0, 10) : null) ||
    new Date().toISOString().slice(0, 10);

  const { data: inv } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', params.invoiceId)
    .eq('profile_id', params.profileId)
    .maybeSingle();
  if (!inv) return { ok: false, error: 'Invoice not found', status: 404 };

  const amount = round2(Math.abs(Number(txn.amount || 0)));
  const isInflow = Number(txn.amount) > 0;
  const expectedDir = isInflow ? 'receivable' : 'payable';
  if (inv.direction !== expectedDir) {
    return {
      ok: false,
      error: `Invoice direction is ${inv.direction}; bank amount is ${isInflow ? 'inflow (AR)' : 'outflow (AP)'}`,
      status: 400,
    };
  }

  const payDir = isInflow ? 'inbound' : 'outbound';
  const { data: payment, error: payErr } = await supabase
    .from('payments')
    .insert({
      profile_id: params.profileId,
      invoice_id: inv.id,
      direction: payDir,
      amount,
      currency: txn.currency || inv.currency || 'ZAR',
      method: params.method || 'eft',
      reference: txn.reference || null,
      paid_at: `${txnDate}T12:00:00.000Z`,
      status: 'completed',
      counterparty_name: inv.counterparty_name || txn.counterparty_name || null,
      bank_account_id: txn.bank_account_id,
      notes: txn.description || null,
      metadata: { bank_transaction_id: txn.id },
    })
    .select('*')
    .single();

  if (payErr || !payment) {
    return { ok: false, error: payErr?.message || 'Payment failed', status: 400 };
  }

  const newPaid = round2(Number(inv.amount_paid || 0) + amount);
  const total = Number(inv.total_amount || 0);
  let status = inv.status;
  if (newPaid >= total - 0.005) status = 'paid';
  else if (newPaid > 0) status = 'partial';

  await supabase
    .from('invoices')
    .update({
      amount_paid: newPaid,
      status,
      paid_at: status === 'paid' ? new Date().toISOString() : inv.paid_at,
      updated_at: new Date().toISOString(),
    })
    .eq('id', inv.id);

  await supabase
    .from('bank_transactions')
    .update({
      allocation_status: 'matched_invoice',
      matched_invoice_id: inv.id,
      matched_payment_id: payment.id,
      status: 'reconciled',
      counterparty_name: inv.counterparty_name || txn.counterparty_name,
      allocated_at: new Date().toISOString(),
      allocated_by: params.privyUserId || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', txn.id);

  return { ok: true, paymentId: payment.id };
}
