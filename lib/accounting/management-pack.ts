/**
 * Period management-accounts pack used by the on-screen view and the one-pager PDF.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { round2 } from '@/lib/accounting/server';
import {
  fetchJournalLinesByEntryIds,
  fetchPostedJournals,
} from '@/lib/accounting/journal-query';
import { buildBudgetVsActual } from '@/lib/accounting/budget-vs-actual';
import { MONTH_SHORT } from '@/lib/accounting/fiscal';

export type MgmtPackLine = {
  code: string;
  name: string;
  amount: number;
};

export type MgmtPackMonth = {
  key: string;
  label: string;
  revenue: number;
  cogs: number;
  expenses: number;
  net: number;
};

export type ManagementPack = {
  companyName: string;
  currency: string;
  from: string;
  to: string;
  label: string;
  summary: {
    revenue: number;
    cogs: number;
    grossProfit: number;
    expenses: number;
    operatingProfit: number;
    netIncome: number;
    bankIn: number;
    bankOut: number;
    bankNet: number;
    unallocated: number;
    unallocatedIn: number;
    unallocatedOut: number;
    journalCount: number;
    allocatedCount: number;
  };
  income: MgmtPackLine[];
  cogs: MgmtPackLine[];
  expenses: MgmtPackLine[];
  months: MgmtPackMonth[];
  budget: {
    hasBudget: boolean;
    budgetRevenue: number;
    actualRevenue: number;
    budgetExpenses: number;
    actualExpenses: number;
    budgetNet: number;
    actualNet: number;
  } | null;
};

function monthKey(iso: string): string {
  return String(iso || '').slice(0, 7);
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  if (!y || !m) return key;
  return `${MONTH_SHORT[m - 1] || key} ${String(y).slice(2)}`;
}

function shiftMonth(key: string, delta: number): string {
  const [y0, m0] = key.split('-').map(Number);
  const d = new Date(y0, m0 - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthKeysInclusive(from: string, to: string): string[] {
  const start = monthKey(from);
  const end = monthKey(to);
  const keys: string[] = [];
  let cur = start;
  for (let i = 0; i < 24 && cur <= end; i++) {
    keys.push(cur);
    cur = shiftMonth(cur, 1);
  }
  return keys;
}

/** At least 6 months ending at `to`, at most 12, covering the selected range. */
export function trendMonthKeys(from: string, to: string): string[] {
  let keys = monthKeysInclusive(from, to);
  if (keys.length > 12) keys = keys.slice(-12);
  while (keys.length < 6) {
    keys = [shiftMonth(keys[0] || monthKey(to), -1), ...keys];
  }
  return keys;
}

function signedPnl(type: string, debit: number, credit: number): number {
  const t = String(type || '').toLowerCase();
  if (t === 'revenue' || t === 'income' || t === 'sales') {
    return round2(credit - debit);
  }
  if (t === 'expense' || t === 'expenses' || t === 'opex' || t === 'cogs') {
    return round2(debit - credit);
  }
  return 0;
}

export async function buildManagementPack(opts: {
  profileId: number;
  from: string;
  to: string;
  label?: string | null;
}): Promise<ManagementPack> {
  const from = String(opts.from).slice(0, 10);
  const to = String(opts.to).slice(0, 10);
  const { getCachedSettings } = await import('@/lib/accounting/read-cache');
  const settings = await getCachedSettings(opts.profileId);
  const currency = String(settings.base_currency || 'ZAR');
  const supabase = getSupabaseServer();

  let companyName = `Company #${opts.profileId}`;
  {
    const { data: profile } = await supabase
      .from('profiles')
      .select('trading_name, legal_name')
      .eq('id', opts.profileId)
      .maybeSingle();
    companyName =
      profile?.trading_name || profile?.legal_name || companyName;
  }

  try {
    const { recognizeIssuedCrmInvoices } = await import(
      '@/lib/accounting/crm-invoice-gl'
    );
    await recognizeIssuedCrmInvoices({
      profileId: opts.profileId,
      from,
      to,
    });
  } catch (e) {
    console.warn('mgmt pack CRM books', e);
  }

  const { data: accountsRaw } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name, account_type, is_header')
    .eq('profile_id', opts.profileId)
    .order('code');
  const accounts = (accountsRaw || [])
    .filter((a) => !a.is_header)
    .map((a) => ({
      id: Number(a.id),
      code: String(a.code || ''),
      name: String(a.name || ''),
      account_type: String(a.account_type || ''),
    }));
  const acctById = new Map(accounts.map((a) => [a.id, a]));

  const trendKeys = trendMonthKeys(from, to);
  const histFrom = `${trendKeys[0]}-01`;

  const { rows: journals } = await fetchPostedJournals({
    profileId: opts.profileId,
    from: histFrom,
    to,
  });
  const byId = new Map(journals.map((j) => [j.id, j]));
  const { lines: rawLines } = await fetchJournalLinesByEntryIds(
    journals.map((j) => j.id),
    'journal_entry_id, account_id, debit, credit'
  );

  const periodByAcct = new Map<number, { debit: number; credit: number }>();
  const monthByAcct = new Map<
    string,
    Map<number, { debit: number; credit: number }>
  >();
  for (const k of trendKeys) monthByAcct.set(k, new Map());

  let periodJournalIds = new Set<number>();
  for (const l of rawLines) {
    const jid = Number(l.journal_entry_id);
    const je = byId.get(jid);
    if (!je) continue;
    if (String(je.source || '') === 'year_end_close') continue;
    const aid = Number(l.account_id);
    const d = Number(l.debit || 0);
    const c = Number(l.credit || 0);
    if (!Number.isFinite(aid)) continue;
    const mk = monthKey(je.entry_date);
    const monthMap = monthByAcct.get(mk);
    if (monthMap) {
      const cur = monthMap.get(aid) || { debit: 0, credit: 0 };
      cur.debit += d;
      cur.credit += c;
      monthMap.set(aid, cur);
    }
    if (je.entry_date >= from && je.entry_date <= to) {
      periodJournalIds.add(jid);
      const cur = periodByAcct.get(aid) || { debit: 0, credit: 0 };
      cur.debit += d;
      cur.credit += c;
      periodByAcct.set(aid, cur);
    }
  }

  const income: MgmtPackLine[] = [];
  const cogs: MgmtPackLine[] = [];
  const expenses: MgmtPackLine[] = [];
  let revenue = 0;
  let cogsTot = 0;
  let expTot = 0;
  for (const a of accounts) {
    const t = periodByAcct.get(a.id);
    if (!t) continue;
    const type = a.account_type.toLowerCase();
    const amount = signedPnl(type, t.debit, t.credit);
    if (Math.abs(amount) < 0.005) continue;
    const row = { code: a.code, name: a.name, amount };
    if (type === 'revenue' || type === 'income' || type === 'sales') {
      income.push(row);
      revenue += amount;
    } else if (type === 'cogs' || type === 'cost_of_sales') {
      cogs.push(row);
      cogsTot += amount;
    } else if (type === 'expense' || type === 'expenses' || type === 'opex') {
      expenses.push(row);
      expTot += amount;
    }
  }
  revenue = round2(revenue);
  cogsTot = round2(cogsTot);
  expTot = round2(expTot);
  const grossProfit = round2(revenue - cogsTot);
  const operatingProfit = round2(grossProfit - expTot);

  const sortAmt = (a: MgmtPackLine, b: MgmtPackLine) =>
    Math.abs(b.amount) - Math.abs(a.amount);
  income.sort(sortAmt);
  cogs.sort(sortAmt);
  expenses.sort(sortAmt);

  const months: MgmtPackMonth[] = trendKeys.map((key) => {
    const map = monthByAcct.get(key) || new Map();
    let rev = 0;
    let cg = 0;
    let ex = 0;
    for (const [aid, t] of map) {
      const a = acctById.get(aid);
      if (!a) continue;
      const type = a.account_type.toLowerCase();
      const amount = signedPnl(type, t.debit, t.credit);
      if (type === 'revenue' || type === 'income' || type === 'sales') rev += amount;
      else if (type === 'cogs' || type === 'cost_of_sales') cg += amount;
      else if (type === 'expense' || type === 'expenses' || type === 'opex') ex += amount;
    }
    const net = round2(rev - cg - ex);
    return {
      key,
      label: monthLabel(key),
      revenue: round2(rev),
      cogs: round2(cg),
      expenses: round2(ex),
      net,
    };
  });

  let bankIn = 0;
  let bankOut = 0;
  let unallocated = 0;
  let unallocatedIn = 0;
  let unallocatedOut = 0;
  let allocatedCount = 0;
  {
    let bankQ = supabase
      .from('bank_transactions')
      .select('amount, allocation_status, txn_date')
      .eq('profile_id', opts.profileId);
    bankQ = bankQ.gte('txn_date', from).lte('txn_date', to);
    const { data: bankTxns } = await bankQ.limit(2000);
    for (const t of bankTxns || []) {
      const amt = Number(t.amount || 0);
      if (amt > 0) bankIn += amt;
      else bankOut += Math.abs(amt);
      const st = String(t.allocation_status || 'unallocated');
      if (st === 'unallocated') {
        unallocated += 1;
        if (amt > 0) unallocatedIn += amt;
        else unallocatedOut += Math.abs(amt);
      } else if (st === 'allocated' || st === 'matched_invoice') {
        allocatedCount += 1;
      }
    }
  }

  let budget: ManagementPack['budget'] = null;
  try {
    const actualByAccount: Record<number, { debit: number; credit: number }> = {};
    for (const [aid, t] of periodByAcct) actualByAccount[aid] = t;
    const bva = await buildBudgetVsActual({
      companyId: opts.profileId,
      from,
      to,
      accounts: accounts as unknown as Array<Record<string, unknown>>,
      actualByAccount,
    });
    if (bva.summary) {
      budget = {
        hasBudget: Boolean(bva.summary.hasBudget),
        budgetRevenue: Number(bva.summary.budgetRevenue || 0),
        actualRevenue: Number(bva.summary.actualRevenue || 0),
        budgetExpenses: Number(bva.summary.budgetExpenses || 0),
        actualExpenses: Number(bva.summary.actualExpenses || 0),
        budgetNet: Number(bva.summary.budgetNet || 0),
        actualNet: Number(bva.summary.actualNet || 0),
      };
    }
  } catch {
    budget = null;
  }

  return {
    companyName,
    currency,
    from,
    to,
    label: opts.label || `${from} → ${to}`,
    summary: {
      revenue,
      cogs: cogsTot,
      grossProfit,
      expenses: expTot,
      operatingProfit,
      netIncome: operatingProfit,
      bankIn: round2(bankIn),
      bankOut: round2(bankOut),
      bankNet: round2(bankIn - bankOut),
      unallocated,
      unallocatedIn: round2(unallocatedIn),
      unallocatedOut: round2(unallocatedOut),
      journalCount: periodJournalIds.size,
      allocatedCount,
    },
    income,
    cogs,
    expenses,
    months,
    budget,
  };
}

export function managementPackFilename(pack: ManagementPack): string {
  const slug = pack.companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `mgmt-accounts-${slug || 'company'}-${pack.from}-to-${pack.to}.pdf`;
}
