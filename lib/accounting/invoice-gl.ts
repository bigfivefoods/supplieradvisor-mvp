/**
 * Accrual recognition and settlement for AR/AP invoices (IAS 1 / IFRS 15 cash vs accrual).
 *
 * Issue (not draft): Dr AR · Cr revenue · Cr VAT output
 *                 or Dr expense · Dr VAT input · Cr AP
 * Cash applied:     Dr bank · Cr AR   /   Dr AP · Cr bank
 *
 * Cash before an issued invoice is a contract liability (Dr bank · Cr 2140),
 * then applied on issue (Dr 2140 · Cr AR). Bank lines coded to 4100 for an
 * issued invoice are recoded — they must not stay as a second sale.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  postBalancedJournal,
  reversePostedJournal,
  resolveCoaAccountId,
  resolveCoaAccountIdByCode,
  type JournalLineInput,
} from '@/lib/accounting/post-journal';
import { isPeriodLocked } from '@/lib/accounting/period-lock';
import { round2 } from '@/lib/accounting/server';
import {
  memberRevAccountCode,
  pickRecognitionControlAccount,
  pickSettlementControlAccount,
  resolvePartyControlAccountId,
} from '@/lib/accounting/party-gl-accounts';
import {
  applyDepositsOnInvoice,
  arRevenueCodeForInvoice,
  paymentAlreadyDeposited,
  postCustomerDeposit,
  recodeInvoiceBankSales,
  stampInvoiceDepositJournal,
  voidInvoiceJournalIds,
} from '@/lib/accounting/contract-liability';
import { postCogsOnInvoice } from '@/lib/accounting/inventory-cogs';

const ISSUED = new Set([
  'sent',
  'partial',
  'paid',
  'overdue',
  'issued',
  'viewed',
  'unpaid',
]);

export function isIssuedInvoiceStatus(status: string | null | undefined): boolean {
  return ISSUED.has(String(status || '').toLowerCase());
}

function asMeta(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return { ...(raw as Record<string, unknown>) };
  }
  return {};
}

export function mapApCostCategoryToCode(category?: string | null): string {
  const c = String(category || '').toLowerCase().trim();
  if (!c) return '1140';
  if (/material|inventory|stock|raw_?material/.test(c)) return '1140';
  if (/cogs|goods|resale/.test(c)) return '5100';
  if (/ppe|capital|fixed|equipment|machinery|\basset\b/.test(c)) return '1210';
  return '';
}

export function invoiceLinkedPurchaseOrderId(
  inv: Record<string, unknown>
): number | null {
  const meta = asMeta(inv.metadata);
  const n = Number(
    inv.source_po_id ||
      inv.purchase_order_id ||
      meta.purchase_order_id ||
      meta.source_po_id ||
      meta.po_id ||
      0
  );
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function isPoApAlreadyAllocated(
  po: Record<string, unknown> | null | undefined
): { allocated: boolean; journalId: number | null } {
  if (!po) return { allocated: false, journalId: null };
  const meta = asMeta(po.metadata);
  const fromMetaAlloc = asMeta(meta.cost_allocation);
  const rawIds = fromMetaAlloc.journal_ids;
  const firstMeta =
    Array.isArray(rawIds) && rawIds.length ? Number(rawIds[0]) : 0;
  const jid = Number(
    po.cost_journal_entry_id ||
      meta.ap_allocated_journal_id ||
      meta.inventory_journal_id ||
      firstMeta ||
      0
  );
  if (Number.isFinite(jid) && jid > 0) {
    return { allocated: true, journalId: jid };
  }
  if (po.cost_allocated_at) return { allocated: true, journalId: null };
  return { allocated: false, journalId: null };
}

/**
 * Explicit cash-basis keep (or PO skip). cash_allocated_journal_id alone does
 * not skip recognition — that receipt is recoded off 4100 then recognised once.
 */
export function invoiceKeepsBankAllocation(meta: unknown): boolean {
  const m = asMeta(meta);
  return Boolean(m.skip_recognition || m.books_keep_bank_allocation);
}

/** Bank debit already on the ledger — do not settle AR/AP again for that cash. */
export function invoiceSkipsSettlement(meta: unknown): boolean {
  const m = asMeta(meta);
  return Boolean(
    m.skip_settlement ||
      m.skip_recognition ||
      m.books_keep_bank_allocation ||
      m.cash_allocated_journal_id
  );
}

export async function pickOpenEntryDate(
  profileId: number,
  preferred: string
): Promise<string> {
  const pref =
    String(preferred || '').slice(0, 10) || new Date().toISOString().slice(0, 10);
  const lock = await isPeriodLocked(profileId, pref);
  if (!lock.locked) return pref;
  const today = new Date().toISOString().slice(0, 10);
  const todayLock = await isPeriodLocked(profileId, today);
  if (!todayLock.locked) return today;
  return pref;
}

async function invoiceAccounts(profileId: number) {
  const ar =
    (await resolveCoaAccountIdByCode(profileId, '1130')) ||
    (await resolveCoaAccountId({
      profileId,
      subtypes: ['receivable'],
      accountTypes: ['asset'],
    }));
  const ap =
    (await resolveCoaAccountIdByCode(profileId, '2110')) ||
    (await resolveCoaAccountId({
      profileId,
      subtypes: ['payable'],
      accountTypes: ['liability'],
    }));
  const vatOut =
    (await resolveCoaAccountIdByCode(profileId, '2120')) ||
    (await resolveCoaAccountId({
      profileId,
      subtypes: ['tax'],
      accountTypes: ['liability'],
    }));
  const vatIn =
    (await resolveCoaAccountIdByCode(profileId, '1150')) ||
    (await resolveCoaAccountId({
      profileId,
      subtypes: ['tax'],
      accountTypes: ['asset'],
    }));
  const revenue =
    (await resolveCoaAccountIdByCode(profileId, '4100')) ||
    (await resolveCoaAccountId({ profileId, accountTypes: ['revenue'] }));
  const expense =
    (await resolveCoaAccountIdByCode(profileId, '6990')) ||
    (await resolveCoaAccountId({ profileId, accountTypes: ['expense'] }));
  const bank =
    (await resolveCoaAccountIdByCode(profileId, '1110')) ||
    (await resolveCoaAccountId({
      profileId,
      subtypes: ['bank', 'cash'],
      accountTypes: ['asset'],
    }));
  const deposits = await resolveCoaAccountIdByCode(profileId, '2140');
  const membership =
    (await resolveCoaAccountIdByCode(profileId, '4400')) || revenue;
  return { ar, ap, vatOut, vatIn, revenue, expense, bank, deposits, membership };
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
  const accts = await invoiceAccounts(profileId);
  return accts.bank;
}

type LineItem = {
  account_id?: number;
  amount?: number;
  quantity?: number;
  unit_price?: number;
};

function itemAmounts(items: unknown): Array<{ accountId: number; amount: number }> {
  if (!Array.isArray(items)) return [];
  const out: Array<{ accountId: number; amount: number }> = [];
  for (const raw of items as LineItem[]) {
    const aid = Number(raw.account_id || 0);
    const amt =
      raw.amount != null
        ? Number(raw.amount)
        : Number(raw.quantity || 1) * Number(raw.unit_price || 0);
    if (aid > 0 && amt > 0) out.push({ accountId: aid, amount: round2(amt) });
  }
  return out;
}

async function stampInvoiceMeta(
  invoiceId: number,
  profileId: number,
  prev: Record<string, unknown>,
  patch: Record<string, unknown>
) {
  const supabase = getSupabaseServer();
  await supabase
    .from('invoices')
    .update({
      metadata: { ...prev, ...patch },
      updated_at: new Date().toISOString(),
    })
    .eq('id', invoiceId)
    .eq('profile_id', profileId);
}

async function applyArDepositsIfNeeded(opts: {
  profileId: number;
  invoice: Record<string, unknown>;
  arAccountId?: number | null;
  createdBy?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  if (String(opts.invoice.direction || '') === 'payable') {
    return { ok: true };
  }
  const meta = asMeta(opts.invoice.metadata);
  const arId =
    Number(opts.arAccountId || meta.control_account_id || 0) ||
    (await invoiceAccounts(opts.profileId)).ar;
  const applied = await applyDepositsOnInvoice({
    profileId: opts.profileId,
    invoice: opts.invoice,
    arAccountId: arId,
    createdBy: opts.createdBy,
  });
  if (!applied.ok) return { ok: false, error: applied.error };
  const cogs = await postCogsOnInvoice({
    profileId: opts.profileId,
    invoice: opts.invoice,
    createdBy: opts.createdBy,
  });
  if (!cogs.ok) return { ok: false, error: cogs.error };
  return { ok: true };
}

export async function recognizeInvoiceIfNeeded(opts: {
  profileId: number;
  invoice: Record<string, unknown>;
  createdBy?: string | null;
}): Promise<{
  ok: boolean;
  journalId?: number;
  skipped?: boolean;
  error?: string;
}> {
  const inv = opts.invoice;
  if (!isIssuedInvoiceStatus(String(inv.status || ''))) {
    return { ok: true, skipped: true };
  }
  const meta = asMeta(inv.metadata);
  if (invoiceKeepsBankAllocation(meta)) {
    const keep = Number(meta.cash_allocated_journal_id || meta.recognition_journal_id || 0);
    return {
      ok: true,
      skipped: true,
      journalId: keep > 0 ? keep : undefined,
    };
  }
  if (meta.recognition_journal_id) {
    const dep = await applyArDepositsIfNeeded({
      profileId: opts.profileId,
      invoice: inv,
      createdBy: opts.createdBy,
    });
    if (!dep.ok) return { ok: false, error: dep.error };
    return {
      ok: true,
      skipped: true,
      journalId: Number(meta.recognition_journal_id),
    };
  }

  const supabase = getSupabaseServer();
  const invId = Number(inv.id);
  if (Number.isFinite(invId) && invId > 0) {
    const { data: existing } = await supabase
      .from('journal_entries')
      .select('id, metadata, status, source, source_id')
      .eq('profile_id', opts.profileId)
      .eq('source', 'invoice_recognition')
      .eq('source_id', String(invId))
      .eq('status', 'posted');
    const ids = (existing || []).map((j) => Number(j.id));
    const reversed = new Set<number>();
    if (ids.length) {
      const { data: revs } = await supabase
        .from('journal_entries')
        .select('source_id, metadata')
        .eq('profile_id', opts.profileId)
        .eq('source', 'reversal')
        .in('source_id', ids.map(String));
      for (const r of revs || []) {
        const rid = Number(r.source_id || asMeta(r.metadata).reverses_journal_id);
        if (rid > 0) reversed.add(rid);
      }
    }
    const live = (existing || []).filter((j) => {
      const id = Number(j.id);
      return !asMeta(j.metadata).reversed_by_journal_id && !reversed.has(id);
    });
    if (live.length > 1) {
      const keep = Number(live[0].id);
      for (const j of live.slice(1)) {
        await reversePostedJournal({
          profileId: opts.profileId,
          journalId: Number(j.id),
          createdBy: opts.createdBy,
          memo: `Reverse duplicate recognition ${inv.invoice_number || invId}`,
          metadata: { invoice_id: invId, dedupe: true },
        });
      }
      await stampInvoiceMeta(invId, opts.profileId, meta, {
        recognition_journal_id: keep,
        recognized_at: new Date().toISOString(),
      });
      inv.metadata = { ...meta, recognition_journal_id: keep };
      const dep = await applyArDepositsIfNeeded({
        profileId: opts.profileId,
        invoice: inv,
        createdBy: opts.createdBy,
      });
      if (!dep.ok) return { ok: false, error: dep.error };
      return { ok: true, skipped: true, journalId: keep };
    }
    if (live.length) {
      const keeper = Number(live[0].id);
      await stampInvoiceMeta(invId, opts.profileId, meta, {
        recognition_journal_id: keeper,
        recognized_at: new Date().toISOString(),
      });
      inv.metadata = { ...meta, recognition_journal_id: keeper };
      const dep = await applyArDepositsIfNeeded({
        profileId: opts.profileId,
        invoice: inv,
        createdBy: opts.createdBy,
      });
      if (!dep.ok) return { ok: false, error: dep.error };
      return { ok: true, skipped: true, journalId: keeper };
    }
  }

  const total = round2(Number(inv.total_amount || 0));
  const tax = round2(Number(inv.tax_amount || 0));
  const net = round2(
    Number(inv.subtotal || 0) || Math.max(0, round2(total - tax))
  );
  if (total < 0.005) return { ok: true, skipped: true };

  const accts = await invoiceAccounts(opts.profileId);
  const isAr = String(inv.direction || '') !== 'payable';
  if (!isAr) {
    const poId = invoiceLinkedPurchaseOrderId(inv);
    if (poId) {
      const { data: po } = await supabase
        .from('purchase_orders')
        .select('id, cost_journal_entry_id, cost_allocated_at, cost_category, metadata')
        .eq('id', poId)
        .maybeSingle();
      const alloc = isPoApAlreadyAllocated(
        (po || null) as Record<string, unknown> | null
      );
      if (alloc.allocated) {
        await stampInvoiceMeta(invId, opts.profileId, meta, {
          skip_recognition: true,
          po_allocation_journal_id: alloc.journalId,
          recognition_skipped_reason: 'po_already_allocated',
        });
        inv.metadata = {
          ...meta,
          skip_recognition: true,
          po_allocation_journal_id: alloc.journalId,
          recognition_skipped_reason: 'po_already_allocated',
        };
        return {
          ok: true,
          skipped: true,
          journalId: alloc.journalId || undefined,
        };
      }
    }
  }
  const partyGl = await resolvePartyControlAccountId({
    profileId: opts.profileId,
    kind: isAr ? 'ar' : 'ap',
    partyId: isAr ? Number(inv.customer_id || 0) : Number(inv.supplier_id || 0),
    counterpartyName: inv.counterparty_name
      ? String(inv.counterparty_name)
      : null,
  });
  const control = pickRecognitionControlAccount(
    partyGl,
    isAr ? accts.ar : accts.ap
  );
  const entryDate = await pickOpenEntryDate(
    opts.profileId,
    String(inv.issue_date || new Date().toISOString()).slice(0, 10)
  );
  const memo =
    `Recognise ${isAr ? 'AR' : 'AP'} ${inv.invoice_number || inv.id}`.slice(0, 500);
  const counterparty = inv.counterparty_name
    ? String(inv.counterparty_name)
    : null;
  const splits = itemAmounts(inv.items);
  const splitTotal = round2(splits.reduce((s, a) => s + a.amount, 0));
  const useSplits = splits.length > 0 && Math.abs(splitTotal - net) < 0.05;

  const lines: JournalLineInput[] = [];
  let used6990 = false;
  if (isAr) {
    const recoded = await recodeInvoiceBankSales({
      profileId: opts.profileId,
      invoice: inv,
      createdBy: opts.createdBy,
    });
    if (!recoded.ok) return { ok: false, error: recoded.error };
    const revenueCode = arRevenueCodeForInvoice(inv);
    let revenueId =
      revenueCode === '4400' && accts.membership
        ? accts.membership
        : accts.revenue;
    if (revenueCode === '4400') {
      const customerId = Number(inv.customer_id || 0);
      const padded = customerId > 0 ? memberRevAccountCode(customerId) : '';
      const lineCode = Array.isArray(inv.items)
        ? String(
            (inv.items as Array<{ account_code?: string }>).find((row) =>
              /^4400-\d+$/.test(String(row?.account_code || ''))
            )?.account_code || ''
          ).trim()
        : '';
      const want = lineCode || padded;
      if (want) {
        const leafId = await resolveCoaAccountIdByCode(opts.profileId, want);
        if (leafId) revenueId = leafId;
      }
    }
    if (!control || !revenueId) {
      return {
        ok: false,
        error: 'COA missing AR (1130) or sales revenue (4100) — seed Chart of Accounts',
      };
    }
    lines.push({
      accountId: control,
      debit: total,
      credit: 0,
      memo,
      counterparty,
    });
    if (useSplits) {
      for (const s of splits) {
        lines.push({
          accountId: s.accountId,
          debit: 0,
          credit: s.amount,
          memo,
          counterparty,
        });
      }
    } else {
      lines.push({
        accountId: revenueId,
        debit: 0,
        credit: net,
        memo,
        counterparty,
      });
    }
    if (tax > 0) {
      if (!accts.vatOut) {
        return { ok: false, error: 'COA missing VAT output (2120)' };
      }
      lines.push({
        accountId: accts.vatOut,
        debit: 0,
        credit: tax,
        memo: 'VAT output',
      });
    }
  } else {
    let apDebit = accts.expense;
    if (!useSplits) {
      const poId = invoiceLinkedPurchaseOrderId(inv);
      let poCategory: string | null = null;
      if (poId) {
        const { data: po } = await supabase
          .from('purchase_orders')
          .select('cost_category, metadata')
          .eq('id', poId)
          .maybeSingle();
        poCategory = po?.cost_category != null ? String(po.cost_category) : null;
      }
      const category = String(
        inv.cost_category || meta.cost_category || poCategory || 'materials'
      );
      const mapped = mapApCostCategoryToCode(category);
      const code = mapped || '1140';
      const mappedId = await resolveCoaAccountIdByCode(opts.profileId, code);
      const inv1140 = await resolveCoaAccountIdByCode(opts.profileId, '1140');
      if (mappedId) {
        apDebit = mappedId;
      } else if (inv1140) {
        apDebit = inv1140;
      } else {
        apDebit = accts.expense;
        used6990 = Boolean(accts.expense);
      }
    }
    if (!control || !apDebit) {
      return {
        ok: false,
        error: 'COA missing AP (2110) or an inventory/expense account — seed Chart of Accounts',
      };
    }
    if (useSplits) {
      for (const s of splits) {
        lines.push({
          accountId: s.accountId,
          debit: s.amount,
          credit: 0,
          memo,
          counterparty,
        });
      }
    } else {
      lines.push({
        accountId: apDebit,
        debit: net,
        credit: 0,
        memo,
        counterparty,
      });
    }
    if (tax > 0) {
      if (!accts.vatIn) {
        return { ok: false, error: 'COA missing VAT input (1150)' };
      }
      lines.push({
        accountId: accts.vatIn,
        debit: tax,
        credit: 0,
        memo: 'VAT input',
      });
    }
    lines.push({
      accountId: control,
      debit: 0,
      credit: total,
      memo,
      counterparty,
    });
  }

  const posted = await postBalancedJournal({
    profileId: opts.profileId,
    entryDate,
    memo,
    source: 'invoice_recognition',
    sourceId: String(inv.id),
    currency: String(inv.currency || 'ZAR'),
    createdBy: opts.createdBy || null,
    metadata: {
      invoice_id: inv.id,
      direction: inv.direction,
      invoice_number: inv.invoice_number,
      control_account_id: control,
    },
    lines,
  });
  if (!posted.ok) return { ok: false, error: posted.error };

  const extraMeta: Record<string, unknown> = {
    recognition_journal_id: posted.journalId,
    recognized_at: new Date().toISOString(),
    control_account_id: control,
  };
  if (!isAr && used6990) extraMeta.ap_default_6990 = true;
  await stampInvoiceMeta(Number(inv.id), opts.profileId, meta, extraMeta);
  inv.metadata = {
    ...meta,
    ...extraMeta,
  };

  if (isAr) {
    const dep = await applyArDepositsIfNeeded({
      profileId: opts.profileId,
      invoice: inv,
      arAccountId: control,
      createdBy: opts.createdBy,
    });
    if (!dep.ok) return { ok: false, error: dep.error, journalId: posted.journalId };
  }

  return { ok: true, journalId: posted.journalId };
}

export async function settleInvoicePayment(opts: {
  profileId: number;
  invoice: Record<string, unknown>;
  paymentId: number;
  amount: number;
  paidAt?: string | null;
  bankAccountId?: number | null;
  createdBy?: string | null;
}): Promise<{
  ok: boolean;
  journalId?: number;
  skipped?: boolean;
  error?: string;
}> {
  const amount = round2(Math.abs(Number(opts.amount || 0)));
  if (amount < 0.005) return { ok: true, skipped: true };
  if (invoiceSkipsSettlement(opts.invoice.metadata)) {
    const metaSkip = asMeta(opts.invoice.metadata);
    if (
      String(opts.invoice.direction || '') !== 'payable' &&
      isIssuedInvoiceStatus(String(opts.invoice.status || '')) &&
      Number(metaSkip.cash_allocated_journal_id || 0) > 0
    ) {
      const rec = await recognizeInvoiceIfNeeded({
        profileId: opts.profileId,
        invoice: opts.invoice,
        createdBy: opts.createdBy,
      });
      if (!rec.ok) return rec;
    }
    return { ok: true, skipped: true };
  }

  const meta0 = asMeta(opts.invoice.metadata);
  if (paymentAlreadyDeposited(meta0, opts.paymentId)) {
    return { ok: true, skipped: true };
  }

  const isAr0 = String(opts.invoice.direction || '') !== 'payable';
  if (isAr0 && !isIssuedInvoiceStatus(String(opts.invoice.status || ''))) {
    const posted = await postCustomerDeposit({
      profileId: opts.profileId,
      amount,
      paidAt: opts.paidAt,
      bankAccountId: opts.bankAccountId,
      customerId: Number(opts.invoice.customer_id || 0) || null,
      invoiceId: Number(opts.invoice.id || 0) || null,
      paymentId: opts.paymentId,
      counterparty: opts.invoice.counterparty_name
        ? String(opts.invoice.counterparty_name)
        : null,
      createdBy: opts.createdBy,
      memo: `Customer deposit ${opts.invoice.invoice_number || opts.invoice.id}`,
    });
    if (!posted.ok) return posted;
    if (posted.journalId && Number(opts.invoice.id) > 0) {
      await stampInvoiceDepositJournal({
        profileId: opts.profileId,
        invoiceId: Number(opts.invoice.id),
        prevMeta: meta0,
        paymentId: opts.paymentId,
        journalId: posted.journalId,
      });
      const prior = Array.isArray(meta0.deposit_journal_ids)
        ? [...(meta0.deposit_journal_ids as unknown[])]
        : [];
      prior.push({ payment_id: opts.paymentId, journal_id: posted.journalId });
      opts.invoice.metadata = { ...meta0, deposit_journal_ids: prior };
    }
    return { ok: true, journalId: posted.journalId, skipped: posted.skipped };
  }

  const recognized = await recognizeInvoiceIfNeeded({
    profileId: opts.profileId,
    invoice: opts.invoice,
    createdBy: opts.createdBy,
  });
  if (!recognized.ok) return recognized;

  const meta = asMeta(opts.invoice.metadata);
  if (paymentAlreadyDeposited(meta, opts.paymentId)) {
    return { ok: true, skipped: true };
  }
  const prior = Array.isArray(meta.settlement_journal_ids)
    ? (meta.settlement_journal_ids as unknown[])
    : [];
  const already = prior.some((row) => {
    if (row && typeof row === 'object' && 'payment_id' in row) {
      return Number((row as { payment_id: number }).payment_id) === opts.paymentId;
    }
    return false;
  });
  if (already) return { ok: true, skipped: true };

  const accts = await invoiceAccounts(opts.profileId);
  const bankGl = await resolveBankGl(opts.profileId, opts.bankAccountId);
  const isAr = String(opts.invoice.direction || '') !== 'payable';
  const control = pickSettlementControlAccount(
    Number(meta.control_account_id),
    isAr ? accts.ar : accts.ap
  );
  if (!bankGl || !control) {
    return {
      ok: false,
      error: 'COA missing bank or AR/AP control account for settlement',
    };
  }

  const entryDate = await pickOpenEntryDate(
    opts.profileId,
    String(opts.paidAt || new Date().toISOString()).slice(0, 10)
  );
  const memo =
    `Settle ${isAr ? 'AR' : 'AP'} ${opts.invoice.invoice_number || opts.invoice.id}`.slice(
      0,
      500
    );
  const counterparty = opts.invoice.counterparty_name
    ? String(opts.invoice.counterparty_name)
    : null;

  const lines: JournalLineInput[] = isAr
    ? [
        { accountId: bankGl, debit: amount, credit: 0, memo },
        { accountId: control, debit: 0, credit: amount, memo, counterparty },
      ]
    : [
        { accountId: control, debit: amount, credit: 0, memo, counterparty },
        { accountId: bankGl, debit: 0, credit: amount, memo },
      ];

  const posted = await postBalancedJournal({
    profileId: opts.profileId,
    entryDate,
    memo,
    source: 'invoice_settlement',
    sourceId: String(opts.paymentId),
    createdBy: opts.createdBy || null,
    metadata: {
      invoice_id: opts.invoice.id,
      payment_id: opts.paymentId,
    },
    lines,
  });
  if (!posted.ok) return { ok: false, error: posted.error };

  const nextSettlements = [
    ...prior,
    { payment_id: opts.paymentId, journal_id: posted.journalId },
  ];
  await stampInvoiceMeta(Number(opts.invoice.id), opts.profileId, meta, {
    settlement_journal_ids: nextSettlements,
  });
  opts.invoice.metadata = {
    ...meta,
    settlement_journal_ids: nextSettlements,
  };

  return { ok: true, journalId: posted.journalId };
}

export async function reverseInvoiceBooks(opts: {
  profileId: number;
  invoice: Record<string, unknown>;
  createdBy?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const meta = asMeta(opts.invoice.metadata);
  const unique = voidInvoiceJournalIds({
    recognitionJournalId: Number(meta.recognition_journal_id || 0) || null,
    settlementJournalIds: meta.settlement_journal_ids,
    depositApplicationJournalId:
      Number(meta.deposit_application_journal_id || 0) || null,
    cogsJournalId: Number(meta.cogs_journal_id || 0) || null,
  });
  const skipPoAlloc = Number(meta.po_allocation_journal_id || 0);

  for (const jid of unique) {
    if (skipPoAlloc > 0 && jid === skipPoAlloc) continue;
    if (meta.recognition_skipped_reason === 'po_already_allocated' && jid === skipPoAlloc) {
      continue;
    }
    const reversed = await reversePostedJournal({
      profileId: opts.profileId,
      journalId: jid,
      createdBy: opts.createdBy,
      memo: `Reversal of invoice ${opts.invoice.invoice_number || opts.invoice.id} voided`,
      metadata: {
        invoice_id: opts.invoice.id,
        invoice_void: true,
      },
    });
    if (!reversed.ok) return { ok: false, error: reversed.error };
  }

  await stampInvoiceMeta(Number(opts.invoice.id), opts.profileId, meta, {
    recognition_journal_id: null,
    recognition_reversed_at: new Date().toISOString(),
    books_reversed: true,
    prior_recognition_journal_id: meta.recognition_journal_id || null,
    deposit_application_journal_id: null,
    prior_deposit_application_journal_id:
      meta.deposit_application_journal_id || null,
    deposit_applied: 0,
    cogs_journal_id: null,
    prior_cogs_journal_id: meta.cogs_journal_id || null,
    cogs_amount: 0,
  });
  return { ok: true };
}
