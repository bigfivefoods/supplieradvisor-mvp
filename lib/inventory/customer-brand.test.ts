/**
 * Run: npx --yes tsx lib/inventory/customer-brand.test.ts
 */
import assert from 'node:assert/strict';
import {
  productAssignedToCustomer,
  readCustomerBrand,
  writeCustomerBrand,
} from './customer-brand';

const tagged = writeCustomerBrand({}, {
  customer_brand: true,
  customer_id: 44,
  customer_name: 'Boxer',
});
assert.equal(readCustomerBrand(tagged).customer_id, 44);
assert.equal(productAssignedToCustomer(tagged, 44), true);
assert.equal(productAssignedToCustomer(tagged, 9), false);

const cleared = writeCustomerBrand(tagged, {
  customer_brand: false,
  customer_id: null,
  customer_name: null,
});
assert.equal(readCustomerBrand(cleared).customer_brand, false);
assert.equal(cleared.customer_id, undefined);

console.log('customer-brand.test.ts ok');
