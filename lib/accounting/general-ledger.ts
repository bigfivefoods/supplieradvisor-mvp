/**
 * General ledger — the book of accounts (IAS 1 / Conceptual Framework).
 * Posted journals only. Opening balance is activity before `from`;
 * period lines are dated in [from, to]; running balance is debit − credit.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { round2 } from '@/lib/accounting/server';
import {
  fetchJournalLinesByEntryIds,
  fetchPostedJournals,
} from '@/lib/accounting/journal-query';
import type {
  GeneralLedger,
  LedgerAccount,
  LedgerMovement,
  LedgerNormal,
} from '@/lib/accounting/statement-types';

export type {
  GeneralLedger,
  LedgerAccount,
  LedgerMovement,
  LedgerNormal,
} from '@/lib/accounting/statement-types';

export function normalBalanceForType(accountType: string): LedgerNormal {
  const t = String(accountType || '').toLowerCase();
  if (t === 'liability' || t === 'equity' || t === 'revenue') return 'credit';
  return 'debit';
}

export function naturalAmount(
  signedDebitMinusCredit: number,
  normal: LedgerNormal
): number {
  return round2(
    normal === 'credit' ? -signedDebitMinusCredit : signedDebitMinusCredit
  );
}

export function assembleAccountLedger(opts: {
  account_id: number;
  code: string;
  name: string;
  account_type: string;
  subtype?: string | null;
  normal_balance?: LedgerNormal;
  openingDebit: number;
  openingCredit: number;
  lines: Array<{
    date: string;
    journal_id: number;
    entry_number?: string | null;
    memo?: string | null;
    line_memo?: string | null;
    source?: string | null;
    debit: number;
    credit: number;
  }>;
}): LedgerAccount {
  const normal =
    opts.normal_balance || normalBalanceForType(opts.account_type);
  const opening = round2(opts.openingDebit - opts.openingCredit);
  const sorted = [...opts.lines].sort(
    (a, b) =>
      a.date.localeCompare(b.date) || a.journal_id - b.journal_id
  );
  let run = opening;
  let periodDebit = 0;
  let periodCredit = 0;
  const movements: LedgerMovement[] = sorted.map((l) => {
    const debit = round2(l.debit);
    const credit = round2(l.credit);
    periodDebit += debit;
    periodCredit += credit;
    run = round2(run + debit - credit);
    return {
      date: l.date,
      journal_id: l.journal_id,
      entry_number: l.entry_number || null,
      memo: l.memo || null,
      line_memo: l.line_memo || null,
      source: l.source || null,
      debit,
      credit,
      balance: run,
      natural_balance: naturalAmount(run, normal),
    };
  });
  const closing = round2(opening + periodDebit - periodCredit);
  return {
    account_id: opts.account_id,
    code: opts.code,
    name: opts.name,
    account_type: opts.account_type,
    subtype: opts.subtype || null,
    normal_balance: normal,
    opening,
    opening_natural: naturalAmount(opening, normal),
    period_debit: round2(periodDebit),
    period_credit: round2(periodCredit),
    closing,
    closing_natural: naturalAmount(closing, normal),
    movement_count: movements.length,
    movements,
  };
}

export async function buildGeneralLedger(opts: {
  profileId: number;
  from: string;
  to: string;
  accountId?: number | null;
}): Promise<GeneralLedger> {
  const from = String(opts.from).slice(0, 10);
  const to = String(opts.to).slice(0, 10);
  const supabase = getSupabaseServer();

  const { data: accountsRaw } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name, account_type, subtype, normal_balance, is_header')
    .eq('profile_id', opts.profileId)
    .order('code', { ascending: true });

  const accounts = (accountsRaw || [])
    .filter((a) => !a.is_header)
    .map((a) => ({
      id: Number(a.id),
      code: String(a.code || ''),
      name: String(a.name || ''),
      account_type: String(a.account_type || ''),
      subtype: (a.subtype as string | null) || null,
      normal_balance: (String(a.normal_balance || '') === 'credit'
        ? 'credit'
        : normalBalanceForType(String(a.account_type || ''))) as LedgerNormal,
    }));
  const byId = new Map(accounts.map((a) => [a.id, a]));

  const { rows: journals, warning } = await fetchPostedJournals({
    profileId: opts.profileId,
    to,
  });
  const jeById = new Map(journals.map((j) => [j.id, j]));

  const extra = await fetchJournalMemos(journals.map((j) => j.id));

  const { lines: rawLines, warning: lineWarn } = await fetchJournalLinesByEntryIds(
    journals.map((j) => j.id),
    'journal_entry_id, account_id, debit, credit, memo'
  );

  const openingByAcct = new Map<number, { debit: number; credit: number }>();
  const periodByAcct = new Map<
    number,
    Array<{
      date: string;
      journal_id: number;
      entry_number: string | null;
      memo: string | null;
      line_memo: string | null;
      source: string | null;
      debit: number;
      credit: number;
    }>
  >();

  let journalIdsInPeriod = new Set<number>();

  for (const l of rawLines) {
    const jid = Number(l.journal_entry_id);
    const aid = Number(l.account_id);
    if (!Number.isFinite(jid) || !Number.isFinite(aid)) continue;
    const je = jeById.get(jid);
    if (!je) continue;
    const date = je.entry_date;
    const debit = Number(l.debit || 0);
    const credit = Number(l.credit || 0);
    if (date < from) {
      const cur = openingByAcct.get(aid) || { debit: 0, credit: 0 };
      cur.debit += debit;
      cur.credit += credit;
      openingByAcct.set(aid, cur);
      continue;
    }
    if (date > to) continue;
    journalIdsInPeriod.add(jid);
    const meta = extra.get(jid);
    const arr = periodByAcct.get(aid) || [];
    arr.push({
      date,
      journal_id: jid,
      entry_number: meta?.entry_number || null,
      memo: meta?.memo || null,
      line_memo: l.memo != null ? String(l.memo) : null,
      source: je.source || null,
      debit,
      credit,
    });
    periodByAcct.set(aid, arr);
  }

  const want = opts.accountId != null ? Number(opts.accountId) : null;
  const ledgerAccounts: LedgerAccount[] = [];
  let totalDr = 0;
  let totalCr = 0;

  for (const a of accounts) {
    const open = openingByAcct.get(a.id) || { debit: 0, credit: 0 };
    const lines = periodByAcct.get(a.id) || [];
    if (
      Math.abs(open.debit) < 0.005 &&
      Math.abs(open.credit) < 0.005 &&
      !lines.length
    ) {
      continue;
    }
    const includeMoves = want == null || want === a.id;
    const row = assembleAccountLedger({
      account_id: a.id,
      code: a.code,
      name: a.name,
      account_type: a.account_type,
      subtype: a.subtype,
      normal_balance: a.normal_balance,
      openingDebit: open.debit,
      openingCredit: open.credit,
      lines: includeMoves ? lines : [],
    });
    if (!includeMoves) {
      row.period_debit = round2(lines.reduce((s, l) => s + l.debit, 0));
      row.period_credit = round2(lines.reduce((s, l) => s + l.credit, 0));
      row.closing = round2(row.opening + row.period_debit - row.period_credit);
      row.closing_natural = naturalAmount(row.closing, row.normal_balance);
      row.movement_count = lines.length;
      row.movements = [];
    }
    totalDr += row.period_debit;
    totalCr += row.period_credit;
    ledgerAccounts.push(row);
  }

  totalDr = round2(totalDr);
  totalCr = round2(totalCr);
  const difference = round2(totalDr - totalCr);

  return {
    from,
    to,
    accounts: ledgerAccounts,
    total_period_debit: totalDr,
    total_period_credit: totalCr,
    balanced: Math.abs(difference) < 0.005,
    difference,
    journal_count: journalIdsInPeriod.size,
    warning: warning || lineWarn,
    basis:
      'Posted double-entry general ledger. Accrual basis (IAS 1 / Conceptual Framework). Unaudited.',
  };
}

async function fetchJournalMemos(
  ids: number[]
): Promise<Map<number, { memo: string | null; entry_number: string | null }>> {
  const out = new Map<number, { memo: string | null; entry_number: string | null }>();
  if (!ids.length) return out;
  const supabase = getSupabaseServer();
  const chunkSize = 150;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const full = await supabase
      .from('journal_entries')
      .select('id, memo, entry_number')
      .in('id', chunk);
    if (!full.error && full.data) {
      for (const r of full.data) {
        out.set(Number(r.id), {
          memo: r.memo != null ? String(r.memo) : null,
          entry_number: r.entry_number != null ? String(r.entry_number) : null,
        });
      }
      continue;
    }
    const memoOnly = await supabase
      .from('journal_entries')
      .select('id, memo')
      .in('id', chunk);
    if (!memoOnly.error && memoOnly.data) {
      for (const r of memoOnly.data) {
        out.set(Number(r.id), {
          memo: r.memo != null ? String(r.memo) : null,
          entry_number: null,
        });
      }
    }
  }
  return out;
}
