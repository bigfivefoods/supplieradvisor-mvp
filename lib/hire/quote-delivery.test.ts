/**
 * Run: npx --yes tsx lib/hire/quote-delivery.test.ts
 */
import assert from 'node:assert/strict';
import {
  emptyHiregraphStore,
  quoteHireBooking,
  type HireItem,
} from './hiregraph';

const item: HireItem = {
  id: 'itm_1',
  code: 'JC-1',
  title: 'Jumping castle',
  category_id: 'kids_party',
  rate_zar: 1000,
  rate_unit: 'day',
  deposit_zar: 200,
  fulfillment: 'delivery',
  delivery_fee_zar: 150,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

const store = {
  ...emptyHiregraphStore(),
  items: [item],
};

const collect = quoteHireBooking(store, {
  item_id: 'itm_1',
  units: 1,
  qty: 1,
});
assert.ok(collect);
assert.equal(collect.delivery_zar, 0);
assert.equal(collect.fees.rentalZar, 1000);

const delivered = quoteHireBooking(store, {
  item_id: 'itm_1',
  units: 1,
  qty: 1,
  delivery_address: '12 Party Street, Sandton',
});
assert.ok(delivered);
assert.equal(delivered.delivery_zar, 150);
assert.equal(
  delivered.fees.customerPaysZar,
  collect.fees.customerPaysZar + 150
);

console.log('quote-delivery.test.ts ok');
