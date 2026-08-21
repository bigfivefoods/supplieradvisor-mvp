/**
 * Run: npx --yes tsx lib/accounting/account-totals.test.ts
 */
import assert from 'node:assert/strict';
import { dayBeforeIso, totalsMap } from './account-totals';

assert.equal(dayBeforeIso('2026-03-01'), '2026-02-28');
assert.equal(dayBeforeIso('2026-01-01'), '2025-12-31');

const m = totalsMap([
  { account_id: 3, debit: 10, credit: 1 },
  { account_id: 4, debit: 0, credit: 5 },
]);
assert.equal(m.get(3)?.debit, 10);
assert.equal(m.get(4)?.credit, 5);

console.log('account-totals tests ok');
