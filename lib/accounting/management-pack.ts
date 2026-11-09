/**
 * Period management-accounts pack used by the on-screen view and the one-pager PDF.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { round2 } from '@/lib/accounting/server';
import { loadPostedLedger, totalsFromLedger } from '@/lib/accounting/posted-ledger';
import { buildBudgetVsActual } from '@/lib/accounting/budget-vs-actual';
import { MONTH_SHORT } from '@/lib/accounting/fiscal';
import {
  PNL_EXCLUDED_SOURCES,
  isCogsType,
  isExpenseType,
  isRevenueType,
  ledgerCoverageWarning,
  pnlAccountLines,
  signedStatementAmount,
} from '@/lib/accounting/statement-figures';

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
  warning?: string;
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
  if (!isRevenueType(type) && !isCogsType(type) && !isExpenseType(type)) return 0;
  return signedStatementAmount(type, debit, credit);
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

  const ledger = await loadPostedLedger({
    profileId: opts.profileId,
    from: histFrom,
    to,
    includeLines: true,
    journalColumns: 'core',
    lineColumns: 'amounts',
  });
  const journals = ledger.journals;
  const byId = new Map(journals.map((j) => [j.id, j]));
  const rawLines = ledger.lines;

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
    if (PNL_EXCLUDED_SOURCES.has(String(je.source || '').toLowerCase())) continue;
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

  const grouped = pnlAccountLines(accounts, periodByAcct);
  const income: MgmtPackLine[] = grouped.income.map((row) => ({
    code: row.code,
    name: row.name,
    amount: row.amount,
  }));
  const cogs: MgmtPackLine[] = grouped.cogsLines.map((row) => ({
    code: row.code,
    name: row.name,
    amount: row.amount,
  }));
  const expenses: MgmtPackLine[] = grouped.expenseLines.map((row) => ({
    code: row.code,
    name: row.name,
    amount: row.amount,
  }));
  const revenue = grouped.revenue;
  const cogsTot = grouped.cogs;
  const expTot = grouped.expenses;
  const grossProfit = grouped.grossProfit;
  const operatingProfit = grouped.operatingProfit;
  const periodTotals = totalsFromLedger({
    journals,
    lines: rawLines,
    from,
    to,
    excludeSources: [...PNL_EXCLUDED_SOURCES],
  });
  const coverage = ledgerCoverageWarning({
    totals: periodTotals.rows,
    accounts: (accountsRaw || []).map((account) => ({
      id: Number(account.id),
      code: String(account.code || ''),
      name: String(account.name || ''),
      account_type: String(account.account_type || ''),
      is_header: Boolean(account.is_header),
    })),
  });
  const warning = [ledger.warning, coverage].filter(Boolean).join(' ') || undefined;

  const months: MgmtPackMonth[] = trendKeys.map((key) => {
    const map = monthByAcct.get(key) || new Map();
    let rev = 0;
    let cg = 0;
    let ex = 0;
    for (const [aid, t] of map) {
      const a = acctById.get(aid);
      if (!a) continue;
      const type = a.account_type;
      const amount = signedPnl(type, t.debit, t.credit);
      if (isRevenueType(type)) rev += amount;
      else if (isCogsType(type)) cg += amount;
      else if (isExpenseType(type)) ex += amount;
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
    warning,
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
