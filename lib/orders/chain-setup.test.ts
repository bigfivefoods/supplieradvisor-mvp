/**
 * Run: npx --yes tsx lib/orders/chain-setup.test.ts
 */
import assert from 'node:assert/strict';
import {
  groupSoItemsByChain,
  mapChainSetup,
  pickSetupForLine,
  productIdsOnCustomerChains,
  scoreChainSetup,
} from './chain-setup';

const a = mapChainSetup({
  id: 1,
  profile_id: 9,
  customer_id: 44,
  srm_supplier_id: 12,
  supplier_name: 'Plant A',
  product_ids: [101, 102],
  status: 'active',
})!;
const b = mapChainSetup({
  id: 2,
  profile_id: 9,
  customer_id: 44,
  srm_supplier_id: 13,
  supplier_name: 'Plant B',
  product_ids: [201],
  status: 'active',
})!;
const anyCust = mapChainSetup({
  id: 3,
  profile_id: 9,
  customer_id: null,
  srm_supplier_id: 12,
  product_ids: [101],
  status: 'active',
})!;

assert.ok(scoreChainSetup(a, 44, 101) > scoreChainSetup(anyCust, 44, 101));
assert.equal(pickSetupForLine([a, b], 44, 201)?.srm_supplier_id, 13);
assert.equal(pickSetupForLine([a, b], 99, 101), null);

const groups = groupSoItemsByChain(
  [
    { name: 'Brand meal', product_id: 101, quantity: 10 },
    { name: 'Other', product_id: 201, quantity: 2 },
    { name: 'Free text', quantity: 1 },
  ],
  [a, b],
  44
);
assert.equal(groups.length, 3);
assert.equal(
  groups.find((g) => g.srmSupplierId === 12)?.items.length,
  1
);
assert.equal(
  groups.find((g) => g.srmSupplierId === 13)?.items.length,
  1
);
assert.equal(groups.find((g) => g.srmSupplierId == null)?.items.length, 1);

const allowed = productIdsOnCustomerChains([a, b, anyCust], 44);
assert.deepEqual([...allowed].sort((x, y) => x - y), [101, 102, 201]);
assert.equal(productIdsOnCustomerChains([a, b, anyCust], 99).size, 0);

console.log('chain-setup.test.ts ok');
