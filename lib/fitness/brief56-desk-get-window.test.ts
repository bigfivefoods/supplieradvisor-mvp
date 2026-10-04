/**
 * Run: npx --yes tsx lib/fitness/brief56-desk-get-window.test.ts
 */
import assert from 'node:assert/strict';
import { emptyFitgraphStore } from './fitgraph';
import { fitgraphDeskGetWindow } from './fitgraph-desk-get-window';

const now = new Date('2026-09-03T08:00:00.000Z');

const store = emptyFitgraphStore();
store.sessions.push(
  {
    id: 's_old',
    class_type_id: 'ct1',
    date: '2026-08-01',
    start_time: '07:00',
    status: 'completed',
    created_at: '2026-08-01T00:00:00Z',
  },
  {
    id: 's_in_window',
    class_type_id: 'ct1',
    date: '2026-09-10',
    start_time: '07:00',
    status: 'scheduled',
    created_at: '2026-09-01T00:00:00Z',
  },
  {
    id: 's_far_future',
    class_type_id: 'ct1',
    date: '2026-12-20',
    start_time: '07:00',
    status: 'scheduled',
    created_at: '2026-09-01T00:00:00Z',
  }
);
store.bookings.push(
  {
    id: 'b_old_attended',
    session_id: 's_old',
    client_id: 'c1',
    status: 'attended',
    booked_at: '2026-08-01T00:00:00Z',
  },
  {
    id: 'b_old_cancelled',
    session_id: 's_old',
    client_id: 'c1',
    status: 'cancelled',
    booked_at: '2026-08-01T00:00:00Z',
  },
  {
    id: 'b_old_no_show',
    session_id: 's_old',
    client_id: 'c1',
    status: 'no_show',
    booked_at: '2026-08-01T00:00:00Z',
  },
  {
    id: 'b_keep_booked',
    session_id: 's_old',
    client_id: 'c1',
    status: 'booked',
    booked_at: '2026-08-01T00:00:00Z',
  },
  {
    id: 'b_keep_waitlist',
    session_id: 's_old',
    client_id: 'c1',
    status: 'waitlist',
    booked_at: '2026-08-01T00:00:00Z',
  },
  {
    id: 'b_keep_pending_feedback',
    session_id: 's_old',
    client_id: 'c1',
    status: 'attended',
    feedback_token: 'tok_1',
    booked_at: '2026-08-01T00:00:00Z',
  },
  {
    id: 'b_keep_window',
    session_id: 's_in_window',
    client_id: 'c1',
    status: 'attended',
    booked_at: '2026-09-01T00:00:00Z',
  },
  {
    id: 'b_drop_future',
    session_id: 's_far_future',
    client_id: 'c1',
    status: 'attended',
    booked_at: '2026-09-01T00:00:00Z',
  }
);
store.check_ins.push(
  {
    id: 'ci_old',
    client_id: 'c1',
    date: '2026-08-10',
    created_at: '2026-08-10T00:00:00Z',
  },
  {
    id: 'ci_keep_start',
    client_id: 'c1',
    date: '2026-08-20',
    created_at: '2026-08-20T00:00:00Z',
  },
  {
    id: 'ci_keep_today',
    client_id: 'c1',
    date: '2026-09-03',
    created_at: '2026-09-03T00:00:00Z',
  },
  {
    id: 'ci_drop_future',
    client_id: 'c1',
    date: '2026-09-04',
    created_at: '2026-09-04T00:00:00Z',
  }
);
store.movements = [{ id: 'm1', name: 'Squat' } as never];
store.watch_sessions = [{ id: 'w1' } as never];

const desk = fitgraphDeskGetWindow(store, { now });
assert.deepEqual(
  desk.bookings.map((b) => b.id).sort(),
  [
    'b_keep_booked',
    'b_keep_pending_feedback',
    'b_keep_waitlist',
    'b_keep_window',
  ].sort()
);
assert.deepEqual(
  desk.check_ins.map((c) => c.id).sort(),
  ['ci_keep_start', 'ci_keep_today'].sort()
);
assert.equal(desk.movements?.length, 0);
assert.equal(desk.watch_sessions?.length, 0);

const withHistory = fitgraphDeskGetWindow(store, { include: 'history', now });
assert.equal(withHistory.bookings.length, store.bookings.length);
assert.equal(withHistory.check_ins.length, store.check_ins.length);
assert.equal(withHistory.movements?.length, 0);

const withAllParams = fitgraphDeskGetWindow(store, {
  bookings: 'all',
  checkIns: 'all',
  now,
});
assert.equal(withAllParams.bookings.length, store.bookings.length);
assert.equal(withAllParams.check_ins.length, store.check_ins.length);

const withLibrary = fitgraphDeskGetWindow(store, { include: 'library', now });
assert.equal(withLibrary.bookings.length, store.bookings.length);
assert.equal(withLibrary.check_ins.length, store.check_ins.length);
assert.equal(withLibrary.movements?.length, 1);
assert.equal(withLibrary.watch_sessions?.length, 1);

console.log('brief56-desk-get-window.test.ts ok');
