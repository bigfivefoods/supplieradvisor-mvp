/**
 * Run: npx --yes tsx lib/commercial/po-price.test.ts
 */
import assert from 'node:assert/strict';
import { applyMappedUnitPrices } from './engine';
import {
  attachProductIdsFromSku,
  isOpenUnreceivedPo,
  productCostFromRow,
} from './po-price';

assert.equal(
  productCostFromRow({ cost_price: 26.52, prices: [{ currency: 'ZAR', sell_price: 45 }] }),
  26.52
);
assert.equal(
  productCostFromRow({
    cost_price: null,
    prices: [{ currency: 'ZAR', cost_price: 1.35, sell_price: 9 }],
  }),
  1.35
);
assert.equal(productCostFromRow({ sell_price: 45 }), null);
assert.equal(productCostFromRow({ cost_price: 0 }), 0);

assert.equal(isOpenUnreceivedPo({ status: 'sent', metadata: { srm_supplier_id: 12 } }), true);
assert.equal(isOpenUnreceivedPo({ status: 'draft' }), true);
assert.equal(isOpenUnreceivedPo({ status: 'confirmed' }), true);
assert.equal(
  isOpenUnreceivedPo({
    status: 'sent',
    metadata: { inventory_received_at: '2026-08-01' },
  }),
  false
);
assert.equal(isOpenUnreceivedPo({ status: 'completed' }), false);
assert.equal(isOpenUnreceivedPo({ status: 'cancelled' }), false);

const products = new Map<number, Record<string, unknown>>([
  [2, { id: 2, sku: 'OP-CHICK', cost_price: 26.52 }],
]);
const attached = attachProductIdsFromSku(
  [
    { product_id: null, sku: 'OP-CHICK', item_name: 'OnePot' },
    { product_id: 2, sku: 'other' },
  ],
  products
);
assert.equal(attached.error, undefined);
assert.equal(attached.items[0].product_id, 2);

const miss = attachProductIdsFromSku(
  [{ product_id: null, sku: 'NOPE', item_name: 'Mystery' }],
  products
);
assert.match(String(miss.error), /Missing product_id/);

const priced = applyMappedUnitPrices(
  [{ product_id: 2, quantity: 2, unit_price: 45, item_name: 'OnePot Chicken' }],
  { 2: 26.52 }
);
assert.equal(priced.ok, true);
if (priced.ok) {
  assert.equal(priced.items[0].unit_price, 26.52);
  assert.equal(priced.items[0].line_total, 53.04);
  assert.equal(priced.total, 53.04);
}
const empty = applyMappedUnitPrices(
  [{ product_id: 2, quantity: 1, unit_price: 45, item_name: 'OnePot Chicken' }],
  {}
);
assert.equal(empty.ok, false);
if (!empty.ok) assert.match(empty.error, /No agreed cost/);

console.log('commercial/po-price.test.ts ok');
