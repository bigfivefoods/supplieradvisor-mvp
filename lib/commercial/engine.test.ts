/**
 * Run: npx --yes tsx lib/commercial/engine.test.ts
 */
import assert from 'node:assert/strict';
import {
  applyAcceptedUnitPrices,
  applyMappedUnitPrices,
  billedUnitPrice,
  counterpartyMayDecide,
  familyRank,
  groupLinesByFamily,
  kelpackSeedPrice,
  productFamily,
  roundMoney,
  sortRevisionsOldestLast,
} from './engine';
import { KELPACK_SEED_PRICES } from './types';

assert.equal(productFamily({ name: 'OnePot Chicken 1kg' }), 'OnePot');
assert.equal(productFamily({ name: 'Fortified porridge Chocolate 1kg' }), 'Fortified porridge');
assert.equal(productFamily({ name: 'Soya Mince Beef 5kg' }), 'NSNP');
assert.equal(productFamily({ name: 'Printed film 80u' }), 'Film');
assert.ok(familyRank('OnePot') < familyRank('NSNP'));

assert.equal(kelpackSeedPrice(2), 28);
assert.equal(kelpackSeedPrice(7), 35);
assert.equal(kelpackSeedPrice(45), 685.75);
assert.equal(kelpackSeedPrice(49), 1.35);
assert.equal(kelpackSeedPrice(54), null);
assert.equal(
  KELPACK_SEED_PRICES.map((r) => r.product_id).join(','),
  '2,3,4,5,6,7,8,9,42,44,45,46,49,50,51,52'
);

assert.equal(billedUnitPrice({ accepted_price: 28, pending_price: 30 }), 28);
assert.equal(counterpartyMayDecide({ pendingProposedBy: 'party', actor: 'host' }), true);
assert.equal(counterpartyMayDecide({ pendingProposedBy: 'party', actor: 'party' }), false);
assert.equal(counterpartyMayDecide({ pendingProposedBy: 'host', actor: 'party' }), true);
assert.equal(counterpartyMayDecide({ pendingProposedBy: null, actor: 'host' }), false);

const priced = applyAcceptedUnitPrices(
  [
    { product_id: 2, quantity: 10, unit_price: 99 },
    { product_id: 54, quantity: 1, unit_price: 40 },
  ],
  { 2: 28 }
);
assert.equal(priced.items[0].unit_price, 28);
assert.equal(priced.items[0].line_total, 280);
assert.equal(priced.items[1].unit_price, 40);
assert.equal(priced.total, 320);

const mapped = applyMappedUnitPrices(
  [{ product_id: 2, quantity: 10, unit_price: 45 }],
  { 2: 26.52 }
);
assert.equal(mapped.ok, true);
if (mapped.ok) {
  assert.equal(mapped.items[0].unit_price, 26.52);
  assert.equal(mapped.total, 265.2);
}
const unmapped = applyMappedUnitPrices(
  [{ product_id: 2, quantity: 1, unit_price: 45, item_name: 'OnePot' }],
  {}
);
assert.equal(unmapped.ok, false);

const groups = groupLinesByFamily([
  {
    id: 1,
    profile_id: 102,
    party_kind: 'supplier',
    supplier_id: 12,
    customer_id: null,
    product_id: 49,
    currency: 'ZAR',
    uom: 'm',
    accepted_price: 1.35,
    accepted_at: null,
    pending_price: null,
    pending_proposed_at: null,
    pending_proposed_by: null,
    status: 'active',
    product_name: 'Film A',
  },
  {
    id: 2,
    profile_id: 102,
    party_kind: 'supplier',
    supplier_id: 12,
    customer_id: null,
    product_id: 2,
    currency: 'ZAR',
    uom: 'kg',
    accepted_price: 28,
    accepted_at: null,
    pending_price: null,
    pending_proposed_at: null,
    pending_proposed_by: null,
    status: 'active',
    product_name: 'OnePot Chicken 1kg',
  },
]);
assert.equal(groups[0].family, 'OnePot');
assert.equal(groups[1].family, 'Film');

const hist = sortRevisionsOldestLast([
  {
    id: 2,
    line_id: 1,
    old_price: 28,
    new_price: 30,
    currency: 'ZAR',
    proposed_by: 'party',
    status: 'accepted',
    accepted_by: 'host',
    accepted_at: null,
    rejected_by: null,
    rejected_at: null,
    note: null,
    created_at: '2026-08-30T12:00:00.000Z',
  },
  {
    id: 1,
    line_id: 1,
    old_price: null,
    new_price: 28,
    currency: 'ZAR',
    proposed_by: 'host',
    status: 'accepted',
    accepted_by: 'host',
    accepted_at: null,
    rejected_by: null,
    rejected_at: null,
    note: null,
    created_at: '2026-08-01T12:00:00.000Z',
  },
]);
assert.equal(hist[0].id, 1);
assert.equal(hist[1].id, 2);
assert.equal(roundMoney(685.75), 685.75);

console.log('commercial/engine.test.ts ok');
