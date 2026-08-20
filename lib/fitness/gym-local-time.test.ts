/**
 * Run: npx --yes tsx lib/fitness/gym-local-time.test.ts
 */
import assert from 'node:assert/strict';
import {
  hmInZone,
  isoDateInZone,
  normalizeHm,
  sessionIsUpcoming,
} from './gym-local-time';

assert.equal(normalizeHm('5:00'), '05:00');
assert.equal(normalizeHm('17:30:00'), '17:30');
assert.equal(normalizeHm('5:00pm'), '17:00');
assert.equal(isoDateInZone('UTC', new Date('2026-08-20T22:00:00.000Z')), '2026-08-20');
assert.equal(
  isoDateInZone('Africa/Johannesburg', new Date('2026-08-20T22:00:00.000Z')),
  '2026-08-21'
);
assert.equal(hmInZone('UTC', new Date('2026-08-20T07:05:00.000Z')), '07:05');

const now = new Date('2026-08-20T06:00:00.000Z'); // 08:00 SAST
assert.equal(
  sessionIsUpcoming('2026-08-20', '09:00', {
    timeZone: 'Africa/Johannesburg',
    now,
  }),
  true
);
assert.equal(
  sessionIsUpcoming('2026-09-03', '05:00', {
    timeZone: 'Africa/Johannesburg',
    now,
  }),
  true
);
assert.equal(
  sessionIsUpcoming('2026-08-19', '17:00', {
    timeZone: 'Africa/Johannesburg',
    now,
  }),
  false
);
assert.equal(
  sessionIsUpcoming('2027-01-05', '05:00', {
    timeZone: 'Africa/Johannesburg',
    now,
  }),
  true
);

console.log('gym-local-time.test.ts ok');
