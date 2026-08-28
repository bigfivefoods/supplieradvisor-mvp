/**
 * Run: npx --yes tsx lib/accounting/current-noncurrent.test.ts
 */
import assert from 'node:assert/strict';
import {
  invoiceOpenAmount,
  isNonCurrentDue,
  nonCurrentOpenTotals,
  splitCurrentNonCurrent,
  twelveMonthsAfter,
} from './current-noncurrent';

assert.equal(twelveMonthsAfter('2026-02-28'), '2027-02-28');
assert.equal(twelveMonthsAfter('2024-02-29'), '2025-02-28');
assert.equal(twelveMonthsAfter('2026-03-31'), '2027-03-31');

assert.equal(isNonCurrentDue(null, '2026-02-28'), false);
assert.equal(isNonCurrentDue('', '2026-02-28'), false);
assert.equal(isNonCurrentDue('2027-02-28', '2026-02-28'), false);
assert.equal(isNonCurrentDue('2027-03-01', '2026-02-28'), true);
assert.equal(isNonCurrentDue('2026-08-01', '2026-02-28'), false);

assert.equal(
  invoiceOpenAmount({ total_amount: 100, amount_paid: 40, status: 'sent' }),
  60
);
assert.equal(
  invoiceOpenAmount({ total_amount: 100, amount_paid: 0, status: 'paid' }),
  0
);
assert.equal(
  invoiceOpenAmount({ total_amount: 100, amount_paid: 0, status: 'draft' }),
  0
);

const rows = [
  {
    direction: 'receivable',
    due_date: '2028-01-01',
    total_amount: 500,
    amount_paid: 100,
    status: 'sent',
  },
  {
    direction: 'payable',
    due_date: '2028-06-01',
    total_amount: 200,
    amount_paid: 0,
    status: 'sent',
  },
  {
    direction: 'receivable',
    due_date: '2026-06-01',
    total_amount: 999,
    amount_paid: 0,
    status: 'sent',
  },
  {
    direction: 'receivable',
    due_date: null,
    total_amount: 80,
    amount_paid: 0,
    status: 'sent',
  },
];
const tot = nonCurrentOpenTotals(rows, '2026-02-28');
assert.equal(tot.ar, 400);
assert.equal(tot.ap, 200);

assert.deepEqual(splitCurrentNonCurrent(1000, 400), {
  current: 600,
  nonCurrent: 400,
});
assert.deepEqual(splitCurrentNonCurrent(100, 400), {
  current: 0,
  nonCurrent: 100,
});
assert.deepEqual(splitCurrentNonCurrent(1000, 0), {
  current: 1000,
  nonCurrent: 0,
});

console.log('current-noncurrent tests ok');
