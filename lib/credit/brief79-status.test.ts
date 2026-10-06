/**
 * Run: npx --yes tsx lib/credit/brief79-status.test.ts
 */
import assert from 'node:assert/strict';
import { assertCreditStatusTransition } from '@/lib/credit/status';
import type { CreditStatus } from '@/lib/credit/types';

const statuses: CreditStatus[] = ['draft', 'submitted', 'under_review', 'more_info_needed', 'approved', 'declined'];

const allowedCustomer = new Set(['draft->submitted', 'more_info_needed->submitted']);
const allowedSupplier = new Set([
  'submitted->under_review',
  'submitted->more_info_needed',
  'submitted->approved',
  'submitted->declined',
  'under_review->more_info_needed',
  'under_review->approved',
  'under_review->declined',
]);

for (const from of statuses) {
  for (const to of statuses) {
    const key = `${from}->${to}`;
    const c = assertCreditStatusTransition({ actor: 'customer', from, to });
    if (allowedCustomer.has(key)) {
      assert.equal(c.ok, true, `customer transition should pass: ${key}`);
    } else {
      assert.equal(c.ok, false, `customer transition should fail: ${key}`);
      if (!c.ok) assert.equal(c.status, 409);
    }

    const s = assertCreditStatusTransition({ actor: 'supplier', from, to });
    if (allowedSupplier.has(key)) {
      assert.equal(s.ok, true, `supplier transition should pass: ${key}`);
    } else {
      assert.equal(s.ok, false, `supplier transition should fail: ${key}`);
      if (!s.ok) assert.equal(s.status, 409);
    }
  }
}

console.log('brief79-status.test.ts ok');
