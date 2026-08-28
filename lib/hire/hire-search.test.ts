/**
 * Run: npx --yes tsx lib/hire/hire-search.test.ts
 */
import assert from 'node:assert/strict';
import {
  companyPinsFromItems,
  filterHireSearchItems,
  haversineKm,
  nearestHireAreas,
  sortHireItemsByDistance,
  toggleListValue,
  type HireSearchItem,
} from './hire-search';

const items: HireSearchItem[] = [
  {
    id: 'a',
    title: 'Mini excavator',
    description: '3-ton plant',
    category_id: 'plant_machinery',
    category_short: 'Plant',
    category_name: 'Plant & machinery',
    supplier_name: 'Acme Plant',
    srm_supplier_id: 10,
    location: 'Sandton',
    rate_zar: 1800,
    rate_unit: 'day',
  },
  {
    id: 'b',
    title: 'Jumping castle',
    description: 'Kids party',
    category_id: 'events_party',
    category_short: 'Kids',
    category_name: 'Party',
    supplier_name: 'Party Hire SA',
    location: 'Randburg',
    rate_zar: 850,
    rate_unit: 'day',
  },
  {
    id: 'c',
    title: 'Angle grinder',
    category_id: 'tools_equipment',
    category_short: 'Tools',
    category_name: 'Tools',
    supplier_name: 'Acme Plant',
    srm_supplier_id: 10,
    location: 'Sandton',
    rate_zar: 120,
    rate_unit: 'day',
  },
];

assert.equal(filterHireSearchItems(items, { query: 'castle' }).length, 1);
assert.equal(
  filterHireSearchItems(items, { areas: ['Sandton'] }).map((i) => i.id).join(),
  'a,c'
);
assert.equal(
  filterHireSearchItems(items, { areas: ['Sandton', 'Randburg'] }).length,
  3
);
assert.equal(
  filterHireSearchItems(items, { types: ['plant_machinery'] }).length,
  1
);
assert.equal(
  filterHireSearchItems(items, { companies: ['srm:10'] }).length,
  2
);
assert.equal(toggleListValue(['Sandton'], 'Randburg').join(','), 'Sandton,Randburg');
assert.deepEqual(toggleListValue(['Sandton'], 'Sandton'), []);

const pins = companyPinsFromItems(items);
assert.equal(pins.length, 2);
const acme = pins.find((p) => p.key === 'srm:10');
assert.equal(acme?.item_count, 2);
assert.equal(acme?.min_rate_zar, 120);
assert.ok(acme?.position[0]);

const jhb: { lat: number; lng: number } = { lat: -26.2041, lng: 28.0473 };
assert.ok(haversineKm(jhb, { lat: -26.1076, lng: 28.0567 }) < 20);
const near = nearestHireAreas(jhb, ['Cape Town', 'Sandton', 'Durban']);
assert.equal(near[0], 'Sandton');

const sorted = sortHireItemsByDistance(items, jhb);
assert.ok(sorted[0].location === 'Sandton' || sorted[0].location === 'Randburg');

console.log('hire-search tests ok');
