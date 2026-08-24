/**
 * Run: npx --yes tsx lib/orders/map-so-to-po-items.test.ts
 */
import assert from 'node:assert/strict';
import { mapSoItemsToPoItems } from './map-so-to-po-items';

const fromPortal = mapSoItemsToPoItems(
  [{ name: 'Boxer maize', qty: 10, quantity: 10, unit_price: 99, product_id: 7, uom: 'kg' }],
  { copyPrices: false, priceByProductId: { 7: 40 } }
);
assert.equal('error' in fromPortal, false);
if (!('error' in fromPortal)) {
  assert.equal(fromPortal.items[0].quantity, 10);
  assert.equal(fromPortal.items[0].unit_price, 40);
  assert.equal(fromPortal.total, 400);
}

const qtyOnly = mapSoItemsToPoItems([{ name: 'Meal', qty: 2, uom: 'ea' }], {
  defaultUnitPrice: 5,
});
assert.equal('error' in qtyOnly, false);
if (!('error' in qtyOnly)) {
  assert.equal(qtyOnly.items[0].quantity, 2);
  assert.equal(qtyOnly.total, 10);
}

console.log('map-so-to-po-items.test.ts ok');
