/**
 * Run: npx --yes tsx lib/orders/chain-path.test.ts
 */
import assert from 'node:assert/strict';
import {
  chainStepIndex,
  nextSupplierProductionAction,
  chainProductionLabel,
  supplierChainStep,
  supplierPortalCardAction,
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
  chainStepIndex({
    side: 'supplier',
    orderStatus: 'accepted',
    productionStatus: 'released',
  }),
  2,
  'ready / in production is one step'
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

assert.equal(
  supplierChainStep({ side: 'supplier', orderStatus: 'sent' }),
  0
);
assert.equal(
  supplierChainStep({ side: 'supplier', orderStatus: 'accepted' }),
  1
);
assert.equal(
  supplierChainStep({
    side: 'supplier',
    orderStatus: 'accepted',
    productionStatus: 'in_progress',
  }),
  2
);
assert.equal(
  supplierChainStep({
    side: 'supplier',
    orderStatus: 'accepted',
    fulfilmentStatus: 'shipped',
  }),
  3
);
assert.equal(
  supplierChainStep({
    side: 'supplier',
    orderStatus: 'accepted',
    inventoryReceived: true,
  }),
  4
);

assert.equal(
  supplierPortalCardAction({ orderStatus: 'sent' })?.key,
  'accept'
);
assert.equal(
  supplierPortalCardAction({ orderStatus: 'accepted' })?.key,
  'ready'
);
assert.equal(
  supplierPortalCardAction({
    orderStatus: 'accepted',
    productionStatus: 'in_progress',
  })?.key,
  'ship'
);

console.log('chain-path.test.ts ok');
