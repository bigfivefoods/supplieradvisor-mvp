/**
 * Lightweight unit checks (node --import tsx or ts-node optional).
 * Run: npx --yes tsx lib/services/advisor-series-edit.test.ts
 */
import assert from 'node:assert/strict';
import {
  applySeriesPatch,
  resolveSeriesEditIds,
} from './advisor-series-edit';
import { promoteNextWaitlist } from './advisor-booking';
import {
  clinicDiaryMetrics,
  parseClinicianCompanyIdFromToken,
  issueClinicianPortalToken,
} from './clinician-portal';

const items = [
  { id: 'a1', date: '2026-08-01', series_id: 's1' },
  { id: 'a2', date: '2026-08-08', series_id: 's1' },
  { id: 'a3', date: '2026-08-15', series_id: 's1' },
  { id: 'b1', date: '2026-08-02', series_id: null as string | null },
];

assert.deepEqual(resolveSeriesEditIds(items, 'a2', 'one'), ['a2']);
assert.deepEqual(resolveSeriesEditIds(items, 'a2', 'future'), ['a2', 'a3']);
assert.deepEqual(resolveSeriesEditIds(items, 'a2', 'all'), ['a1', 'a2', 'a3']);
assert.deepEqual(resolveSeriesEditIds(items, 'b1', 'future'), ['b1']);
assert.deepEqual(resolveSeriesEditIds(items, 'b1', 'all'), ['b1']);

const patched = applySeriesPatch(
  { id: 'a1', date: '2026-08-01', start_time: '09:00', location: 'A' },
  { start_time: '10:30', location: 'B' },
  { isAnchor: true, newDate: '2026-08-02' }
);
assert.equal(patched.start_time, '10:30');
assert.equal(patched.location, 'B');
assert.equal(patched.date, '2026-08-02');

const timed = applySeriesPatch(
  { id: 'a1', start_time: '09:00', end_time: '09:45', session_kind: 'class' },
  { end_time: '10:30', session_kind: 'private_pt' }
);
assert.equal(timed.end_time, '10:30');
assert.equal(timed.session_kind, 'private_pt');

const roomed = applySeriesPatch(
  { id: 'a1', room: 'Studio A', coach_id: 'c1' },
  { room: 'Spin room', coach_id: 'c2' }
);
assert.equal(roomed.room, 'Spin room');
assert.equal(roomed.coach_id, 'c2');

const bookings = [
  { id: '1', status: 'cancelled', booked_at: '2026-01-01', appointment_id: 'a' },
  { id: '2', status: 'waitlist', booked_at: '2026-01-03', appointment_id: 'a' },
  { id: '3', status: 'waitlist', booked_at: '2026-01-02', appointment_id: 'a' },
];
const promoted = promoteNextWaitlist(
  bookings,
  (b) => b.appointment_id === 'a',
  '2026-01-04T00:00:00.000Z'
);
assert.equal(promoted?.id, '3');
assert.equal(promoted?.status, 'booked');

const tok = issueClinicianPortalToken(42, 'dentalgraph');
assert.equal(parseClinicianCompanyIdFromToken(tok), 42);

const m = clinicDiaryMetrics(
  {
    staff: [{ id: 's1', name: 'Dr A', active: true }],
    patients: [],
    services: [{ id: 'svc1', name: 'Checkup' }],
    appointments: [
      {
        id: 'a1',
        service_id: 'svc1',
        staff_id: 's1',
        date: '2026-08-01',
        start_time: '09:00',
        status: 'scheduled',
      },
      {
        id: 'a2',
        service_id: 'svc1',
        staff_id: 's1',
        date: '2026-08-02',
        start_time: '09:00',
        status: 'scheduled',
      },
    ],
    bookings: [
      {
        id: 'b1',
        appointment_id: 'a1',
        patient_id: 'p1',
        status: 'attended',
      },
    ],
  },
  '2026-08-01',
  '2026-08-31',
  'dentalgraph'
);
assert.equal(m.appointments, 2);
assert.equal(m.bookedSlots, 1);
assert.equal(m.fillRate, 50);
assert.equal(m.attended, 1);

console.log('advisor-series-edit + clinician-portal checks: ok');
