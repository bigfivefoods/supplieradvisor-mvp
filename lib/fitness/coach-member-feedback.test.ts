/**
 * Run: npx --yes tsx lib/fitness/coach-member-feedback.test.ts
 */
import assert from 'node:assert/strict';
import { emptyFitgraphStore } from './fitgraph';
import { applyCoachMemberClassFeedback } from './coach-member-feedback';

const store = emptyFitgraphStore();
store.clients = [
  {
    id: 'c1',
    code: 'M1',
    name: 'Alex',
    active: true,
    created_at: '2026-01-01',
  } as never,
];
store.bookings = [
  {
    id: 'b1',
    session_id: 's1',
    client_id: 'c1',
    status: 'attended',
    booked_at: '2026-01-01',
  },
];
store.sessions = [
  {
    id: 's1',
    class_type_id: 'ct1',
    date: '2026-01-02',
    start_time: '06:00',
    status: 'scheduled',
    created_at: '2026-01-01',
  } as never,
];
store.class_types = [
  { id: 'ct1', code: 'STR', name: 'Strength', created_at: '2026-01-01' } as never,
];

const miss = applyCoachMemberClassFeedback(store, {
  bookingId: 'b1',
  coachId: 'coach1',
});
assert.equal(miss.ok, false);

const ok = applyCoachMemberClassFeedback(store, {
  bookingId: 'b1',
  coachId: 'coach1',
  coachName: 'Jordan',
  comment: 'Solid effort',
  feeling: 4,
  rating: 5,
});
assert.equal(ok.ok, true);
if (ok.ok) {
  assert.equal(ok.booking.coach_feedback, 'Solid effort');
  assert.equal(ok.booking.coach_member_feeling, 4);
  assert.equal(ok.booking.coach_member_rating, 5);
}
assert.equal((store.journey_events || [])[0]?.client_id, 'c1');
assert.match(String((store.journey_events || [])[0]?.body), /Coach rating 5\/5/);

console.log('coach-member-feedback.test.ts ok');
