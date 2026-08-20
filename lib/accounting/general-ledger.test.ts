/**
 * Run: npx --yes tsx lib/accounting/general-ledger.test.ts
 */
import assert from 'node:assert/strict';
import {
  assembleAccountLedger,
  naturalAmount,
  normalBalanceForType,
} from './general-ledger';

assert.equal(normalBalanceForType('asset'), 'debit');
assert.equal(normalBalanceForType('expense'), 'debit');
assert.equal(normalBalanceForType('liability'), 'credit');
assert.equal(normalBalanceForType('equity'), 'credit');
assert.equal(normalBalanceForType('revenue'), 'credit');
assert.equal(naturalAmount(100, 'debit'), 100);
assert.equal(naturalAmount(100, 'credit'), -100);
assert.equal(naturalAmount(-250, 'credit'), 250);

const bank = assembleAccountLedger({
  account_id: 1,
  code: '1110',
  name: 'Bank — operating',
  account_type: 'asset',
  openingDebit: 1000,
  openingCredit: 0,
  lines: [
    {
      date: '2026-08-02',
      journal_id: 10,
      memo: 'Customer receipt',
      debit: 400,
      credit: 0,
    },
    {
      date: '2026-08-03',
      journal_id: 11,
      memo: 'Supplier payment',
      debit: 0,
      credit: 250,
    },
  ],
});
assert.equal(bank.opening, 1000);
assert.equal(bank.opening_natural, 1000);
assert.equal(bank.period_debit, 400);
assert.equal(bank.period_credit, 250);
assert.equal(bank.closing, 1150);
assert.equal(bank.movements[0].balance, 1400);
assert.equal(bank.movements[1].balance, 1150);
assert.equal(bank.movements[1].natural_balance, 1150);

const ap = assembleAccountLedger({
  account_id: 2,
  code: '2110',
  name: 'Accounts payable',
  account_type: 'liability',
  openingDebit: 0,
  openingCredit: 500,
  lines: [
    {
      date: '2026-08-04',
      journal_id: 12,
      debit: 0,
      credit: 100,
    },
    {
      date: '2026-08-05',
      journal_id: 13,
      debit: 80,
      credit: 0,
    },
  ],
});
assert.equal(ap.opening, -500);
assert.equal(ap.opening_natural, 500);
assert.equal(ap.closing, -520);
assert.equal(ap.closing_natural, 520);
assert.equal(ap.movements[0].natural_balance, 600);
assert.equal(ap.movements[1].natural_balance, 520);

console.log('general-ledger.test.ts ok');
