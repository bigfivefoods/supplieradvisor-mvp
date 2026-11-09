/**
 * Run: npx --yes tsx lib/accounting/ledger-reports.test.ts
 *
 * In-memory ledger only. The service-role key is removed before any read so
 * this file cannot open the production database, including company 102.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { capPoCogsAmount, settlementExceedsInvoice, sumSettlementDebits } from './ledger-guards';
import { loadPostedLedger, totalsFromLedger } from './posted-ledger';
import {
  debitCreditMap,
  ledgerCoverageWarning,
  pnlAccountLines,
  postingAccounts,
  statementPosition,
  statementProfit,
} from './statement-figures';

delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.SUPABASE_URL;
delete process.env.NEXT_PUBLIC_SUPABASE_URL;

type Row = Record<string, unknown>;

function cappedClient(tables: Record<string, Row[]>, cap = 1000) {
  return {
    from(table: string) {
      let rows = (tables[table] || []).map((row) => ({ ...row }));
      const orders: Array<{ col: string; asc: boolean }> = [];
      let ranged = false;
      let rangeFrom = 0;
      let rangeTo = 0;
      const query = {
        select() {
          return query;
        },
        eq(col: string, value: unknown) {
          rows = rows.filter((row) => String(row[col]) === String(value));
          return query;
        },
        gte(col: string, value: unknown) {
          rows = rows.filter((row) => String(row[col]) >= String(value));
          return query;
        },
        lte(col: string, value: unknown) {
          rows = rows.filter((row) => String(row[col]) <= String(value));
          return query;
        },
        in(col: string, values: unknown[]) {
          const allowed = new Set(values.map((value) => String(value)));
          rows = rows.filter((row) => allowed.has(String(row[col])));
          return query;
        },
        order(col: string, opts?: { ascending?: boolean }) {
          orders.push({ col, asc: opts?.ascending !== false });
          return query;
        },
        range(from: number, to: number) {
          ranged = true;
          rangeFrom = from;
          rangeTo = to;
          return query;
        },
        then(
          onFulfilled?: (value: { data: Row[]; error: null }) => unknown,
          onRejected?: (reason: unknown) => unknown
        ) {
          return Promise.resolve(query.exec()).then(onFulfilled, onRejected);
        },
        exec() {
          const sorted = [...rows].sort((left, right) => {
            for (const order of orders) {
              const cmp = String(left[order.col]).localeCompare(
                String(right[order.col]),
                undefined,
                { numeric: true }
              );
              if (cmp !== 0) return order.asc ? cmp : -cmp;
            }
            return 0;
          });
          const page = ranged
            ? sorted.slice(rangeFrom, rangeTo + 1)
            : sorted.slice(0, cap);
          return { data: page, error: null as null };
        },
      };
      return query;
    },
  };
}

const accounts = [
  { id: 1, code: '1110', name: 'Bank', account_type: 'asset' },
  { id: 2, code: '1180-0000033', name: 'Palm Footwear', account_type: 'asset' },
  { id: 3, code: '1180-0000318', name: 'Ballito Village', account_type: 'asset' },
  { id: 4, code: '2180-0000012', name: 'Kelpack', account_type: 'liability' },
  { id: 5, code: '4400-0000007', name: 'Member fees', account_type: 'revenue' },
  { id: 6, code: '3100', name: 'Share capital', account_type: 'equity' },
  { id: 7, code: '4100', name: 'Sales', account_type: 'revenue' },
  { id: 8, code: '5100', name: 'Cost of sales', account_type: 'cogs' },
  { id: 9, code: '6100', name: 'Rent', account_type: 'expense' },
  { id: 10, code: '1180', name: 'Trade receivables', account_type: 'asset', is_header: true },
];

type Journal = { id: number; entry_date: string; source: string; status: string; profile_id: number };
type Line = {
  journal_entry_id: number;
  account_id: number;
  debit: number;
  credit: number;
  profile_id: number;
};

const journals: Journal[] = [];
const lines: Line[] = [];

function addJournal(
  id: number,
  entryDate: string,
  source: string,
  legs: Array<[number, number, number]>
) {
  const debit = legs.reduce((sum, leg) => sum + leg[1], 0);
  const credit = legs.reduce((sum, leg) => sum + leg[2], 0);
  assert.equal(debit, credit, `journal ${id} does not balance`);
  journals.push({
    id,
    entry_date: entryDate,
    source,
    status: 'posted',
    profile_id: 102,
  });
  for (const [accountId, dr, cr] of legs) {
    lines.push({
      journal_entry_id: id,
      account_id: accountId,
      debit: dr,
      credit: cr,
      profile_id: 102,
    });
  }
}

for (let id = 1; id <= 52; id += 1) {
  addJournal(id, '2026-03-02', 'manual', [[1, 100, 0], [7, 0, 100]]);
}
for (let id = 53; id <= 1040; id += 1) {
  addJournal(id, '2026-06-15', 'manual', [[9, 10, 0], [1, 0, 10]]);
}
addJournal(1041, '2026-06-16', 'manual', [[3, 5290, 0], [7, 0, 5290]]);
addJournal(1042, '2026-06-16', 'manual', [[1, 123682.5, 0], [2, 0, 123682.5]]);
addJournal(1043, '2026-06-16', 'manual', [[8, 63648, 0], [4, 0, 63648]]);
addJournal(1044, '2026-06-16', 'manual', [[1, 15, 0], [5, 0, 15]]);
for (let id = 1045; id <= 1052; id += 1) {
  addJournal(id, '2026-06-16', 'manual', [[9, 1, 0], [1, 0, 1]]);
}
addJournal(1053, '2026-06-20', 'year_end_close', [[7, 100, 0], [9, 0, 100]]);

assert.ok(journals.length > 1000);
assert.equal(lines.length, journals.length * 2);

async function main() {
const client = cappedClient({
  journal_entries: journals,
  journal_lines: lines,
});

const unpaged = await client
  .from('journal_entries')
  .select('id, entry_date')
  .eq('profile_id', 102)
  .eq('status', 'posted')
  .order('entry_date', { ascending: false })
  .order('id', { ascending: false });
assert.equal(unpaged.data.length, 1000);
assert.equal(
  unpaged.data.some((row) => Number(row.id) === 1),
  false
);

const loaded = await loadPostedLedger({
  profileId: 102,
  includeLines: true,
  journalColumns: 'core',
  lineColumns: 'amounts',
  client,
});
assert.equal(loaded.journals.length, journals.length);
assert.equal(loaded.lines.length, lines.length);
assert.equal(loaded.warning, undefined);
assert.equal(
  loaded.journals.some((journal) => journal.id === 1),
  true
);

const from = '2026-03-01';
const to = '2026-11-09';
const asAt = totalsFromLedger({ journals: loaded.journals, lines: loaded.lines, to });
const period = totalsFromLedger({
  journals: loaded.journals,
  lines: loaded.lines,
  from,
  to,
  excludeSources: ['year_end_close', 'year-end'],
});
const faces = postingAccounts(accounts);
const asAtMap = debitCreditMap(asAt.rows);
const periodMap = debitCreditMap(period.rows);

const afsPosition = statementPosition(faces, asAtMap);
const balanceSheet = statementPosition(faces, asAtMap);
const afsProfit = statementProfit(faces, periodMap);
const managementPage = pnlAccountLines(faces, periodMap);
const managementPdf = pnlAccountLines(faces, periodMap);

assert.deepEqual(afsPosition, balanceSheet);
assert.equal(afsPosition.balanced, true);
assert.deepEqual(
  {
    revenue: afsProfit.revenue,
    cogs: afsProfit.cogs,
    expenses: afsProfit.expenses,
    netIncome: afsProfit.netIncome,
  },
  {
    revenue: managementPage.revenue,
    cogs: managementPage.cogs,
    expenses: managementPage.expenses,
    netIncome: managementPage.netIncome,
  }
);
assert.deepEqual(
  {
    revenue: managementPage.revenue,
    cogs: managementPage.cogs,
    expenses: managementPage.expenses,
    netIncome: managementPage.netIncome,
  },
  {
    revenue: managementPdf.revenue,
    cogs: managementPdf.cogs,
    expenses: managementPdf.expenses,
    netIncome: managementPdf.netIncome,
  }
);
assert.equal(
  roundSum(managementPage.income.map((line) => line.amount)),
  managementPage.revenue
);
assert.equal(
  roundSum(managementPage.expenseLines.map((line) => line.amount)),
  managementPage.expenses
);

const droppedLeaves = faces.filter(
  (account) => !/^(1180|2180|4400)-/.test(String(account.code || ''))
);
const withoutLeaves = statementPosition(droppedLeaves, asAtMap);
assert.equal(withoutLeaves.balanced, false);
assert.notEqual(withoutLeaves.assets, afsPosition.assets);
assert.notEqual(withoutLeaves.liabilities, afsPosition.liabilities);

const unpagedIds = new Set(unpaged.data.map((row) => Number(row.id)));
const unpagedProfit = statementProfit(
  faces,
  debitCreditMap(
    totalsFromLedger({
      journals: loaded.journals.filter((journal) => unpagedIds.has(journal.id)),
      lines: loaded.lines.filter((line) => unpagedIds.has(line.journal_entry_id)),
      from,
      to,
      excludeSources: ['year_end_close', 'year-end'],
    }).rows
  )
);
assert.notEqual(unpagedProfit.revenue, afsProfit.revenue);

assert.equal(asAt.total_debit, asAt.total_credit);
assert.equal(asAt.entry_count, journals.length);
assert.equal(period.entry_count, journals.length - 1);

const quiet = ledgerCoverageWarning({ totals: asAt.rows, accounts });
assert.equal(quiet, undefined);

const unclassified = ledgerCoverageWarning({
  totals: [
    { account_id: 2, debit: 0, credit: 50 },
    { account_id: 77, debit: 10, credit: 0 },
    { account_id: 10, debit: 5, credit: 0 },
  ],
  accounts: [
    ...accounts,
    { id: 77, code: '9990', name: 'Suspense', account_type: '' },
  ],
});
assert.match(unclassified || '', /SupplierAdvisor®/);
assert.match(unclassified || '', /9990 \(unclassified\)/);
assert.match(unclassified || '', /#77|9990/);
assert.match(unclassified || '', /1180 \(header\)/);
assert.doesNotMatch(unclassified || '', /1180-0000033/);

const relief: number[] = [];
let relieved = 0;
for (let invoice = 0; invoice < 5; invoice += 1) {
  const amount = capPoCogsAmount({
    poCost: 63648,
    alreadyRelieved: relieved,
    requested: 63648,
  });
  relief.push(amount);
  relieved = Math.round((relieved + amount) * 100) / 100;
}
assert.deepEqual(relief, [63648, 0, 0, 0, 0]);
assert.equal(relieved, 63648);
assert.equal(
  capPoCogsAmount({ poCost: 63648, alreadyRelieved: 63648, requested: 63648 }),
  0
);
assert.equal(
  capPoCogsAmount({ poCost: 100, alreadyRelieved: 40, requested: 80 }),
  60
);

const palm = settlementExceedsInvoice({
  invoiceTotal: 31050,
  settledToDate: sumSettlementDebits([{ debit: 31050 }]),
  amount: 31050,
});
assert.equal(palm.blocked, true);
assert.match(palm.message || '', /SupplierAdvisor®/);
assert.match(palm.message || '', /outstanding/);
assert.equal(palm.outstanding, 0);

const exact = settlementExceedsInvoice({
  invoiceTotal: 100,
  settledToDate: 40,
  amount: 60,
});
assert.equal(exact.blocked, false);
const centOver = settlementExceedsInvoice({
  invoiceTotal: 100,
  settledToDate: 40,
  amount: 60.02,
});
assert.equal(centOver.blocked, true);
assert.equal(
  settlementExceedsInvoice({ invoiceTotal: 0, settledToDate: 0, amount: 10 }).blocked,
  false
);

const root = process.cwd();
const source = (path: string) => readFileSync(join(root, path), 'utf8');
const afs = source('lib/accounting/afs.ts');
const route = source('app/api/accounting/reports/route.ts');
const pack = source('lib/accounting/management-pack.ts');
const totals = source('lib/accounting/account-totals.ts');
assert.match(afs, /loadPostedLedger/);
assert.match(afs, /statementPosition/);
assert.match(afs, /statementProfit/);
assert.doesNotMatch(afs, /1180\|2180\|4400/);
assert.match(pack, /loadPostedLedger/);
assert.match(pack, /pnlAccountLines/);
assert.match(route, /loadPostedLedger/);
assert.match(route, /pnlAccountLines/);
assert.match(route, /statementPosition/);
assert.match(totals, /loadPostedLedger/);
assert.doesNotMatch(totals, /\.rpc\(\s*['"]sa_account_totals/);
assert.match(source('lib/accounting/po-accept-books.ts'), /capPoCogsAmount/);
assert.match(source('lib/accounting/invoice-gl.ts'), /settlementExceedsInvoice/);
assert.match(source('app/api/accounting/payments/route.ts'), /settlementExceedsInvoice/);

console.log(
  JSON.stringify(
    {
      journals: loaded.journals.length,
      lines: loaded.lines.length,
      trialDebit: asAt.total_debit,
      trialCredit: asAt.total_credit,
      assets: afsPosition.assets,
      liabilities: afsPosition.liabilities,
      equity: afsPosition.equity,
      balanced: afsPosition.balanced,
      revenue: afsProfit.revenue,
      cogs: afsProfit.cogs,
      expenses: afsProfit.expenses,
      netIncome: afsProfit.netIncome,
      unpagedRevenue: unpagedProfit.revenue,
      withoutLeafAssets: withoutLeaves.assets,
      withoutLeafLiabilities: withoutLeaves.liabilities,
    },
    null,
    2
  )
);
console.log('ledger report agreement tests ok');
}

function roundSum(values: number[]): number {
  return Math.round(values.reduce((sum, value) => sum + value, 0) * 100) / 100;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
