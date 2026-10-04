/**
 * Run: npx --yes tsx lib/accounting/coa-slice.test.ts
 */
import assert from 'node:assert/strict';
import type * as XLSXType from 'xlsx';
import {
  filterCoaAccounts,
  parseIsoDateParam,
  rollupCoaByType,
  sliceCoaAccounts,
} from './coa-slice';
import { buildCoaWorkbook, coaExportFilename } from './coa-xlsx';
import type { CoaAccount } from './types';

assert.equal(parseIsoDateParam('2026-03-01'), '2026-03-01');
assert.equal(parseIsoDateParam('2026-03-01T00:00:00Z'), '2026-03-01');
assert.equal(parseIsoDateParam('2026-02-31'), null);
assert.equal(parseIsoDateParam(''), null);
assert.equal(parseIsoDateParam(null), null);

assert.equal(
  coaExportFilename('2026-03-01', '2027-02-28'),
  'chart-of-accounts-2026-03-01-to-2027-02-28.xlsx'
);
assert.equal(coaExportFilename(null, null), 'chart-of-accounts-all-posted.xlsx');

const accounts: CoaAccount[] = [
  {
    id: 1,
    code: '1000',
    name: 'Assets',
    account_type: 'asset',
    is_header: true,
    normal_balance: 'debit',
  },
  {
    id: 2,
    code: '1200',
    name: 'Bank',
    account_type: 'asset',
    parent_id: 1,
    subtype: 'current',
    normal_balance: 'debit',
  },
  {
    id: 3,
    code: '4000',
    name: 'Sales',
    account_type: 'revenue',
    normal_balance: 'credit',
  },
  {
    id: 4,
    code: '5000',
    name: 'Rent',
    account_type: 'expense',
    normal_balance: 'debit',
  },
];

const sliced = sliceCoaAccounts({
  accounts,
  opening: [
    { account_id: 2, debit: 1000, credit: 200 },
    { account_id: 3, debit: 0, credit: 500 },
  ],
  period: [
    { account_id: 2, debit: 400, credit: 50 },
    { account_id: 3, debit: 20, credit: 250 },
    { account_id: 4, debit: 80, credit: 0 },
  ],
});

const bank = sliced.find((row) => row.code === '1200');
assert.ok(bank);
assert.equal(bank.parent_code, '1000');
assert.equal(bank.opening_balance, 800);
assert.equal(bank.period_debit, 400);
assert.equal(bank.period_credit, 50);
assert.equal(bank.period_movement, 350);
assert.equal(bank.balance, 1150);

const sales = sliced.find((row) => row.code === '4000');
assert.ok(sales);
assert.equal(sales.opening_balance, 500);
assert.equal(sales.period_debit, 20);
assert.equal(sales.period_credit, 250);
assert.equal(sales.period_movement, 230);
assert.equal(sales.balance, 730);

const rent = sliced.find((row) => row.code === '5000');
assert.ok(rent);
assert.equal(rent.opening_balance, 0);
assert.equal(rent.balance, 80);
assert.equal(rent.period_movement, 80);

const header = sliced.find((row) => row.code === '1000');
assert.ok(header);
assert.equal(header.balance, 0);
assert.equal(header.period_debit, 0);

const revenueOnly = filterCoaAccounts(sliced, { type: 'revenue' });
assert.deepEqual(
  revenueOnly.map((row) => row.code),
  ['4000']
);
assert.equal(revenueOnly[0].parent_code, null);

const bankSearch = filterCoaAccounts(sliced, { q: 'bank' });
assert.equal(bankSearch.length, 1);
assert.equal(bankSearch[0].parent_code, '1000');

const rollup = rollupCoaByType(sliced);
assert.deepEqual(
  rollup.map((row) => row.account_type),
  ['asset', 'revenue', 'expense']
);
assert.equal(rollup[0].accounts, 1);
assert.equal(rollup[0].closing_balance, 1150);
assert.equal(rollup[1].period_credit, 250);
assert.equal(rollup[2].period_debit, 80);

const bytes = buildCoaWorkbook({
  companyName: 'VUKA',
  periodLabel: 'Full FY 2027',
  from: '2026-03-01',
  to: '2027-02-28',
  rows: sliced,
  generatedAt: '2026-09-25T12:00:00.000Z',
});
assert.equal(bytes[0], 0x50);
assert.equal(bytes[1], 0x4b);

// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require('xlsx') as typeof XLSXType;
const wb = XLSX.read(bytes, { type: 'array' });
assert.deepEqual(wb.SheetNames, ['Cover', 'Chart of accounts', 'By type']);
assert.equal(wb.Sheets.Cover.A1.v, 'Chart of accounts');
assert.equal(wb.Sheets.Cover.B2.v, 'VUKA');
assert.equal(wb.Sheets.Cover.B4.v, 'Full FY 2027');
assert.equal(wb.Sheets.Cover.B5.v, '2026-03-01');
assert.equal(wb.Sheets.Cover.B11.v, 500);
assert.equal(wb.Sheets.Cover.B12.v, 300);

const listed = XLSX.utils.sheet_to_json<Record<string, unknown>>(
  wb.Sheets['Chart of accounts']
);
assert.equal(listed.length, 4);
assert.equal(listed[1].Code, '1200');
assert.equal(listed[1]['Closing balance'], 1150);
assert.equal(listed[1]['Parent code'], '1000');
assert.equal(listed[0].Header, 'Yes');
assert.equal(wb.Sheets['Chart of accounts']['!autofilter']?.ref, 'A1:P5');

const byType = XLSX.utils.sheet_to_json<Record<string, unknown>>(
  wb.Sheets['By type']
);
assert.equal(byType[0].Type, 'Asset');
assert.equal(byType[0]['Period debit'], 400);
assert.equal(byType[3].Type, 'All posting accounts');
assert.equal(byType[3]['Period debit'], 500);
assert.equal(byType[3]['Period credit'], 300);

const nasty = buildCoaWorkbook({
  companyName: '=HYPERLINK("http://evil")',
  periodLabel: 'March 2026',
  from: '2026-03-01',
  to: '2026-03-31',
  search: '=2+2',
  generatedAt: '2026-09-25T12:00:00.000Z',
  rows: sliceCoaAccounts({
    accounts: [
      {
        id: 9,
        code: '6100',
        name: '=1+1',
        account_type: 'expense',
        normal_balance: 'debit',
        description: '+cmd',
      },
    ],
  }),
});
const nastyBook = XLSX.read(nasty, { type: 'array' });
const nameCell = nastyBook.Sheets['Chart of accounts'].B2;
assert.equal(nameCell.t, 's');
assert.equal(nameCell.f, undefined);
assert.equal(nastyBook.Sheets.Cover.B2.t, 's');
assert.equal(nastyBook.Sheets.Cover.B2.f, undefined);

console.log('coa-slice tests ok');
