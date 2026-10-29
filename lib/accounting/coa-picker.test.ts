/**
 * GL pickers must not drop accounts past the old default of 50 or past COA_LIST_MAX.
 * Run: npx --yes tsx lib/accounting/coa-picker.test.ts
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  COA_LIST_DEFAULT,
  COA_LIST_MAX,
  COA_PICKER_SELECT,
  collectCoaPages,
  filterOperatingCoa,
  parseCoaPickerLimit,
  sliceCoaList,
  type CoaListRow,
} from './coa-list';
import { fetchAllChartOfAccounts } from './fetch-chart-accounts';

type FixtureAccount = CoaListRow & { id: number };

function bankChargesChart(count: number): FixtureAccount[] {
  assert.ok(count > 1);
  const rows: FixtureAccount[] = [];
  for (let i = 0; i < count - 1; i += 1) {
    rows.push({
      id: i + 1,
      code: String(8000 + i),
      name: `Operating ${i + 1}`,
      account_type: 'expense',
      is_header: false,
      is_active: true,
    });
  }
  rows.push({
    id: count,
    code: '6900',
    name: 'Bank charges',
    account_type: 'expense',
    is_header: false,
    is_active: true,
  });
  return rows;
}

function assertBankChargesPresent(rows: Array<{ code?: string | null; name?: string | null }>) {
  const hit = rows.find((row) => row.code === '6900');
  assert.ok(hit, '6900 Bank charges missing from picker rows');
  assert.equal(hit?.name, 'Bank charges');
  assert.equal((hit as FixtureAccount).account_type, 'expense');
  assert.equal((hit as FixtureAccount).is_header, false);
  assert.equal((hit as FixtureAccount).is_active, true);
}

const over50 = filterOperatingCoa(bankChargesChart(60), {});
assert.equal(over50.length, 60);
assertBankChargesPresent(over50);

const silent50 = sliceCoaList(over50, { limit: COA_LIST_DEFAULT, offset: 0 });
assert.equal(silent50.hasMore, true);
assert.equal(silent50.total, 60);
assert.equal(silent50.rows.some((row) => row.code === '6900'), false);

const pagedAtOldDefault = collectCoaPages(over50, COA_LIST_DEFAULT);
assert.equal(pagedAtOldDefault.truncated, false);
assert.equal(pagedAtOldDefault.rows.length, 60);
assert.ok(pagedAtOldDefault.pages > 1);
assertBankChargesPresent(pagedAtOldDefault.rows);

const unlimited = sliceCoaList(over50, { limit: null, offset: 0 });
assert.equal(unlimited.hasMore, false);
assert.equal(unlimited.limit, null);
assertBankChargesPresent(unlimited.rows);

const overMaxCount = COA_LIST_MAX + 25;
const overMax = filterOperatingCoa(bankChargesChart(overMaxCount), {});
assert.equal(overMax.length, overMaxCount);
const firstMaxPage = sliceCoaList(overMax, { limit: COA_LIST_MAX, offset: 0 });
assert.equal(firstMaxPage.hasMore, true);
assert.equal(firstMaxPage.total, overMaxCount);
assert.equal(firstMaxPage.rows.some((row) => row.code === '6900'), false);
const pagedPastMax = collectCoaPages(overMax, COA_LIST_MAX);
assert.equal(pagedPastMax.truncated, false);
assert.equal(pagedPastMax.pages, 2);
assert.equal(pagedPastMax.rows.length, overMaxCount);
assertBankChargesPresent(pagedPastMax.rows);

const wholeChart = sliceCoaList(overMax, { limit: null, offset: 0 });
assert.equal(wholeChart.hasMore, false);
assert.equal(wholeChart.rows.length, overMaxCount);
assertBankChargesPresent(wholeChart.rows);

assert.equal(parseCoaPickerLimit(null), COA_LIST_MAX);
assert.equal(parseCoaPickerLimit('50'), 50);
assert.notEqual(parseCoaPickerLimit(null), COA_LIST_DEFAULT);

function incomeExpenseOptions(rows: FixtureAccount[]) {
  return rows.filter(
    (account) =>
      !account.is_header &&
      account.is_active !== false &&
      ['revenue', 'expense', 'cogs'].includes(String(account.account_type))
  );
}

const grouped = incomeExpenseOptions(pagedPastMax.rows);
assert.ok(grouped.some((account) => account.code === '6900' && account.name === 'Bank charges'));

assert.doesNotMatch(COA_PICKER_SELECT, /description/);
assert.equal(
  COA_PICKER_SELECT.split(',').map((column) => column.trim()).includes('balance'),
  false
);
assert.doesNotMatch(COA_PICKER_SELECT, /\*/);
assert.match(COA_PICKER_SELECT, /\bsubtype\b/);
assert.match(COA_PICKER_SELECT, /\bcode\b/);

type MockInit = { status?: number; body: unknown };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

async function withFetch(
  impl: (url: URL, call: number) => MockInit | Promise<MockInit>,
  run: () => Promise<void>
) {
  const previous = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    calls += 1;
    const url = new URL(String(input), 'http://test.local');
    const next = await impl(url, calls);
    return jsonResponse(next.body, next.status ?? 200);
  }) as typeof fetch;
  try {
    await run();
  } finally {
    globalThis.fetch = previous;
  }
}

function serverPage(rows: FixtureAccount[], url: URL, pageSize: number) {
  const offset = Number(url.searchParams.get('offset') || 0);
  const page = sliceCoaList(rows, { limit: pageSize, offset });
  return {
    success: true,
    accounts: page.rows,
    total: page.total,
    limit: page.limit,
    offset: page.offset,
    hasMore: page.hasMore,
  };
}

void (async () => {
  await withFetch(
    (url) => {
      assert.equal(url.pathname, '/api/accounting/chart-of-accounts');
      assert.equal(url.searchParams.get('picker'), '1');
      assert.equal(url.searchParams.get('companyId'), '102');
      assert.equal(url.searchParams.get('balances'), null);
      assert.equal(url.searchParams.get('limit'), String(COA_LIST_MAX));
      return { body: serverPage(over50, url, COA_LIST_DEFAULT) };
    },
    async () => {
      const loaded = await fetchAllChartOfAccounts(
        new URLSearchParams({ companyId: '102', balances: '0' }),
        { picker: true }
      );
      assert.equal(loaded.truncated, false);
      assert.equal(loaded.accounts.length, 60);
      assertBankChargesPresent(loaded.accounts);
      assert.ok(
        incomeExpenseOptions(loaded.accounts).some((account) => account.code === '6900')
      );
    }
  );

  let seedCalls = 0;
  await withFetch(
    (url, call) => {
      seedCalls = call;
      assert.equal(url.searchParams.get('picker'), '1');
      if (call === 1) assert.equal(url.searchParams.get('seed'), '1');
      else assert.equal(url.searchParams.get('seed'), null);
      return {
        body: {
          ...serverPage(overMax, url, COA_LIST_MAX),
          seeded: call === 1 ? 0 : 99,
        },
      };
    },
    async () => {
      const loaded = await fetchAllChartOfAccounts(
        new URLSearchParams({ companyId: '102', seed: '1' }),
        { picker: true }
      );
      assert.equal(loaded.truncated, false);
      assert.equal(loaded.accounts.length, overMaxCount);
      assert.equal(loaded.seeded, 0);
      assertBankChargesPresent(loaded.accounts);
    }
  );
  assert.ok(seedCalls >= 2);

  await withFetch(
    (url, call) => {
      assert.equal(url.searchParams.get('picker'), null);
      assert.equal(url.searchParams.get('balances'), null);
      assert.equal(url.searchParams.get('from'), '2026-03-01');
      if (call === 1) {
        assert.equal(url.searchParams.get('limit'), null);
        return { body: serverPage(overMax, url, COA_LIST_MAX) };
      }
      assert.equal(url.searchParams.get('limit'), String(COA_LIST_MAX));
      return { body: serverPage(overMax, url, COA_LIST_MAX) };
    },
    async () => {
      const params = new URLSearchParams({
        companyId: '102',
        from: '2026-03-01',
        to: '2027-02-28',
        limit: '500',
      });
      const loaded = await fetchAllChartOfAccounts(params, { picker: false });
      assert.equal(loaded.truncated, false);
      assert.equal(loaded.accounts.length, overMaxCount);
      assertBankChargesPresent(loaded.accounts);
    }
  );
})().then(
  () => {
    console.log('coa-picker tests ok');
  },
  (err) => {
    console.error(err);
    process.exit(1);
  }
);

const inactive = filterOperatingCoa(
  [
    {
      id: 1,
      code: '6900',
      name: 'Bank charges',
      account_type: 'expense',
      is_header: false,
      is_active: false,
    },
  ],
  {}
);
assert.equal(inactive.some((row) => row.code === '6900'), false);

function src(rel: string) {
  return readFileSync(resolve(rel), 'utf8');
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === '.git') continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.test.ts')) out.push(path);
  }
  return out;
}

const listFetches: string[] = [];
for (const root of ['app', 'components', 'lib']) {
  for (const file of walk(root)) {
    const text = src(file);
    if (text.includes('/api/accounting/chart-of-accounts?')) listFetches.push(file);
  }
}
assert.deepEqual(
  listFetches.map((file) => file.replaceAll('\\', '/')).sort(),
  [
    'app/dashboard/accounting/chart-of-accounts/page.tsx',
    'lib/accounting/fetch-chart-accounts.ts',
  ]
);

const pickerPages = [
  'app/dashboard/accounting/bank-reconciliation/page.tsx',
  'app/dashboard/accounting/journal-entries/page.tsx',
  'app/dashboard/accounting/management-cashflow/page.tsx',
];
for (const file of pickerPages) {
  const text = src(file);
  assert.match(text, /fetchAllChartOfAccounts\(/, file);
  assert.match(text, /picker:\s*true/, file);
  assert.doesNotMatch(text, /\/api\/accounting\/chart-of-accounts\?/, file);
  assert.doesNotMatch(text, /balances=0/, file);
}

const bank = src('app/dashboard/accounting/bank-reconciliation/page.tsx');
assert.equal((bank.match(/fetchAllChartOfAccounts\(/g) || []).length, 2);
assert.match(bank, /AllocGlSelect/);

const chartPage = src('app/dashboard/accounting/chart-of-accounts/page.tsx');
assert.equal(
  (chartPage.match(/fetch\(`\/api\/accounting\/chart-of-accounts\?/g) || []).length,
  1
);
assert.match(chartPage, /fetchAllChartOfAccounts\(params,\s*\{\s*picker:\s*false\s*\}\)/);
assert.match(chartPage, /format:\s*'xlsx'|format=xlsx|format',\s*'xlsx'/);
assert.doesNotMatch(chartPage, /params\.set\(\s*'limit'/);
assert.match(chartPage, /listMeta\?\.truncated/);

const noListGet = [
  'app/dashboard/accounting/settings/page.tsx',
  'app/dashboard/accounting/accounts-payable/page.tsx',
  'app/dashboard/accounting/accounts-receivable/page.tsx',
  'app/dashboard/accounting/payments/page.tsx',
  'app/dashboard/accounting/budget/page.tsx',
  'app/dashboard/accounting/fixed-assets/page.tsx',
  'app/dashboard/accounting/tax/page.tsx',
  'app/dashboard/suppliers/po/PoDesk.tsx',
  'components/accounting/AllocGlSelect.tsx',
];
for (const file of noListGet) {
  assert.doesNotMatch(src(file), /\/api\/accounting\/chart-of-accounts\?/, file);
}

const settings = src('app/dashboard/accounting/settings/page.tsx');
assert.match(settings, /method:\s*'POST'/);
assert.match(settings, /ensure_party:\s*true/);
assert.match(src('app/api/accounting/settings/route.ts'), /getCachedCoa\(companyId\)/);
assert.match(src('app/api/accounting/budgets/route.ts'), /\.from\('chart_of_accounts'\)/);
assert.doesNotMatch(src('app/api/accounting/budgets/route.ts'), /parseCoaListLimit/);

const route = src('app/api/accounting/chart-of-accounts/route.ts').split(
  'export async function POST'
)[0];
assert.match(route, /getCachedCoaPicker/);
assert.match(route, /get\('picker'\) === '1'/);
assert.match(route, /!picker &&/);
assert.match(src('lib/accounting/read-cache.ts'), /COA_PICKER_SELECT/);
assert.match(src('lib/accounting/read-cache.ts'), /coaPickerKey/);

const alloc = src('components/accounting/AllocGlSelect.tsx');
assert.match(alloc, /a\.code/);
assert.match(alloc, /groupCoaForAllocation/);
assert.doesNotMatch(alloc, /fetch\(/);
