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

const allocStore = emptyFitgraphStore();
allocStore.sessions = store.sessions;
allocStore.clients = [
  { id: 'c9', code: 'W-9', name: 'Sam', created_at: '2099-01-01' } as never,
];
const alloc = applyMemberClassRsvp(allocStore, {
  bookingId: 'alloc_s1',
  clientId: 'c9',
  coming: true,
  now: '2099-01-10T08:00:00.000Z',
});
assert.equal(alloc.ok, true);
if (!alloc.ok) throw new Error('alloc rsvp failed');
assert.equal(alloc.booking.rsvp, 'coming');
assert.equal(alloc.booking.session_id, 's1');
assert.equal(allocStore.bookings[0].id, alloc.booking.id);

const skipAlloc = applyMemberClassRsvp(allocStore, {
  bookingId: alloc.booking.id,
  clientId: 'c9',
  coming: false,
  sessionId: 's1',
  now: '2099-01-10T09:00:00.000Z',
});
assert.equal(skipAlloc.ok, true);
if (skipAlloc.ok) {
  assert.equal(skipAlloc.booking.rsvp, 'not_coming');
  assert.equal(skipAlloc.booking.status, 'cancelled');
}

const tzStore = emptyFitgraphStore();
tzStore.settings = {
  ...tzStore.settings,
  timezone: 'Africa/Johannesburg',
};
const todayJhb = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Africa/Johannesburg',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date('2026-08-24T22:30:00.000Z'));
tzStore.sessions = [
  {
    id: 's-today',
    date: todayJhb,
    start_time: '06:00',
    status: 'scheduled',
    created_at: '2026-08-01',
  } as never,
];
tzStore.bookings = [
  {
    id: 'b-today',
    session_id: 's-today',
    client_id: 'c1',
    status: 'booked',
    booked_at: '2026-08-23',
  },
];
const tonight = applyMemberClassRsvp(tzStore, {
  bookingId: 'b-today',
  clientId: 'c1',
  coming: true,
  now: '2026-08-24T22:30:00.000Z',
});
assert.equal(tonight.ok, true);
if (tonight.ok) assert.equal(tonight.booking.rsvp, 'coming');

console.log('member-class-rsvp.test.ts ok');
