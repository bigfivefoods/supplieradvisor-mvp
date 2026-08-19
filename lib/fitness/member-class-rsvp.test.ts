/**
 * Run: npx --yes tsx lib/fitness/member-class-rsvp.test.ts
 */
import assert from 'node:assert/strict';
import { emptyFitgraphStore } from './fitgraph';
import { applyMemberClassRsvp } from './member-class-rsvp';

const store = emptyFitgraphStore();
store.sessions = [
  {
    id: 's1',
    date: '2099-01-15',
    start_time: '06:00',
    status: 'scheduled',
    created_at: '2099-01-01',
  } as never,
];
store.bookings = [
  {
    id: 'b1',
    session_id: 's1',
    client_id: 'c1',
    status: 'booked',
    booked_at: '2099-01-01',
  },
  {
    id: 'b2',
    session_id: 's1',
    client_id: 'c2',
    status: 'waitlist',
    booked_at: '2099-01-02',
  },
];

const coming = applyMemberClassRsvp(store, {
  bookingId: 'b1',
  clientId: 'c1',
  coming: true,
  now: '2099-01-10T08:00:00.000Z',
});
assert.equal(coming.ok, true);
if (coming.ok) {
  assert.equal(coming.booking.rsvp, 'coming');
  assert.equal(coming.booking.status, 'booked');
}

const skip = applyMemberClassRsvp(store, {
  bookingId: 'b1',
  clientId: 'c1',
  coming: false,
  now: '2099-01-10T08:00:00.000Z',
});
assert.equal(skip.ok, true);
if (skip.ok) {
  assert.equal(skip.booking.rsvp, 'not_coming');
  assert.equal(skip.booking.status, 'cancelled');
  assert.equal(skip.promoted?.id, 'b2');
  assert.equal(skip.promoted?.status, 'booked');
}

console.log('member-class-rsvp.test.ts ok');
