/**
 * Run: npx --yes tsx lib/hire/hire-listing.test.ts
 */
import assert from 'node:assert/strict';
import { hireListingDetails, type HireItem } from './hiregraph';

const base = {
  id: 'itm_1',
  code: 'JC-1',
  title: 'Jumping castle',
  category_id: 'tools_equipment',
  rate_zar: 850,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
} as HireItem;

const empty = hireListingDetails(base);
assert.equal(empty.fulfillment, 'collect');
assert.equal(empty.fulfillment_label, 'Collect from desk');
assert.equal(empty.min_units, 1);
assert.equal(empty.operator_included, false);
assert.equal(empty.includes, '');

const filled = hireListingDetails({
  ...base,
  includes: 'Blower, pegs',
  excludes: 'Extension lead',
  specs: '4×5 m',
  fulfillment: 'both',
  delivery_fee_zar: 150,
  delivery_radius_km: 25,
  collect_hours: 'Mon–Sat 08:00–16:00',
  replacement_value_zar: 12000,
  operator_included: true,
  cancellation_note: '48h notice',
  min_units: 2,
});
assert.equal(filled.fulfillment_label, 'Collect or delivery');
assert.equal(filled.delivery_fee_zar, 150);
assert.equal(filled.delivery_radius_km, 25);
assert.equal(filled.includes, 'Blower, pegs');
assert.equal(filled.min_units, 2);
assert.equal(filled.operator_included, true);

console.log('hire-listing.test.ts ok');
