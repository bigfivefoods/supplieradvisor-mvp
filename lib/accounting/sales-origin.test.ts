/**
 * Run: npx --yes tsx lib/accounting/sales-origin.test.ts
 */
import assert from 'node:assert/strict';
import {
  buildSalesOrigin,
  classifySalesSource,
  collectAccountPostings,
  invoiceRefFromJournal,
} from './sales-origin';

assert.equal(classifySalesSource('invoice_recognition'), 'invoice');
assert.equal(classifySalesSource('bank_allocation'), 'bank');
assert.equal(classifySalesSource(null), 'manual');
assert.equal(classifySalesSource('mass_allocate'), 'other');

assert.equal(
  invoiceRefFromJournal({ memo: 'Recognise AR INV-20260817-ABCD' }),
  'INV-20260817-ABCD'
);
assert.equal(
  invoiceRefFromJournal({ metadata: { invoice_number: 'INV-9' }, memo: 'x' }),
  'INV-9'
);

const pack = buildSalesOrigin({
  entries: [
    {
      id: 1,
      entry_date: '2026-08-17',
      source: 'invoice_recognition',
      memo: 'Recognise AR INV-1',
      metadata: { invoice_number: 'INV-1' },
    },
    {
      id: 2,
      entry_date: '2026-08-16',
      source: 'bank_allocation',
      memo: 'FNB receipt',
    },
    {
      id: 3,
      entry_date: '2026-08-15',
      source: 'year_end_close',
      memo: 'close',
    },
  ],
  lines: [
    { account_id: 4100, debit: 0, credit: 100, journal_entry_id: 1, counterparty: 'Acme' },
    { account_id: 2120, debit: 0, credit: 15, journal_entry_id: 1 },
    { account_id: 4100, debit: 0, credit: 50, journal_entry_id: 2, memo: 'Shop sales' },
    { account_id: 4100, debit: 0, credit: 999, journal_entry_id: 3 },
  ],
  accounts: [
    { id: 4100, code: '4100', name: 'Sales', account_type: 'revenue' },
    { id: 2120, code: '2120', name: 'VAT output', account_type: 'liability' },
  ],
});

assert.equal(pack.total, 150);
assert.equal(pack.lines.length, 2);
assert.equal(pack.lines[0].label, 'INV-1');
assert.equal(pack.lines[0].counterparty, 'Acme');
const inv = pack.buckets.find((b) => b.kind === 'invoice');
const bank = pack.buckets.find((b) => b.kind === 'bank');
assert.equal(inv?.amount, 100);
assert.equal(bank?.amount, 50);

const posts = collectAccountPostings({
  accountId: 4100,
  polarity: 'revenue',
  entries: packEntries(),
  lines: [
    { account_id: 4100, debit: 0, credit: 100, journal_entry_id: 1, counterparty: 'Acme' },
    { account_id: 4100, debit: 0, credit: 50, journal_entry_id: 2 },
  ],
});
assert.equal(posts.length, 2);
assert.equal(posts[0].amount, 100);

const exp = collectAccountPostings({
  accountId: 6200,
  polarity: 'expense',
  entries: [{ id: 9, entry_date: '2026-08-10', source: 'bank_allocation', memo: 'Fuel' }],
  lines: [{ account_id: 6200, debit: 40, credit: 0, journal_entry_id: 9 }],
});
assert.equal(exp[0].amount, 40);

console.log('sales-origin ok');

function packEntries() {
  return [
    {
      id: 1,
      entry_date: '2026-08-17',
      source: 'invoice_recognition',
      memo: 'Recognise AR INV-1',
      entry_number: 'JE-1',
    },
    { id: 2, entry_date: '2026-08-16', source: 'bank_allocation', memo: 'FNB receipt' },
  ];
}
