/**
 * Run: npx --yes tsx lib/accounting/journal-review.test.ts
 */
import assert from 'node:assert/strict';
import { scorePostedLine } from './journal-review';
import type { CoaAccount } from './types';

const coa: CoaAccount[] = [
  { id: 1, code: '1110', name: 'Bank', account_type: 'asset', subtype: 'bank' },
  { id: 2, code: '4100', name: 'Sales revenue', account_type: 'revenue' },
  { id: 3, code: '6200', name: 'Rent & facilities', account_type: 'expense' },
  { id: 4, code: '6500', name: 'Travel & entertainment', account_type: 'expense' },
  { id: 5, code: '6900', name: 'Bank charges', account_type: 'expense' },
];

const skipBank = scorePostedLine({
  journalId: 1,
  postedAccountId: 1,
  description: 'FNB monthly fee',
  amountSigned: -50,
  coa,
  otherGlVotes: new Map(),
});
assert.equal(skipBank, null, 'bank GL is not reviewed');

const rentOnSales = scorePostedLine({
  journalId: 9,
  postedAccountId: 2,
  description: 'Office space rent July',
  amountSigned: -12000,
  coa,
  otherGlVotes: new Map(),
});
assert.ok(rentOnSales);
assert.equal(rentOnSales!.suggestedId, 3);
assert.ok(rentOnSales!.confidence >= 70);
assert.equal(rentOnSales!.signal, 'type');

const learned = new Map<number, number>([
  [3, 4],
  [2, 1],
]);
const disagreeHistory = scorePostedLine({
  journalId: 12,
  postedAccountId: 2,
  description: 'landlord storage',
  amountSigned: -8000,
  coa,
  otherGlVotes: learned,
});
assert.ok(disagreeHistory);
assert.equal(disagreeHistory!.suggestedId, 3);
assert.ok(disagreeHistory!.confidence >= 70);

const charges = scorePostedLine({
  journalId: 3,
  postedAccountId: 4,
  description: 'Monthly fee service fee',
  amountSigned: -89,
  coa,
  otherGlVotes: new Map(),
});
assert.ok(charges);
assert.equal(charges!.suggestedId, 5);

const okRent = scorePostedLine({
  journalId: 4,
  postedAccountId: 3,
  description: 'Office space rent',
  amountSigned: -12000,
  coa,
  otherGlVotes: new Map([[3, 5]]),
});
assert.equal(okRent, null, 'correct rent posting is not flagged');

console.log('journal-review tests ok');
