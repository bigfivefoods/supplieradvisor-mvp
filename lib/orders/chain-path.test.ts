/**
 * Run: npx --yes tsx lib/orders/chain-path.test.ts
 */
import assert from 'node:assert/strict';
import {
  chainStepIndex,
  nextSupplierProductionAction,
  chainProductionLabel,
} from './chain-path';

assert.equal(
  chainStepIndex({ side: 'customer', orderStatus: 'confirmed', hasSalesOrder: true }),
  1
);
assert.equal(
  chainStepIndex({
    side: 'customer',
    orderStatus: 'confirmed',
    productionStatus: 'in_progress',
    hasSalesOrder: true,
  }),
  2
);
assert.equal(
  chainStepIndex({
    side: 'customer',
    orderStatus: 'confirmed',
    productionStatus: 'completed',
    hasSalesOrder: true,
  }),
  3
);
assert.equal(
  chainStepIndex({
    side: 'customer',
    orderStatus: 'confirmed',
    productionStatus: 'completed',
    rated: true,
    hasSalesOrder: true,
  }),
  4
);
assert.equal(chainProductionLabel('in_progress'), 'In production');
assert.equal(chainProductionLabel('completed'), 'Produced');

assert.equal(
  chainStepIndex({ side: 'supplier', orderStatus: 'sent' }),
  0
);
assert.equal(
  chainStepIndex({ side: 'supplier', orderStatus: 'accepted', productionStatus: 'released' }),
  1
);
assert.equal(
  chainStepIndex({
    side: 'supplier',
    orderStatus: 'accepted',
    productionStatus: 'in_progress',
  }),
  2
);
assert.equal(
  nextSupplierProductionAction('sent', null)?.status,
  'accepted'
);
assert.equal(
  nextSupplierProductionAction('accepted', 'released')?.status,
  'in_progress'
);
assert.equal(
  nextSupplierProductionAction('accepted', 'in_progress')?.status,
  'completed'
);

console.log('chain-path.test.ts ok');
