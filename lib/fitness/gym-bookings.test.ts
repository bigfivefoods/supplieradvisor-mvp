/**
 * Run: npx --yes tsx lib/fitness/gym-bookings.test.ts
 */
import assert from 'node:assert/strict';
import { emptyFitgraphStore } from './fitgraph';
import {
  dedupeFitgraphBookings,
  findSessionSeat,
  pickPreferredBooking,
} from './gym-bookings';

const store = emptyFitgraphStore();
store.bookings = [
  {
    id: 'old',
    session_id: 's1',
    client_id: 'c1',
    status: 'booked',
    booked_at: '2026-08-01T00:00:00Z',
  },
  {
    id: 'new',
    session_id: 's1',
    client_id: 'c1',
    status: 'attended',
    booked_at: '2026-08-02T00:00:00Z',
    updated_at: '2026-08-24T08:00:00Z',
  },
  {
    id: 'other',
    session_id: 's1',
    client_id: 'c2',
    status: 'booked',
    booked_at: '2026-08-01T00:00:00Z',
  },
];

const dropped = dedupeFitgraphBookings(store);
assert.equal(dropped, 1);
assert.equal(store.bookings.length, 2);
assert.equal(findSessionSeat(store, 's1', 'c1')?.id, 'new');
assert.equal(findSessionSeat(store, 's1', 'c1')?.status, 'attended');

const keep = pickPreferredBooking(store.bookings[0], store.bookings[0]);
assert.equal(keep.id, store.bookings[0].id);

store.bookings.push({
  id: 'also',
  session_id: 's1',
  client_id: 'c1',
  status: 'booked',
  booked_at: '2026-08-03T00:00:00Z',
});
assert.equal(dedupeFitgraphBookings(store), 1);
assert.equal(findSessionSeat(store, 's1', 'c1')?.id, 'new');

console.log('gym-bookings.test.ts ok');
