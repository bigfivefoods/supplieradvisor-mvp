/**
 * Run: npx --yes tsx lib/accounting/journal-review.test.ts
 */
import assert from 'node:assert/strict';
import {
  applySuggestedAccountsToLines,
  reviewFlagKey,
  scorePostedLine,
} from './journal-review';
import {
  applyAllocationKeep,
  keepBlocksFlag,
  emptyAllocationKeeps,
} from './allocation-keep';
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

const keeps = emptyAllocationKeeps();
keeps.lines['12:8'] = {
  journal_id: 12,
  line_id: 8,
  gl_account_id: 2,
  merchant_key: 'landlord storage',
  sample: 'landlord storage',
  at: '2026-08-20T00:00:00.000Z',
};
assert.equal(
  keepBlocksFlag(keeps, {
    journalId: 12,
    lineId: 8,
    merchantKey: 'landlord storage',
    postedAccountId: 2,
  }),
  true
);
keeps.patterns['office space rent'] = {
  gl_account_id: 3,
  hits: 1,
  sample: 'Office space rent',
};
assert.equal(
  keepBlocksFlag(keeps, {
    journalId: 99,
    lineId: 1,
    merchantKey: 'office space rent',
    postedAccountId: 3,
  }),
  true
);
assert.equal(
  keepBlocksFlag(keeps, {
    journalId: 99,
    lineId: 1,
    merchantKey: 'office space rent',
    postedAccountId: 2,
  }),
  false
);

const swapped = applySuggestedAccountsToLines(
  [
    { id: 10, account_id: 2, debit: 0, credit: 12000, memo: 'Rent' },
    { id: 11, account_id: 1, debit: 12000, credit: 0, memo: 'Bank' },
  ],
  [
    {
      line_id: 10,
      posted_account_id: 2,
      suggested_account_id: 3,
      side: 'credit',
    },
  ]
);
assert.equal(swapped[0].account_id, 3);
assert.equal(swapped[1].account_id, 1);

const twoFlags = applySuggestedAccountsToLines(
  [
    { id: 21, account_id: 2, debit: 0, credit: 500, memo: 'Uber' },
    { id: 22, account_id: 4, debit: 0, credit: 80, memo: 'Fee' },
    { id: 23, account_id: 1, debit: 580, credit: 0 },
  ],
  [
    {
      line_id: 21,
      posted_account_id: 2,
      suggested_account_id: 4,
      side: 'credit',
    },
    {
      line_id: 22,
      posted_account_id: 4,
      suggested_account_id: 5,
      side: 'credit',
    },
  ]
);
assert.equal(twoFlags[0].account_id, 4);
assert.equal(twoFlags[1].account_id, 5);
assert.equal(twoFlags[2].account_id, 1);

const noIds = applySuggestedAccountsToLines(
  [
    { account_id: 2, debit: 0, credit: 99 },
    { account_id: 1, debit: 99, credit: 0 },
  ],
  [
    {
      line_id: 99,
      posted_account_id: 2,
      suggested_account_id: 5,
      side: 'credit',
    },
  ]
);
assert.equal(noIds[0].account_id, 5);

assert.equal(
  reviewFlagKey({ journal_id: 7, line_id: null, posted_account_id: 3 }),
  '7:x:3'
);

const batchKeeps = emptyAllocationKeeps();
applyAllocationKeep(batchKeeps, {
  journal_id: 1,
  line_id: 2,
  gl_account_id: 3,
  description: 'Office space rent July',
});
applyAllocationKeep(batchKeeps, {
  journal_id: 8,
  line_id: 9,
  gl_account_id: 3,
  description: 'Office space rent August',
});
assert.equal(Object.keys(batchKeeps.lines).length, 2);
assert.equal(batchKeeps.patterns['office space rent july']?.hits, 1);
assert.ok(batchKeeps.patterns['office space rent august']);

console.log('journal-review tests ok');
