/**
 * Gym calendar colours (class + coach) and PT rate / all-members picker.
 * Run: npx --yes tsx lib/fitness/gym-calendar-colors-rates.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { emptyFitgraphStore } from './fitgraph';
import {
  formatAgreedRateZar,
  gymCalendarPaint,
} from './gym-calendar-color';
import {
  eventColorStyle,
  hexToRgb,
  normalizeEventHex,
  rgbToHex,
} from '../schedule/event-color';
import { applySeriesPatch } from '../services/advisor-series-edit';

assert.equal(normalizeEventHex('#E8E830'), '#e8e830');
assert.equal(normalizeEventHex('10B981'), '#10b981');
assert.equal(normalizeEventHex('nope'), null);
assert.equal(rgbToHex(232, 232, 48), '#e8e830');
assert.deepEqual(hexToRgb('#e8e830'), { r: 232, g: 232, b: 48 });
assert.equal(formatAgreedRateZar(650), 'R650');
assert.equal(eventColorStyle('#10B981').borderColor, '#10b981');

const store = emptyFitgraphStore();
store.class_types.push({
  id: 'cls_hiit',
  code: 'HIIT',
  name: 'HIIT',
  color: '#0EA5E9',
  created_at: '2026-01-01T00:00:00.000Z',
});
store.coaches.push({
  id: 'coh_pat',
  code: 'PAT',
  name: 'Pat',
  specialties: [],
  active: true,
  color: '#F43F5E',
  created_at: '2026-01-01T00:00:00.000Z',
});
const paint = gymCalendarPaint(store, {
  id: 'ses1',
  class_type_id: 'cls_hiit',
  coach_id: 'coh_pat',
  date: '2026-09-02',
  start_time: '06:00',
  status: 'scheduled',
  created_at: '2026-01-01T00:00:00.000Z',
});
assert.equal(paint.color, '#f43f5e');
assert.equal(paint.stripeColor, undefined);

const noCoach = gymCalendarPaint(store, {
  id: 'ses2',
  class_type_id: 'cls_hiit',
  date: '2026-09-02',
  start_time: '07:00',
  status: 'scheduled',
  created_at: '2026-01-01T00:00:00.000Z',
});
assert.equal(noCoach.color, '#0ea5e9');

const patched = applySeriesPatch(
  { id: 's', agreed_rate_zar: 400 },
  { agreed_rate_zar: 650 }
);
assert.equal(patched.agreed_rate_zar, 650);

const cal = readFileSync(
  resolve('app/dashboard/fitgraph/calendar/page.tsx'),
  'utf8'
);
assert.match(cal, /gymCalendarPaint/);
assert.match(cal, /Diary colours/);
assert.match(cal, /GymDiaryColorEditor/);
assert.match(cal, /\/dashboard\/fitgraph\/coaches/);
assert.match(cal, /coach's calendar colour/);
assert.doesNotMatch(cal, /onSaveCoach/);
assert.match(cal, /Add member…/);
assert.match(cal, /Agreed rate \(ZAR\)/);
assert.match(cal, /store\.clients/);
assert.match(cal, /save_calendar_sessions/);
assert.doesNotMatch(cal, /Private client \(member\)/);
assert.doesNotMatch(cal, /entity: 'clients'/);

const classes = readFileSync(
  resolve('app/dashboard/fitgraph/classes/page.tsx'),
  'utf8'
);
assert.match(classes, /GymColorSwatch/);
assert.match(classes, /color: form\.color/);

const swatch = readFileSync(
  resolve('components/fitness/GymColorSwatch.tsx'),
  'utf8'
);
assert.match(swatch, /Spectrum/);
assert.match(swatch, /rgbToHex/);
assert.match(swatch, /GymDiaryColorEditor/);

const coaches = readFileSync(
  resolve('app/dashboard/fitgraph/coaches/page.tsx'),
  'utf8'
);
assert.match(coaches, /GymColorSwatch/);
assert.match(coaches, /Calendar settings/);
assert.match(coaches, /fills every class this coach takes/);

const profile = readFileSync(
  resolve('components/fitness/GymMemberProfileDesk.tsx'),
  'utf8'
);
assert.match(profile, /Agreed rates/);
assert.match(profile, /private_rate_zar/);
assert.match(profile, /agreed_rate_zar/);

const api = readFileSync(
  resolve('app/api/fitness/fitgraph/route.ts'),
  'utf8'
);
assert.match(api, /agreed_rate_zar:/);
assert.match(api, /color:/);

const schedule = readFileSync(
  resolve('components/schedule/PracticeScheduleCalendar.tsx'),
  'utf8'
);
assert.match(schedule, /eventPaint/);
assert.match(schedule, /stripeColor/);

console.log('gym-calendar-colors-rates.test.ts ok');
