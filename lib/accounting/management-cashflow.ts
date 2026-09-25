/**
 * Management cash flow: imported bank lines (signed +in / −out) versus the
 * 12-month P&L budget treated as a cash plan (revenue ≈ receipts, costs ≈ payments).
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { getOrCreateSettings, round2 } from '@/lib/accounting/server';
import { MONTH_SHORT } from '@/lib/accounting/fiscal';
import {
  dateToBudgetPeriod,
  fiscalYearsInDateRange,
} from '@/lib/accounting/budget';
import {
  planOperatingCashFromBudgetRows,
  type BudgetPlanRow,
} from '@/lib/accounting/cash-flow-budget';
import { monthsInRange } from '@/lib/accounting/cash-flow-ias7';
import { getCachedCoa } from '@/lib/accounting/read-cache';

export type BankCashLine = {
  id?: string | number | null;
  date: string;
  amount: number;
  description?: string | null;
  /** Saved explanation on the bank line (`bank_transactions.notes`). */
  comment?: string | null;
  gl_account_id?: number | null;
  allocation_status?: string | null;
  status?: string | null;
};

export type CashAccountRef = {
  id: number;
  code: string;
  name: string;
  account_type: string;
};

export type ManagementCashMonth = {
  month: string;
  label: string;
  actualIn: number;
  actualOut: number;
  actualNet: number;
  budgetIn: number;
  budgetOut: number;
  budgetNet: number;
  variance: number;
};

export type ManagementCashAccount = {
  account_id: number | null;
  code: string;
  name: string;
  account_type: string;
  actualIn: number;
  actualOut: number;
  actualNet: number;
  budgetIn: number;
  budgetOut: number;
  budgetNet: number;
  variance: number;
  /** More cash than the plan, or the same. */
  favourable: boolean;
};

export type ManagementCashTxn = {
  id: string;
  date: string;
  description: string;
  amount: number;
  inflow: number;
  outflow: number;
  account_id: number | null;
  code: string;
  name: string;
  comment: string;
};

export type ManagementCashflow = {
  from: string;
  to: string;
  currency: string;
  txnCount: number;
  excludedCount: number;
  unallocatedCount: number;
  actualIn: number;
  actualOut: number;
  actualNet: number;
  budgetIn: number;
  budgetOut: number;
  budgetNet: number;
  variance: number;
  favourable: boolean;
  budgetSet: boolean;
  note: string;
  months: ManagementCashMonth[];
  accounts: ManagementCashAccount[];
  /** Included bank lines, newest commentary lives on each transaction. */
  transactions: ManagementCashTxn[];
  warning?: string;
};

const COMMENT_MAX = 2000;

export function normalizeCashComment(raw: unknown): string {
  return String(raw ?? '')
    .replace(/\r\n/g, '\n')
    .trim()
    .slice(0, COMMENT_MAX);
}

/** Bank transaction ids are integers in new books and UUIDs in older ones. */
export function parseBankTxnId(raw: unknown): string | null {
  const id = String(raw ?? '').trim();
  if (!id || id.length > 80) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(id)) return null;
  return id;
}

const PAGE = 1000;
const CAP = 20_000;

export function isExcludedBankLine(line: Pick<BankCashLine, 'status' | 'allocation_status'>): boolean {
  const status = String(line.status || '').toLowerCase();
  const allocation = String(line.allocation_status || '').toLowerCase();
  return status === 'excluded' || status === 'void' || allocation === 'excluded';
}

function monthLabel(ym: string): string {
  const m = Number(ym.slice(5, 7));
  const y = ym.slice(0, 4);
  const name = MONTH_SHORT[m - 1] || ym;
  return `${name} ${y}`;
}

function budgetCashForRow(
  row: BudgetPlanRow,
  from: string,
  to: string,
  fyStartMonth: number
): { inflow: number; outflow: number } {
  let inflow = 0;
  let outflow = 0;
  const kind = String(row.account_type || '').toLowerCase();
  for (const month of monthsInRange(from, to)) {
    const mapped = dateToBudgetPeriod(`${month}-01`, fyStartMonth);
    if (mapped.fiscalYear !== row.fiscal_year) continue;
    const amt = Number(row.months[mapped.monthKey] || 0);
    if (!(amt > 0)) continue;
    if (kind === 'revenue') inflow += amt;
    else if (kind === 'expense' || kind === 'cogs') outflow += amt;
  }
  return { inflow: round2(inflow), outflow: round2(outflow) };
}

export function assembleManagementCashflow(opts: {
  from: string;
  to: string;
  fyStartMonth: number;
  currency?: string | null;
  lines: BankCashLine[];
  budgetRows: BudgetPlanRow[];
  accounts: CashAccountRef[];
  truncated?: boolean;
  warning?: string | null;
}): ManagementCashflow {
  const from = opts.from.slice(0, 10);
  const to = opts.to.slice(0, 10);
  const plan = planOperatingCashFromBudgetRows({
    rows: opts.budgetRows,
    from,
    to,
    fyStartMonth: opts.fyStartMonth,
  });
  const planByMonth = new Map(plan.months.map((m) => [m.month, m]));
  const accountById = new Map(opts.accounts.map((a) => [a.id, a]));

  const actualByMonth = new Map<string, { inflow: number; outflow: number }>();
  const actualByAccount = new Map<number | null, { inflow: number; outflow: number; count: number }>();
  const transactions: ManagementCashTxn[] = [];
  let txnCount = 0;
  let excludedCount = 0;
  let unallocatedCount = 0;

  for (const line of opts.lines) {
    if (isExcludedBankLine(line)) {
      excludedCount += 1;
      continue;
    }
    const date = String(line.date || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < from || date > to) continue;
    const amount = Number(line.amount || 0);
    if (!Number.isFinite(amount) || Math.abs(amount) < 0.005) continue;
    const inflow = amount > 0 ? amount : 0;
    const outflow = amount < 0 ? -amount : 0;
    const month = date.slice(0, 7);
    const bucket = actualByMonth.get(month) || { inflow: 0, outflow: 0 };
    bucket.inflow += inflow;
    bucket.outflow += outflow;
    actualByMonth.set(month, bucket);

    const gl = line.gl_account_id != null ? Number(line.gl_account_id) : NaN;
    const key = Number.isFinite(gl) && gl > 0 ? gl : null;
    if (key == null) unallocatedCount += 1;
    const acct = actualByAccount.get(key) || { inflow: 0, outflow: 0, count: 0 };
    acct.inflow += inflow;
    acct.outflow += outflow;
    acct.count += 1;
    actualByAccount.set(key, acct);
    txnCount += 1;
    const id = parseBankTxnId(line.id);
    if (id) {
      const ref = key != null ? accountById.get(key) : undefined;
      transactions.push({
        id,
        date,
        description: String(line.description || '').trim(),
        amount: round2(amount),
        inflow: round2(inflow),
        outflow: round2(outflow),
        account_id: key,
        code: ref?.code || '',
        name: key == null ? 'Unallocated' : ref?.name || `Account #${key}`,
        comment: normalizeCashComment(line.comment),
      });
    }
  }
  transactions.sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)
  );

  const months: ManagementCashMonth[] = monthsInRange(from, to).map((month) => {
    const actual = actualByMonth.get(month) || { inflow: 0, outflow: 0 };
    const budget = planByMonth.get(month) || { inflow: 0, outflow: 0, net: 0 };
    const actualIn = round2(actual.inflow);
    const actualOut = round2(actual.outflow);
    const actualNet = round2(actualIn - actualOut);
    const budgetIn = round2(budget.inflow);
    const budgetOut = round2(budget.outflow);
    const budgetNet = round2(budgetIn - budgetOut);
    return {
      month,
      label: monthLabel(month),
      actualIn,
      actualOut,
      actualNet,
      budgetIn,
      budgetOut,
      budgetNet,
      variance: round2(actualNet - budgetNet),
    };
  });

  const budgetByAccount = new Map<number, { inflow: number; outflow: number; type: string }>();
  for (const row of opts.budgetRows) {
    const cash = budgetCashForRow(row, from, to, opts.fyStartMonth);
    if (cash.inflow < 0.005 && cash.outflow < 0.005) continue;
    const cur = budgetByAccount.get(row.account_id) || {
      inflow: 0,
      outflow: 0,
      type: row.account_type,
    };
    cur.inflow += cash.inflow;
    cur.outflow += cash.outflow;
    budgetByAccount.set(row.account_id, cur);
  }

  const ids = new Set<number | null>([
    ...actualByAccount.keys(),
    ...budgetByAccount.keys(),
  ]);
  const accounts: ManagementCashAccount[] = [];
  for (const id of ids) {
    const actual = actualByAccount.get(id) || { inflow: 0, outflow: 0, count: 0 };
    const budget = id != null ? budgetByAccount.get(id) : undefined;
    const ref = id != null ? accountById.get(id) : undefined;
    const actualIn = round2(actual.inflow);
    const actualOut = round2(actual.outflow);
    const actualNet = round2(actualIn - actualOut);
    const budgetIn = round2(budget?.inflow || 0);
    const budgetOut = round2(budget?.outflow || 0);
    const budgetNet = round2(budgetIn - budgetOut);
    const variance = round2(actualNet - budgetNet);
    if (
      Math.abs(actualNet) < 0.005 &&
      Math.abs(budgetNet) < 0.005 &&
      actualIn < 0.005 &&
      actualOut < 0.005
    ) {
      continue;
    }
    accounts.push({
      account_id: id,
      code: id == null ? '' : ref?.code || '',
      name: id == null ? 'Unallocated bank lines' : ref?.name || `Account #${id}`,
      account_type: id == null ? '' : ref?.account_type || budget?.type || '',
      actualIn,
      actualOut,
      actualNet,
      budgetIn,
      budgetOut,
      budgetNet,
      variance,
      favourable: variance >= -0.005,
    });
  }
  accounts.sort((a, b) => {
    if (a.account_id == null) return -1;
    if (b.account_id == null) return 1;
    const byVar = Math.abs(b.variance) - Math.abs(a.variance);
    if (Math.abs(byVar) > 0.005) return byVar;
    return a.code.localeCompare(b.code);
  });

  const actualIn = round2(months.reduce((s, m) => s + m.actualIn, 0));
  const actualOut = round2(months.reduce((s, m) => s + m.actualOut, 0));
  const actualNet = round2(actualIn - actualOut);
  const variance = round2(actualNet - plan.netOperating);
  const notes = [
    'Actual cash is imported bank lines (money in is positive, money out is negative). Excluded lines are left out. Transfers between your own accounts net off when both sides are in the feed.',
    plan.set
      ? 'Budget is the 12-month chart plan for this period: revenue as receipts, expenses and cost of sales as payments. Collections and payment timing can differ from when income and costs are recognised.'
      : 'No budget amounts fall in this period. Enter a 12-month plan to compare.',
  ];
  if (opts.truncated) {
    notes.push(`Showing the first ${CAP.toLocaleString('en-ZA')} bank lines in this period.`);
  }

  return {
    from,
    to,
    currency: opts.currency || 'ZAR',
    txnCount,
    excludedCount,
    unallocatedCount,
    actualIn,
    actualOut,
    actualNet,
    budgetIn: plan.operatingInflow,
    budgetOut: plan.operatingOutflow,
    budgetNet: plan.netOperating,
    variance,
    favourable: variance >= -0.005,
    budgetSet: plan.set,
    note: notes.join(' '),
    months,
    accounts,
    transactions,
    warning: opts.warning || undefined,
  };
}

async function fetchBankCashLines(opts: {
  profileId: number;
  from: string;
  to: string;
}): Promise<{ lines: BankCashLine[]; warning?: string; truncated: boolean }> {
  const supabase = getSupabaseServer();
  const lines: BankCashLine[] = [];
  let offset = 0;
  let warning: string | undefined;
  let columns =
    'id, txn_date, amount, description, notes, gl_account_id, allocation_status, status';
  while (offset < CAP) {
    const { data, error } = await supabase
      .from('bank_transactions')
      .select(columns)
      .eq('profile_id', opts.profileId)
      .gte('txn_date', opts.from)
      .lte('txn_date', opts.to)
      .order('txn_date', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) {
      if (/notes|42703|column/i.test(error.message) && columns.includes('notes')) {
        columns =
          'id, txn_date, amount, description, gl_account_id, allocation_status, status';
        warning =
          'Bank comments are not available until the notes column is on bank transactions.';
        continue;
      }
      warning = error.message;
      break;
    }
    const page = data || [];
    for (const row of page) {
      lines.push({
        id: row.id != null ? String(row.id) : null,
        date: String(row.txn_date || '').slice(0, 10),
        amount: Number(row.amount || 0),
        description: row.description != null ? String(row.description) : null,
        comment:
          'notes' in row && row.notes != null ? String(row.notes) : null,
        gl_account_id: row.gl_account_id != null ? Number(row.gl_account_id) : null,
        allocation_status: row.allocation_status != null ? String(row.allocation_status) : null,
        status: row.status != null ? String(row.status) : null,
      });
    }
    if (page.length < PAGE) {
      return { lines, warning, truncated: false };
    }
    offset += PAGE;
  }
  return { lines, warning, truncated: lines.length >= CAP };
}

async function loadBudgetRows(profileId: number, from: string, to: string, fyStartMonth: number): Promise<BudgetPlanRow[]> {
  const years = fiscalYearsInDateRange(from, to, fyStartMonth);
  if (!years.length) return [];
  const supabase = getSupabaseServer();
  const { data: budgets, error } = await supabase
    .from('accounting_budgets')
    .select('account_id, fiscal_year, m01, m02, m03, m04, m05, m06, m07, m08, m09, m10, m11, m12')
    .eq('profile_id', profileId)
    .in('fiscal_year', years);
  if (error || !budgets?.length) return [];
  const accounts = await getCachedCoa(profileId);
  const typeById = new Map(
    accounts.map((a) => [Number(a.id), String(a.account_type || '')])
  );
  const rows: BudgetPlanRow[] = [];
  for (const b of budgets) {
    const account_id = Number(b.account_id);
    const account_type = typeById.get(account_id) || '';
    if (!account_type) continue;
    rows.push({
      account_id,
      account_type,
      fiscal_year: Number(b.fiscal_year),
      months: {
        m01: Number(b.m01 || 0),
        m02: Number(b.m02 || 0),
        m03: Number(b.m03 || 0),
        m04: Number(b.m04 || 0),
        m05: Number(b.m05 || 0),
        m06: Number(b.m06 || 0),
        m07: Number(b.m07 || 0),
        m08: Number(b.m08 || 0),
        m09: Number(b.m09 || 0),
        m10: Number(b.m10 || 0),
        m11: Number(b.m11 || 0),
        m12: Number(b.m12 || 0),
      },
    });
  }
  return rows;
}

export async function buildManagementCashflow(opts: {
  profileId: number;
  from: string;
  to: string;
}): Promise<ManagementCashflow> {
  const from = String(opts.from).slice(0, 10);
  const to = String(opts.to).slice(0, 10);
  const settings = await getOrCreateSettings(opts.profileId);
  const fyStartMonth = Number(settings.fiscal_year_start_month || 3);
  const [bank, budgetRows, coa] = await Promise.all([
    fetchBankCashLines({ profileId: opts.profileId, from, to }),
    loadBudgetRows(opts.profileId, from, to, fyStartMonth),
    getCachedCoa(opts.profileId),
  ]);
  return assembleManagementCashflow({
    from,
    to,
    fyStartMonth,
    currency: settings.base_currency,
    lines: bank.lines,
    budgetRows,
    accounts: coa.map((a) => ({
      id: Number(a.id),
      code: String(a.code || ''),
      name: String(a.name || ''),
      account_type: String(a.account_type || ''),
    })),
    truncated: bank.truncated,
    warning: bank.warning,
  });
}

export async function saveBankCashComment(opts: {
  profileId: number;
  txnId: string;
  comment: string;
}): Promise<{ ok: true; comment: string } | { ok: false; error: string }> {
  const comment = normalizeCashComment(opts.comment);
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('bank_transactions')
    .update({
      notes: comment || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', opts.txnId)
    .eq('profile_id', opts.profileId)
    .select('id')
    .maybeSingle();
  if (error) {
    return { ok: false, error: error.message };
  }
  if (!data) {
    return { ok: false, error: 'Transaction not found' };
  }
  return { ok: true, comment };
}
