/**
 * Run: npx --yes tsx lib/suppliers/buyer-inventory-catalogue.test.ts
 */
import assert from 'node:assert/strict';
import {
  buyerProductEligibleForPo,
  mapBuyerProductToPoCatalogueItem,
  mapBuyerProductsToPoCatalogue,
  poCatalogueSourceRank,
  type BuyerInventoryProductRow,
} from './buyer-inventory-catalogue';

function row(
  partial: Partial<BuyerInventoryProductRow> & { id: number; name: string }
): BuyerInventoryProductRow {
  return {
    sku: 'PK-01',
    product_type: 'packaging',
    uom: 'ea',
    status: 'active',
    is_purchasable: true,
    sell_price: 40,
    cost_price: 12.5,
    base_currency: 'ZAR',
    prices: null,
    ...partial,
  };
}

assert.equal(buyerProductEligibleForPo(row({ id: 1, name: 'Tray' })), true);
assert.equal(
  buyerProductEligibleForPo(row({ id: 2, name: 'Old', status: 'archived' })),
  false
);
assert.equal(
  buyerProductEligibleForPo(
    row({ id: 3, name: 'WIP', product_type: 'wip' })
  ),
  false
);
assert.equal(
  buyerProductEligibleForPo(
    row({ id: 4, name: 'Not buy', is_purchasable: false })
  ),
  false
);
assert.equal(buyerProductEligibleForPo(row({ id: 5, name: '   ' })), false);
assert.equal(
  buyerProductEligibleForPo(
    row({ id: 6, name: 'Legacy null purchasable', is_purchasable: null })
  ),
  true
);

const mapped = mapBuyerProductToPoCatalogueItem(
  row({ id: 88, name: 'Kelpack sleeve' }),
  'ZAR'
);
assert.ok(mapped);
assert.equal(mapped.source, 'buyer_inventory');
assert.equal(mapped.key, 'buyer_inventory:88');
assert.equal(mapped.seller_product_id, 88);
assert.equal(mapped.product_name, 'Kelpack sleeve');
assert.equal(mapped.unit_price, 12.5);
assert.equal(mapped.currency, 'ZAR');
assert.equal(mapped.product_type, 'packaging');

const sellFallback = mapBuyerProductToPoCatalogueItem(
  row({ id: 9, name: 'No cost', cost_price: 0, sell_price: 33 }),
  'ZAR'
);
assert.equal(sellFallback?.unit_price, 33);

const usd = mapBuyerProductToPoCatalogueItem(
  row({
    id: 10,
    name: 'USD pack',
    base_currency: 'ZAR',
    cost_price: 12.5,
    sell_price: 40,
    prices: [
      { currency: 'ZAR', cost_price: 12.5, sell_price: 40 },
      { currency: 'USD', cost_price: 0.7, sell_price: 2.2 },
    ],
  }),
  'USD'
);
assert.equal(usd?.unit_price, 0.7);
assert.equal(usd?.currency, 'USD');

const list = mapBuyerProductsToPoCatalogue(
  [
    row({ id: 1, name: 'B box', product_type: 'packaging' }),
    row({ id: 2, name: 'A film', product_type: 'packaging' }),
    row({ id: 3, name: 'Skip me', status: 'inactive' }),
    row({ id: 4, name: 'Already on supplier cat' }),
  ],
  'ZAR',
  { excludeProductIds: [4] }
);
assert.equal(list.length, 2);
assert.equal(list[0].product_name, 'A film');
assert.equal(list[1].product_name, 'B box');
assert.ok(list.every((i) => i.source === 'buyer_inventory'));

assert.equal(poCatalogueSourceRank('agreement'), 0);
assert.equal(poCatalogueSourceRank('inventory'), 1);
assert.equal(poCatalogueSourceRank('buyer_inventory'), 2);

console.log('buyer-inventory-catalogue.test.ts ok');
