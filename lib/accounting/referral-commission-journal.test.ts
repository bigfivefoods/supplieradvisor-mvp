import assert from 'node:assert/strict';
import { referralJournalLines } from './referral-commission-journal';

const lines = referralJournalLines({
  expenseAccountId: 10,
  payableAccountId: 20,
  amount: 437.5,
  partnerName: 'Restore Africa Foundation',
  method: 'paid',
});
assert.equal(lines.length, 2);
assert.equal(lines[0].debit, 437.5);
assert.equal(lines[0].credit, 0);
assert.equal(lines[1].debit, 0);
assert.equal(lines[1].credit, 437.5);
assert.equal(lines[0].accountId, 10);
assert.equal(lines[1].accountId, 20);
const dr = lines.reduce((sum, line) => sum + (line.debit || 0), 0);
const cr = lines.reduce((sum, line) => sum + (line.credit || 0), 0);
assert.equal(dr, cr);

console.log('referral-commission-journal.test.ts ok');
