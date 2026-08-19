/**
 * Run: npx --yes tsx lib/services/booking-feedback.test.ts
 */
import assert from 'node:assert/strict';
import {
  bookingEligibleForClientRating,
  ensureClientRatingTokens,
  sessionHasEnded,
} from './booking-feedback';

assert.equal(sessionHasEnded('2026-08-18', '18:00', '2026-08-19T08:00:00Z'), true);
assert.equal(sessionHasEnded('2026-08-20', '06:00', '2026-08-19T08:00:00Z'), false);
assert.equal(
  sessionHasEnded('2026-08-19', '07:00', new Date('2026-08-19T08:00:00')),
  true
);

assert.equal(
  bookingEligibleForClientRating({
    status: 'attended',
    date: '2026-08-19',
    startTime: '06:00',
    now: '2026-08-19T08:00:00Z',
  }),
  true
);
assert.equal(
  bookingEligibleForClientRating({
    status: 'booked',
    date: '2026-08-19',
    startTime: '06:00',
    now: '2026-08-19T08:00:00',
  }),
  true
);
assert.equal(
  bookingEligibleForClientRating({
    status: 'booked',
    date: '2026-08-20',
    startTime: '06:00',
    now: '2026-08-19T08:00:00Z',
  }),
  false
);
assert.equal(
  bookingEligibleForClientRating({
    status: 'waitlist',
    date: '2026-08-01',
    startTime: '06:00',
    now: '2026-08-19T08:00:00Z',
  }),
  false
);
assert.equal(
  bookingEligibleForClientRating({
    status: 'attended',
    submittedAt: '2026-08-19T07:00:00Z',
    date: '2026-08-19',
    startTime: '06:00',
  }),
  false
);

const rows = [
  {
    id: 'b1',
    status: 'attended',
    session_id: 's1',
  },
  {
    id: 'b2',
    status: 'booked',
    session_id: 's2',
  },
];
const dirty = ensureClientRatingTokens(
  rows,
  (b) =>
    b.session_id === 's1'
      ? { date: '2026-08-18', start_time: '06:00' }
      : { date: '2026-08-22', start_time: '06:00' },
  '2026-08-19T10:00:00Z'
);
assert.equal(dirty, true);
assert.ok(rows[0].feedback_token);
assert.equal(rows[1].feedback_token, undefined);

console.log('booking-feedback.test.ts ok');
