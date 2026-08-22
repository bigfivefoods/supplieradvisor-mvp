/**
 * Run: npx --yes tsx lib/hire/true-availability.test.ts
 */
import assert from 'node:assert/strict';
import type { HireBooking, HireItem, HireUnit, HiregraphStore } from './hiregraph';
import {
  findAvailableUnits,
  occupyWindow,
  unitIsFree,
  windowsOverlap,
} from './true-availability';

const item: HireItem = {
  id: 'itm_castle',
  code: 'JC-1',
  title: 'Jumping castle',
  category_id: 'kids_party',
  rate_zar: 850,
  setup_minutes: 30,
  packup_minutes: 30,
  cleaning_minutes: 120,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

const unitA: HireUnit = {
  id: 'un_a',
  item_id: 'itm_castle',
  label: 'Castle #1',
  created_at: item.created_at,
  updated_at: item.updated_at,
};
const unitB: HireUnit = {
  id: 'un_b',
  item_id: 'itm_castle',
  label: 'Castle #2',
  created_at: item.created_at,
  updated_at: item.updated_at,
};

function store(bookings: HireBooking[]): HiregraphStore {
  return {
    version: 3,
    model: 'rental_marketplace',
    customer_kyc: {},
    customer_portals: {},
    settings: {
      default_setup_minutes: 30,
      default_packup_minutes: 30,
      default_cleaning_minutes: 120,
    },
    items: [item],
    units: [unitA, unitB],
    bookings,
    handovers: [],
  };
}

const friday: HireBooking = {
  id: 'bk_fri',
  code: 'H1',
  item_id: 'itm_castle',
  unit_id: 'un_a',
  status: 'paid',
  start_date: '2026-08-21',
  end_date: '2026-08-21',
  created_at: item.created_at,
  updated_at: item.updated_at,
};

const a = occupyWindow({
  rentalStart: new Date('2026-08-22T10:00:00'),
  rentalEnd: new Date('2026-08-22T14:00:00'),
  setupMin: 30,
  packupMin: 30,
  cleaningMin: 120,
});
const b = occupyWindow({
  rentalStart: new Date('2026-08-22T16:00:00'),
  rentalEnd: new Date('2026-08-22T18:00:00'),
  setupMin: 30,
  packupMin: 30,
  cleaningMin: 120,
});
assert.equal(windowsOverlap(a, b), true, 'cleaning on first job overlaps second');

const sameEvening = findAvailableUnits(store([friday]), {
  itemId: 'itm_castle',
  rentalStart: new Date('2026-08-21T16:00:00'),
  rentalEnd: new Date('2026-08-21T20:00:00'),
});
assert.equal(sameEvening.ok, true);
assert.equal(sameEvening.units.length, 1);
assert.equal(
  sameEvening.units[0].id,
  'un_b',
  'castle #1 still in pack-up / cleaning from the afternoon hire'
);

assert.equal(
  unitIsFree(
    store([friday]),
    unitA,
    occupyWindow({
      rentalStart: new Date('2026-08-21T19:00:00'),
      rentalEnd: new Date('2026-08-21T20:00:00'),
      setupMin: 30,
      packupMin: 30,
      cleaningMin: 120,
    })
  ),
  false,
  'same unit cannot take an evening job after Friday hire'
);

const two = findAvailableUnits(store([]), {
  itemId: 'itm_castle',
  rentalStart: new Date('2026-08-22T10:00:00'),
  rentalEnd: new Date('2026-08-22T14:00:00'),
  qty: 2,
});
assert.equal(two.ok, true);
assert.equal(two.units.length, 2);

console.log('true-availability.test.ts ok');
