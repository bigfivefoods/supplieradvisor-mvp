/**
 * IFRS 9 simplified ECL worksheet for trade receivables.
 * Rates are set by management; the post is Dr 6820 · Cr 1135 (or reverse).
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { getOrCreateSettings, round2 } from '@/lib/accounting/server';
import { invoiceBalance } from '@/lib/accounting/types';
import {
  postBalancedJournal,
  resolveCoaAccountId,
  resolveCoaAccountIdByCode,
} from '@/lib/accounting/post-journal';
import { fetchJournalLinesByEntryIds, fetchPostedJournals } from '@/lib/accounting/journal-query';
import {
  DEFAULT_ECL_RATES,
  ECL_BUCKETS,
  agingBucket,
  normalizeEclRates,
  type EclBucket,
} from '@/lib/accounting/ecl-types';

export type { EclBucket } from '@/lib/accounting/ecl-types';
export {
  DEFAULT_ECL_RATES,
  ECL_BUCKETS,
  agingBucket,
  normalizeEclRates,
} from '@/lib/accounting/ecl-types';

export type EclInvoiceRow = {
  id: number;
  invoice_number: string | null;
  counterparty_name: string | null;
  due_date: string | null;
  issue_date: string | null;
  balance_due: number;
  days_overdue: number;
  bucket: EclBucket;
  rate: number;
  ecl: number;
};

export async function buildEclWorksheet(opts: {
  profileId: number;
  rates?: Partial<Record<EclBucket, number>> | null;
  overrides?: Record<string, number>;
}): Promise<{
  rates: Record<EclBucket, number>;
  invoices: EclInvoiceRow[];
  byBucket: Record<
    EclBucket,
    { balance: number; ecl: number; count: number; rate: number }
  >;
  totalBalance: number;
  targetAllowance: number;
  currentAllowance: number;
  adjustment: number;
  currency: string;
}> {
  const settings = await getOrCreateSettings(opts.profileId);
  const stored =
    settings.metadata && typeof settings.metadata === 'object'
      ? ((settings.metadata as { ecl_rates?: Partial<Record<EclBucket, number>> })
          .ecl_rates || null)
      : null;
  const rates = normalizeEclRates(opts.rates || stored);
  const overrides = opts.overrides || {};

  const supabase = getSupabaseServer();
  const { data: invoices } = await supabase
    .from('invoices')
    .select(
      'id, invoice_number, counterparty_name, due_date, issue_date, total_amount, amount_paid, status'
    )
    .eq('profile_id', opts.profileId)
    .eq('direction', 'receivable')
    .not('status', 'in', '("paid","void","cancelled","draft")');

  const rows: EclInvoiceRow[] = [];
  const byBucket = Object.fromEntries(
    ECL_BUCKETS.map((b) => [b, { balance: 0, ecl: 0, count: 0, rate: rates[b] }])
  ) as Record<EclBucket, { balance: number; ecl: number; count: number; rate: number }>;

  for (const inv of invoices || []) {
    const bal = invoiceBalance(inv);
    if (bal <= 0.005) continue;
    const due = inv.due_date
      ? new Date(String(inv.due_date))
      : new Date(String(inv.issue_date || Date.now()));
    due.setHours(23, 59, 59, 999);
    const days = Math.floor((Date.now() - due.getTime()) / 86400000);
    const bucket = agingBucket(days);
    const override = overrides[String(inv.id)];
    const rate =
      override != null && Number.isFinite(Number(override))
        ? Number(override)
        : rates[bucket];
    const ecl = round2((bal * rate) / 100);
    rows.push({
      id: Number(inv.id),
      invoice_number: inv.invoice_number || null,
      counterparty_name: inv.counterparty_name || null,
      due_date: inv.due_date || null,
      issue_date: inv.issue_date || null,
      balance_due: round2(bal),
      days_overdue: Math.max(0, days),
      bucket,
      rate,
      ecl,
    });
    byBucket[bucket].balance = round2(byBucket[bucket].balance + bal);
    byBucket[bucket].ecl = round2(byBucket[bucket].ecl + ecl);
    byBucket[bucket].count += 1;
  }

  rows.sort((a, b) => b.days_overdue - a.days_overdue);

  const currentAllowance = await creditBalanceOf(opts.profileId, [
    '1135',
  ], ['contra_asset']);
  const targetAllowance = round2(rows.reduce((s, r) => s + r.ecl, 0));

  return {
    rates,
    invoices: rows,
    byBucket,
    totalBalance: round2(rows.reduce((s, r) => s + r.balance_due, 0)),
    targetAllowance,
    currentAllowance,
    adjustment: round2(targetAllowance - currentAllowance),
    currency: String(settings.base_currency || 'ZAR'),
  };
}

async function creditBalanceOf(
  profileId: number,
  codes: string[],
  subtypes: string[]
): Promise<number> {
  const id =
    (await resolveCoaAccountIdByCode(profileId, codes[0])) ||
    (await resolveCoaAccountId({
      profileId,
      codes,
      subtypes,
      accountTypes: ['asset'],
    }));
  if (!id) return 0;
  const { rows } = await fetchPostedJournals({ profileId });
  const { lines } = await fetchJournalLinesByEntryIds(
    rows.map((r) => r.id),
    'account_id, debit, credit'
  );
  let dr = 0;
  let cr = 0;
  for (const l of lines) {
    if (Number(l.account_id) !== id) continue;
    dr += Number(l.debit || 0);
    cr += Number(l.credit || 0);
  }
  return round2(cr - dr);
}

export async function postEclAllowance(opts: {
  profileId: number;
  rates?: Partial<Record<EclBucket, number>> | null;
  overrides?: Record<string, number>;
  createdBy?: string | null;
  entryDate?: string | null;
}): Promise<
  | {
      ok: true;
      journalId?: number;
      entryNumber?: string;
      skipped?: boolean;
      adjustment: number;
      targetAllowance: number;
      currentAllowance: number;
    }
  | { ok: false; error: string }
> {
  const sheet = await buildEclWorksheet({
    profileId: opts.profileId,
    rates: opts.rates,
    overrides: opts.overrides,
  });
  const adj = sheet.adjustment;
  if (Math.abs(adj) < 0.005) {
    return {
      ok: true,
      skipped: true,
      adjustment: 0,
      targetAllowance: sheet.targetAllowance,
      currentAllowance: sheet.currentAllowance,
    };
  }

  const allowanceId =
    (await resolveCoaAccountIdByCode(opts.profileId, '1135')) ||
    (await resolveCoaAccountId({
      profileId: opts.profileId,
      codes: ['1135'],
      subtypes: ['contra_asset'],
      accountTypes: ['asset'],
    }));
  const expenseId =
    (await resolveCoaAccountIdByCode(opts.profileId, '6820')) ||
    (await resolveCoaAccountId({
      profileId: opts.profileId,
      codes: ['6820'],
      subtypes: ['credit_loss'],
      accountTypes: ['expense'],
    }));
  if (!allowanceId || !expenseId) {
    return {
      ok: false,
      error:
        'COA missing 1135 Allowance for ECL or 6820 Credit loss expense — seed Chart of Accounts',
    };
  }

  const abs = Math.abs(adj);
  const increase = adj > 0;
  const entryDate =
    String(opts.entryDate || new Date().toISOString()).slice(0, 10);
  const posted = await postBalancedJournal({
    profileId: opts.profileId,
    entryDate,
    memo: increase
      ? `ECL allowance increase to ${sheet.targetAllowance.toFixed(2)}`
      : `ECL allowance release to ${sheet.targetAllowance.toFixed(2)}`,
    source: 'ecl_allowance',
    sourceId: entryDate,
    createdBy: opts.createdBy || null,
    metadata: {
      target_allowance: sheet.targetAllowance,
      previous_allowance: sheet.currentAllowance,
      rates: sheet.rates,
    },
    lines: increase
      ? [
          { accountId: expenseId, debit: abs, credit: 0, memo: 'Credit loss expense' },
          { accountId: allowanceId, debit: 0, credit: abs, memo: 'Allowance for ECL' },
        ]
      : [
          { accountId: allowanceId, debit: abs, credit: 0, memo: 'Release ECL allowance' },
          { accountId: expenseId, debit: 0, credit: abs, memo: 'Credit loss expense' },
        ],
  });
  if (!posted.ok) return { ok: false, error: posted.error };

  const settings = await getOrCreateSettings(opts.profileId);
  const supabase = getSupabaseServer();
  const prev =
    settings.metadata && typeof settings.metadata === 'object'
      ? { ...(settings.metadata as Record<string, unknown>) }
      : {};
  await supabase
    .from('accounting_settings')
    .update({
      metadata: {
        ...prev,
        ecl_rates: sheet.rates,
        last_ecl_journal_id: posted.journalId,
        last_ecl_at: new Date().toISOString(),
        last_ecl_target: sheet.targetAllowance,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('profile_id', opts.profileId);

  return {
    ok: true,
    journalId: posted.journalId,
    entryNumber: posted.entryNumber,
    adjustment: adj,
    targetAllowance: sheet.targetAllowance,
    currentAllowance: sheet.currentAllowance,
  };
}
