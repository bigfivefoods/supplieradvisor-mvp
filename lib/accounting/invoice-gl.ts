/**
 * Accrual recognition and settlement for AR/AP invoices (IAS 1 / IFRS 15 cash vs accrual).
 *
 * Issue (not draft): Dr AR · Cr revenue · Cr VAT output
 *                 or Dr expense · Dr VAT input · Cr AP
 * Cash applied:     Dr bank · Cr AR   /   Dr AP · Cr bank
 *
 * Bank lines coded straight to income remain cash-basis — do not also match those
 * receipts to an invoice or revenue will double-count.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  postBalancedJournal,
  resolveCoaAccountId,
  resolveCoaAccountIdByCode,
  type JournalLineInput,
} from '@/lib/accounting/post-journal';
import { isPeriodLocked } from '@/lib/accounting/period-lock';
import { round2 } from '@/lib/accounting/server';

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
  return { ar, ap, vatOut, vatIn, revenue, expense, bank };
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
  if (meta.recognition_journal_id) {
    return {
      ok: true,
      skipped: true,
      journalId: Number(meta.recognition_journal_id),
    };
  }

  const total = round2(Number(inv.total_amount || 0));
  const tax = round2(Number(inv.tax_amount || 0));
  const net = round2(
    Number(inv.subtotal || 0) || Math.max(0, round2(total - tax))
  );
  if (total < 0.005) return { ok: true, skipped: true };

  const accts = await invoiceAccounts(opts.profileId);
  const isAr = String(inv.direction || '') !== 'payable';
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
  if (isAr) {
    if (!accts.ar || !accts.revenue) {
      return {
        ok: false,
        error: 'COA missing AR (1130) or sales revenue (4100) — seed Chart of Accounts',
      };
    }
    lines.push({
      accountId: accts.ar,
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
        accountId: accts.revenue,
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
    if (!accts.ap || !accts.expense) {
      return {
        ok: false,
        error: 'COA missing AP (2110) or an expense account — seed Chart of Accounts',
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
        accountId: accts.expense,
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
      accountId: accts.ap,
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
    },
    lines,
  });
  if (!posted.ok) return { ok: false, error: posted.error };

  await stampInvoiceMeta(Number(inv.id), opts.profileId, meta, {
    recognition_journal_id: posted.journalId,
    recognized_at: new Date().toISOString(),
  });
  inv.metadata = {
    ...meta,
    recognition_journal_id: posted.journalId,
    recognized_at: new Date().toISOString(),
  };

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

  const recognized = await recognizeInvoiceIfNeeded({
    profileId: opts.profileId,
    invoice: opts.invoice,
    createdBy: opts.createdBy,
  });
  if (!recognized.ok) return recognized;

  const meta = asMeta(opts.invoice.metadata);
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
  const control = isAr ? accts.ar : accts.ap;
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
  const supabase = getSupabaseServer();
  const meta = asMeta(opts.invoice.metadata);
  const journalIds: number[] = [];
  if (meta.recognition_journal_id) {
    journalIds.push(Number(meta.recognition_journal_id));
  }
  if (Array.isArray(meta.settlement_journal_ids)) {
    for (const row of meta.settlement_journal_ids as unknown[]) {
      if (row && typeof row === 'object' && 'journal_id' in row) {
        journalIds.push(Number((row as { journal_id: number }).journal_id));
      } else if (typeof row === 'number') {
        journalIds.push(row);
      }
    }
  }
  const unique = [...new Set(journalIds.filter((n) => Number.isFinite(n) && n > 0))];
  const today = new Date().toISOString().slice(0, 10);

  for (const jid of unique) {
    const { data: je } = await supabase
      .from('journal_entries')
      .select('id, status, entry_date, memo, entry_number')
      .eq('id', jid)
      .eq('profile_id', opts.profileId)
      .maybeSingle();
    if (!je || String(je.status) !== 'posted') continue;

    const { data: oldLines } = await supabase
      .from('journal_lines')
      .select('account_id, debit, credit, memo, counterparty')
      .eq('journal_entry_id', jid);
    if (!oldLines?.length) continue;

    const entryDate = await pickOpenEntryDate(
      opts.profileId,
      String(je.entry_date || today)
    );
    const reversed = await postBalancedJournal({
      profileId: opts.profileId,
      entryDate,
      memo: `Reversal of ${je.entry_number || jid} (invoice ${opts.invoice.invoice_number || opts.invoice.id} voided)`,
      source: 'reversal',
      sourceId: String(jid),
      createdBy: opts.createdBy || null,
      metadata: {
        reverses_journal_id: jid,
        invoice_id: opts.invoice.id,
        invoice_void: true,
      },
      lines: oldLines.map((l) => ({
        accountId: Number(l.account_id),
        debit: round2(Number(l.credit || 0)),
        credit: round2(Number(l.debit || 0)),
        memo: l.memo,
        counterparty: l.counterparty,
      })),
    });
    if (!reversed.ok) return { ok: false, error: reversed.error };
  }

  await stampInvoiceMeta(Number(opts.invoice.id), opts.profileId, meta, {
    recognition_journal_id: null,
    recognition_reversed_at: new Date().toISOString(),
    books_reversed: true,
    prior_recognition_journal_id: meta.recognition_journal_id || null,
  });
  return { ok: true };
}
