/**
 * One classification of a posted ledger into statement totals.
 * AFS, the balance sheet, management accounts (page and PDF) and the
 * trial balance all call these helpers so the same rows cannot produce
 * two different assets, liabilities or profit figures.
 */
import { round2 } from '@/lib/accounting/server';

export const REVENUE_TYPES = ['revenue', 'income', 'sales'] as const;
export const COGS_TYPES = ['cogs', 'cost_of_sales', 'cost_of_goods'] as const;
export const EXPENSE_TYPES = ['expense', 'expenses', 'opex'] as const;
export const PNL_EXCLUDED_SOURCES = new Set(['year_end_close', 'year-end']);

const REVENUE = new Set<string>(REVENUE_TYPES);
const COGS = new Set<string>(COGS_TYPES);
const EXPENSE = new Set<string>(EXPENSE_TYPES);
const STATEMENT_TYPES = new Set<string>([
  'asset',
  'liability',
  'equity',
  ...REVENUE_TYPES,
  ...COGS_TYPES,
  ...EXPENSE_TYPES,
]);

export type FigureAccount = {
  id: number;
  code?: string | null;
  name?: string | null;
  account_type?: string | null;
  is_header?: boolean | null;
};

export type DebitCredit = { debit: number; credit: number };

export function postingAccounts<T extends { is_header?: boolean | null }>(
  accounts: T[]
): T[] {
  return accounts.filter((a) => !a.is_header);
}

export function isRevenueType(type: string | null | undefined): boolean {
  return REVENUE.has(String(type || '').toLowerCase());
}

export function isCogsType(type: string | null | undefined): boolean {
  return COGS.has(String(type || '').toLowerCase());
}

export function isExpenseType(type: string | null | undefined): boolean {
  return EXPENSE.has(String(type || '').toLowerCase());
}

/** Asset / expense / cogs are debit-positive. Liability / equity / revenue are credit-positive. */
export function signedStatementAmount(
  type: string | null | undefined,
  debit: number,
  credit: number
): number {
  const t = String(type || '').toLowerCase();
  if (
    t === 'asset' ||
    EXPENSE.has(t) ||
    COGS.has(t)
  ) {
    return round2(debit - credit);
  }
  return round2(credit - debit);
}

export function debitCreditMap(
  rows: Array<{ account_id: number; debit: number; credit: number }>
): Map<number, DebitCredit> {
  const map = new Map<number, DebitCredit>();
  for (const row of rows) {
    map.set(Number(row.account_id), {
      debit: Number(row.debit || 0),
      credit: Number(row.credit || 0),
    });
  }
  return map;
}

export type ProfitTotals = {
  revenue: number;
  cogs: number;
  grossProfit: number;
  expenses: number;
  operatingProfit: number;
  netIncome: number;
};

export type PnlAccountLine = {
  id: number;
  code: string;
  name: string;
  amount: number;
};

export type PnlAccountLines = ProfitTotals & {
  income: PnlAccountLine[];
  cogsLines: PnlAccountLine[];
  expenseLines: PnlAccountLine[];
};

function amountOf(
  account: FigureAccount,
  map: Map<number, DebitCredit>
): number | null {
  if (account.is_header) return null;
  const totals = map.get(Number(account.id));
  if (!totals) return null;
  const type = String(account.account_type || '');
  if (!isRevenueType(type) && !isCogsType(type) && !isExpenseType(type)) {
    return null;
  }
  const amount = signedStatementAmount(type, totals.debit, totals.credit);
  if (Math.abs(amount) < 0.005) return null;
  return amount;
}

/** Period profit and the account lines that add up to it. */
export function pnlAccountLines(
  accounts: FigureAccount[],
  map: Map<number, DebitCredit>
): PnlAccountLines {
  const income: PnlAccountLine[] = [];
  const cogsLines: PnlAccountLine[] = [];
  const expenseLines: PnlAccountLine[] = [];
  for (const account of accounts) {
    const amount = amountOf(account, map);
    if (amount == null) continue;
    const line: PnlAccountLine = {
      id: Number(account.id),
      code: String(account.code || ''),
      name: String(account.name || ''),
      amount,
    };
    const type = String(account.account_type || '');
    if (isRevenueType(type)) income.push(line);
    else if (isCogsType(type)) cogsLines.push(line);
    else expenseLines.push(line);
  }
  const bySize = (a: PnlAccountLine, b: PnlAccountLine) =>
    Math.abs(b.amount) - Math.abs(a.amount);
  income.sort(bySize);
  cogsLines.sort(bySize);
  expenseLines.sort(bySize);
  const profit = statementProfit(accounts, map);
  return { ...profit, income, cogsLines, expenseLines };
}

export function statementProfit(
  accounts: FigureAccount[],
  map: Map<number, DebitCredit>
): ProfitTotals {
  let revenue = 0;
  let cogs = 0;
  let expenses = 0;
  for (const account of accounts) {
    const amount = amountOf(account, map);
    if (amount == null) continue;
    const type = String(account.account_type || '');
    if (isRevenueType(type)) revenue += amount;
    else if (isCogsType(type)) cogs += amount;
    else expenses += amount;
  }
  revenue = round2(revenue);
  cogs = round2(cogs);
  expenses = round2(expenses);
  const grossProfit = round2(revenue - cogs);
  const operatingProfit = round2(grossProfit - expenses);
  return {
    revenue,
    cogs,
    grossProfit,
    expenses,
    operatingProfit,
    netIncome: operatingProfit,
  };
}

export type PositionTotals = {
  assets: number;
  liabilities: number;
  equityBase: number;
  netIncome: number;
  equity: number;
  balanced: boolean;
};

/** Statement of financial position from an as-at debit/credit map. Profit is rolled into equity. */
export function statementPosition(
  accounts: FigureAccount[],
  map: Map<number, DebitCredit>
): PositionTotals {
  let assets = 0;
  let liabilities = 0;
  let equityBase = 0;
  for (const account of accounts) {
    if (account.is_header) continue;
    const totals = map.get(Number(account.id));
    if (!totals) continue;
    const type = String(account.account_type || '').toLowerCase();
    const amount = signedStatementAmount(type, totals.debit, totals.credit);
    if (type === 'asset') assets += amount;
    else if (type === 'liability') liabilities += amount;
    else if (type === 'equity') equityBase += amount;
  }
  assets = round2(assets);
  liabilities = round2(liabilities);
  equityBase = round2(equityBase);
  const netIncome = statementProfit(accounts, map).netIncome;
  const equity = round2(equityBase + netIncome);
  return {
    assets,
    liabilities,
    equityBase,
    netIncome,
    equity,
    balanced: Math.abs(assets - (liabilities + equity)) < 0.05,
  };
}

/**
 * Accounts with a balance that never reach a statement face.
 * Party leaves (1180-*, 2180-*, 4400-*) are on the statements when they
 * have a normal type — they must not be listed here.
 */
export function ledgerCoverageWarning(opts: {
  totals: Array<{ account_id: number; debit: number; credit: number; code?: string | null }>;
  accounts: FigureAccount[];
}): string | undefined {
  const byId = new Map(opts.accounts.map((account) => [Number(account.id), account]));
  const problems: string[] = [];
  for (const row of opts.totals) {
    if (Math.abs(Number(row.debit || 0) - Number(row.credit || 0)) < 0.005) continue;
    const account = byId.get(Number(row.account_id));
    if (!account) {
      problems.push(row.code || `#${row.account_id}`);
      continue;
    }
    if (account.is_header) {
      problems.push(`${account.code || account.id} (header)`);
      continue;
    }
    const type = String(account.account_type || '').toLowerCase();
    if (!STATEMENT_TYPES.has(type)) {
      problems.push(`${account.code || account.id} (unclassified)`);
    }
  }
  if (!problems.length) return undefined;
  const shown = problems.slice(0, 5).join(', ');
  const more = problems.length > 5 ? ` and ${problems.length - 5} more` : '';
  return `SupplierAdvisor® left ${problems.length} ledger account(s) with a balance off these statements (${shown}${more}). Check the account type or header flag so the statements stay in balance.`;
}
