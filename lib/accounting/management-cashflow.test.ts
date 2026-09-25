/**
 * Run: npx --yes tsx lib/accounting/management-cashflow.test.ts
 */
import assert from 'node:assert/strict';
import {
  assembleManagementCashflow,
  normalizeCashComment,
  parseBankTxnId,
} from './management-cashflow';

assert.equal(parseBankTxnId('12'), '12');
assert.equal(parseBankTxnId('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'), 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
assert.equal(parseBankTxnId(''), null);
assert.equal(normalizeCashComment('  timing  \n'), 'timing');

const report = assembleManagementCashflow({
  from: '2026-03-01',
  to: '2026-04-30',
  fyStartMonth: 3,
  lines: [
    {
      id: 11,
      date: '2026-03-04',
      amount: 800,
      description: 'Customer receipt',
      comment: '  March sales, paid late  ',
      gl_account_id: 1,
      status: 'reconciled',
    },
    { id: '12', date: '2026-03-10', amount: -250, description: 'Rent', gl_account_id: 2, allocation_status: 'allocated' },
    { id: 13, date: '2026-03-12', amount: 50, description: 'Unknown deposit', gl_account_id: null, status: 'unreconciled' },
    { id: 14, date: '2026-03-18', amount: 9999, status: 'excluded' },
    { id: 15, date: '2026-03-19', amount: -50, allocation_status: 'excluded' },
    { id: 16, date: '2026-02-28', amount: 500, gl_account_id: 1 },
    { id: 17, date: '2026-04-02', amount: 200, description: 'April receipt', gl_account_id: 1 },
  ],
  budgetRows: [
    {
      account_id: 1,
      account_type: 'revenue',
      fiscal_year: 2026,
      months: { m01: 1000, m02: 500 },
    },
    {
      account_id: 2,
      account_type: 'expense',
      fiscal_year: 2026,
      months: { m01: 400, m02: 100 },
    },
  ],
  accounts: [
    { id: 1, code: '4000', name: 'Sales', account_type: 'revenue' },
    { id: 2, code: '5000', name: 'Rent', account_type: 'expense' },
  ],
  ledgerCashMovement: 750,
});

assert.equal(report.txnCount, 4);
assert.equal(report.excludedCount, 2);
assert.equal(report.unallocatedCount, 1);
assert.equal(report.actualIn, 1050);
assert.equal(report.actualOut, 250);
assert.equal(report.actualNet, 800);
assert.equal(report.budgetIn, 1500);
assert.equal(report.budgetOut, 500);
assert.equal(report.budgetNet, 1000);
assert.equal(report.variance, -200);
assert.equal(report.favourable, false);
assert.equal(report.months.length, 2);
assert.equal(report.months[0].label, 'Mar 2026');
assert.equal(report.months[0].actualNet, 600);
assert.equal(report.months[0].budgetNet, 600);
assert.equal(report.months[0].variance, 0);
assert.equal(report.months[1].actualIn, 200);
assert.equal(report.months[1].budgetIn, 500);

const sales = report.accounts.find((row) => row.code === '4000');
const rent = report.accounts.find((row) => row.code === '5000');
const loose = report.accounts.find((row) => row.account_id == null);
assert.ok(sales && rent && loose);
assert.equal(sales.actualIn, 1000);
assert.equal(sales.budgetIn, 1500);
assert.equal(sales.variance, -500);
assert.equal(rent.actualOut, 250);
assert.equal(rent.budgetOut, 500);
assert.equal(rent.variance, 250);
assert.equal(rent.favourable, true);
assert.equal(loose.name, 'Unallocated bank lines');
assert.equal(loose.actualIn, 50);
assert.equal(report.accounts[0].account_id, null);
assert.equal(report.transactions.length, 4);
assert.equal(report.transactions[0].id, '11');
assert.equal(report.transactions[0].description, 'Customer receipt');
assert.equal(report.transactions[0].comment, 'March sales, paid late');
assert.equal(report.transactions[0].code, '4000');
assert.equal(report.transactions[3].date, '2026-04-02');
assert.equal(report.unallocatedNet, 50);
assert.equal(report.ledgerCashMovement, 750);
assert.equal(report.cashGap, 50);

console.log('management-cashflow.test.ts ok');
