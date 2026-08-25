/**
 * Run: npx --yes tsx lib/fitness/apply-gym-attendance.test.ts
 */
import assert from 'node:assert/strict';
import { emptyFitgraphStore } from './fitgraph';
import { applyGymAttendanceMark } from './apply-gym-attendance';

const store = emptyFitgraphStore();
store.clients.push({
  id: 'c1',
  name: 'Pat',
  created_at: '2026-01-01T00:00:00Z',
} as never);
store.sessions.push({
  id: 's1',
  class_type_id: 'ct1',
  date: '2026-08-24',
  start_time: '06:00',
  status: 'scheduled',
  created_at: '2026-08-01T00:00:00Z',
} as never);
store.bookings.push({
  id: 'b1',
  session_id: 's1',
  client_id: 'c1',
  status: 'booked',
  booked_at: '2026-08-23T00:00:00Z',
});

const miss = applyGymAttendanceMark(store, {
  bookingId: 'nope',
  status: 'attended',
});
assert.equal(miss.ok, false);

const bad = applyGymAttendanceMark(store, {
  bookingId: 'b1',
  status: 'maybe',
});
assert.equal(bad.ok, false);

const first = applyGymAttendanceMark(store, {
  bookingId: 'b1',
  status: 'attended',
  now: '2026-08-24T07:00:00Z',
});
assert.equal(first.ok, true);
if (first.ok) {
  assert.equal(first.newlyAttended, true);
  assert.equal(first.booking.status, 'attended');
  assert.ok(first.booking.feedback_token);
}
assert.equal(store.sessions[0].status, 'completed');

const again = applyGymAttendanceMark(store, {
  bookingId: 'b1',
  status: 'attended',
  now: '2026-08-24T07:01:00Z',
});
assert.equal(again.ok, true);
if (again.ok) assert.equal(again.newlyAttended, false);

const noShow = applyGymAttendanceMark(store, {
  bookingId: 'b1',
  status: 'no_show',
});
assert.equal(noShow.ok, true);
assert.equal(store.bookings[0].status, 'no_show');

const allocStore = emptyFitgraphStore();
allocStore.clients.push({
  id: 'c2',
  name: 'Sam',
  created_at: '2026-01-01T00:00:00Z',
} as never);
allocStore.sessions.push({
  id: 's1',
  class_type_id: 'ct1',
  date: '2026-08-24',
  start_time: '06:00',
  status: 'scheduled',
  created_at: '2026-08-01T00:00:00Z',
} as never);
const alloc = applyGymAttendanceMark(allocStore, {
  bookingId: 'alloc_s1_c2',
  status: 'attended',
  now: '2026-08-24T07:00:00Z',
  sessionId: 's1',
  clientId: 'c2',
});
assert.equal(alloc.ok, true);
assert.equal(allocStore.bookings.length, 1);
assert.equal(allocStore.bookings[0].client_id, 'c2');
assert.equal(allocStore.bookings[0].session_id, 's1');
assert.equal(allocStore.bookings[0].status, 'attended');

allocStore.bookings.push({
  id: 'dup',
  session_id: 's1',
  client_id: 'c2',
  status: 'booked',
  booked_at: '2026-08-23T00:00:00Z',
});
const againAlloc = applyGymAttendanceMark(allocStore, {
  bookingId: 'alloc_s1_c2',
  status: 'no_show',
  now: '2026-08-24T07:05:00Z',
  sessionId: 's1',
  clientId: 'c2',
});
assert.equal(againAlloc.ok, true);
assert.equal(allocStore.bookings.length, 1);
assert.equal(allocStore.bookings[0].status, 'no_show');

console.log('apply-gym-attendance.test.ts ok');
