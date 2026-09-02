/**
 * Gym calendar: edit a series (incl. room/coach) and pick room + member on PT.
 * Run: npx --yes tsx lib/fitness/gym-calendar-series-room.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { clinicRoomNames } from '../clinic/clinic-rooms';
import {
  applySeriesPatch,
  resolveSeriesEditIds,
} from '../services/advisor-series-edit';

assert.deepEqual(
  clinicRoomNames(['Studio A', { name: 'Spin room' }, 'Studio A'] as unknown),
  ['Studio A', 'Spin room']
);

const series = [
  { id: 'a1', date: '2026-09-01', series_id: 'ser1' },
  { id: 'a2', date: '2026-09-08', series_id: 'ser1' },
  { id: 'a3', date: '2026-09-15', series_id: 'ser1' },
];
assert.deepEqual(resolveSeriesEditIds(series, 'a2', 'one'), ['a2']);
assert.deepEqual(resolveSeriesEditIds(series, 'a2', 'future'), ['a2', 'a3']);
assert.deepEqual(resolveSeriesEditIds(series, 'a2', 'all'), [
  'a1',
  'a2',
  'a3',
]);

const patched = applySeriesPatch(
  { id: 'a2', room: 'Studio A', coach_id: 'c1', start_time: '06:00' },
  { room: 'Court 1', coach_id: 'c9', start_time: '07:00' }
);
assert.equal(patched.room, 'Court 1');
assert.equal(patched.coach_id, 'c9');
assert.equal(patched.start_time, '07:00');

const cal = readFileSync(
  resolve('app/dashboard/fitgraph/calendar/page.tsx'),
  'utf8'
);
assert.match(cal, /seriesScope/);
assert.match(cal, /Entire series/);
assert.match(cal, /This and future/);
assert.match(cal, /clinicRoomNames/);
assert.match(cal, /Private client \(member\)/);
assert.match(cal, /Floor → Rooms/);
assert.match(cal, /form\.session_kind === 'private_pt'/);
assert.match(cal, /bookMembersOntoSession\(s\.id, \[form\.client_id\]\)/);
assert.doesNotMatch(
  cal,
  /room: isAnchor \? form\.room \|\| null : row\.room/
);

console.log('gym-calendar-series-room.test.ts ok');
