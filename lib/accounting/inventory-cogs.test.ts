/**
 * Run: npx --yes tsx lib/accounting/inventory-cogs.test.ts
 */
import assert from 'node:assert/strict';
import {
  alreadyPostedCogs,
  cogsJournalLines,
  explicitLineCost,
  isGoodsProductType,
  isMembershipOrServiceInvoice,
  lineQuantity,
  lookupCostForLine,
  parseInvoiceCogsLines,
  planCogsLine,
  sumCogsAmount,
  type ProductCostLookup,
} from './inventory-cogs';
import { voidInvoiceJournalIds } from './contract-liability';

assert.equal(isGoodsProductType('finished_good'), true);
assert.equal(isGoodsProductType('raw_material'), true);
assert.equal(isGoodsProductType('service'), false);
assert.equal(isGoodsProductType('membership'), false);
assert.equal(isGoodsProductType(null), true);

assert.equal(isMembershipOrServiceInvoice({ metadata: { advisor_fee: true } }), true);
assert.equal(isMembershipOrServiceInvoice({ metadata: { membership: true } }), true);
assert.equal(isMembershipOrServiceInvoice({ metadata: {} }), false);

assert.equal(lineQuantity({ quantity: 3 }), 3);
assert.equal(lineQuantity({ quantity: 0 }), 0);
assert.equal(lineQuantity({}), 0);

assert.equal(explicitLineCost({ unit_cost: 12, unit_price: 50 }), 12);
assert.equal(explicitLineCost({ cost_price: 8, unit_price: 50 }), 8);
assert.equal(explicitLineCost({ unit_price: 50 }), null);
assert.equal(explicitLineCost({ unit_cost: 0, unit_price: 50 }), null);

const byId = new Map<number, ProductCostLookup>([
  [
    9,
    {
      productId: 9,
      sku: 'MILK-1',
      costPrice: 10,
      productType: 'finished_good',
    },
  ],
]);
const bySku = new Map<string, ProductCostLookup>([['milk-1', byId.get(9)!]]);

// Goods with known cost → 5100/1140
const withCost = planCogsLine(
  { product_id: 9, quantity: 4, unit_price: 25 },
  lookupCostForLine({ product_id: 9, quantity: 4, unit_price: 25 }, byId, bySku)
);
assert.equal(withCost.skip, null);
assert.equal(withCost.unitCost, 10);
assert.equal(withCost.amount, 40);
assert.notEqual(withCost.unitCost, 25);

const je = cogsJournalLines({
  cogsAccountId: 5100,
  inventoryAccountId: 1140,
  amount: withCost.amount,
});
assert.equal(je[0].accountId, 5100);
assert.equal(je[0].debit, 40);
assert.equal(je[1].accountId, 1140);
assert.equal(je[1].credit, 40);

// Goods without cost → no 5100
const noCost = planCogsLine(
  { product_id: 9, quantity: 2, unit_price: 25 },
  { productId: 9, sku: 'MILK-1', costPrice: 0, productType: 'finished_good' }
);
assert.equal(noCost.skip, 'no_cost');
assert.equal(noCost.amount, 0);

const noProduct = planCogsLine({ quantity: 2, unit_price: 25 }, null);
assert.equal(noProduct.skip, 'no_product');
assert.equal(noProduct.amount, 0);

// Service / membership → no 5100
const service = planCogsLine(
  { product_id: 1, quantity: 1, unit_cost: 5, product_type: 'service' },
  { productId: 1, sku: 'SESS', costPrice: 5, productType: 'service' }
);
assert.equal(service.skip, 'not_goods');
const membershipLine = planCogsLine(
  { quantity: 1, unit_cost: 200, account_code: '4400' },
  null
);
assert.equal(membershipLine.skip, 'not_goods');

// Line unit_cost wins over catalogue; still not sell price
const lineCost = planCogsLine(
  { product_id: 9, quantity: 2, unit_cost: 7, unit_price: 99 },
  byId.get(9)!
);
assert.equal(lineCost.unitCost, 7);
assert.equal(lineCost.amount, 14);

const parsed = parseInvoiceCogsLines([
  { product_id: '9', sku: 'MILK-1', quantity: 3, unit_price: 20 },
]);
assert.equal(parsed[0].product_id, 9);
assert.equal(parsed[0].quantity, 3);

assert.equal(alreadyPostedCogs({ cogs_journal_id: 88 }), true);
assert.equal(alreadyPostedCogs({ recognition_journal_id: 1 }), false);

const mixed = [
  planCogsLine({ product_id: 9, quantity: 2, unit_price: 25 }, byId.get(9)!),
  planCogsLine({ quantity: 1, unit_price: 40 }, null),
];
assert.equal(sumCogsAmount(mixed), 20);

const voidIds = voidInvoiceJournalIds({
  recognitionJournalId: 10,
  cogsJournalId: 77,
});
assert.ok(voidIds.includes(77));
assert.ok(voidIds.includes(10));

console.log('inventory-cogs IAS 2 tests ok');
