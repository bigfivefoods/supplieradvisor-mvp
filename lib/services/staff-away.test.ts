/**
 * Staff away / leave on Advisor diaries.
 * Run: npx --yes tsx lib/services/staff-away.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  applySessionKindRules,
  createSessionsFromTemplate,
  emptyFitgraphStore,
  ensureSystemClassTypes,
  sessionKindOf,
} from '@/lib/fitness/fitgraph';
import {
  SYS_COACH_AWAY_CODE,
  normalizeSessionKind,
  sessionKindLabel,
} from '@/lib/fitness/session-times';
import {
  awayUntilRecurrence,
  clashTitlesOnAwayDates,
  clinicPractitionerAwayOn,
  eachInclusiveDate,
  gymCoachAwayOn,
  staffAssignmentBlocked,
  staffAwayTitle,
} from './staff-away';

assert.equal(normalizeSessionKind('away'), 'away');
assert.equal(normalizeSessionKind('leave'), 'away');
assert.equal(sessionKindLabel('away'), 'Away');
assert.equal(staffAwayTitle('sick'), 'Away · Sick');

assert.deepEqual(eachInclusiveDate('2026-09-02', '2026-09-04'), [
  '2026-09-02',
  '2026-09-03',
  '2026-09-04',
]);
assert.equal(awayUntilRecurrence('2026-09-02', '2026-09-02'), null);
assert.deepEqual(awayUntilRecurrence('2026-09-02', '2026-09-05'), {
  frequency: 'daily',
  interval: 1,
  until: '2026-09-05',
  count: null,
});

const store = emptyFitgraphStore();
ensureSystemClassTypes(store);
assert.ok(store.class_types.some((c) => c.code === SYS_COACH_AWAY_CODE));
store.coaches.push({
  id: 'coh_pat',
  code: 'PAT',
  name: 'Pat',
  specialties: [],
  active: true,
  created_at: '2026-01-01T00:00:00.000Z',
});

const away = createSessionsFromTemplate(
  store,
  {
    class_type_id: '',
    session_kind: 'away',
    coach_id: 'coh_pat',
    date: '2026-09-02',
    start_time: '08:00',
    end_time: '17:00',
    personal_reason: 'sick',
    public: true,
  },
  { frequency: 'daily', interval: 1, until: '2026-09-04', count: null }
);
assert.equal(away.length, 3);
assert.equal(away[0].session_kind, 'away');
assert.equal(away[0].public, false);
assert.equal(away[0].capacity, 0);
assert.equal(away[0].personal_reason, 'sick');
assert.equal(sessionKindOf(store, away[0]), 'away');
assert.equal(applySessionKindRules('away').public, false);

store.sessions.push(...away);
assert.ok(gymCoachAwayOn(store.sessions, 'coh_pat', '2026-09-03'));
assert.equal(gymCoachAwayOn(store.sessions, 'coh_pat', '2026-09-05'), null);

const gate = staffAssignmentBlocked({
  personId: 'coh_pat',
  date: '2026-09-03',
  diaryAway: gymCoachAwayOn(store.sessions, 'coh_pat', '2026-09-03'),
});
assert.equal(gate.blocked, true);
assert.match(String(gate.reason), /away/i);

assert.equal(
  staffAssignmentBlocked({
    personId: 'coh_pat',
    date: '2026-09-10',
  }).blocked,
  false
);

const clashes = clashTitlesOnAwayDates(
  [
    { date: '2026-09-03', title: 'Bootcamp', status: 'scheduled' },
    { date: '2026-09-10', title: 'FSF', status: 'scheduled' },
  ],
  '2026-09-02',
  '2026-09-04'
);
assert.equal(clashes.length, 1);
assert.equal(clashes[0].title, 'Bootcamp');

assert.ok(
  clinicPractitionerAwayOn(
    [
      {
        id: 'apt_1',
        practitioner_id: 'prac_1',
        date: '2026-09-02',
        status: 'scheduled',
        appointment_kind: 'personal',
        personal_reason: 'leave',
      },
    ],
    'prac_1',
    '2026-09-02'
  )
);
assert.equal(
  clinicPractitionerAwayOn(
    [
      {
        id: 'apt_2',
        practitioner_id: 'prac_1',
        date: '2026-09-02',
        status: 'scheduled',
        appointment_kind: 'consult',
      },
    ],
    'prac_1',
    '2026-09-02'
  ),
  null
);

const kinds = readFileSync(resolve('lib/fitness/session-times.ts'), 'utf8');
assert.match(kinds, /Away \/ leave/);
const gymCal = readFileSync(
  resolve('app/dashboard/fitgraph/calendar/page.tsx'),
  'utf8'
);
assert.match(gymCal, /session_kind === 'away'/);
assert.match(gymCal, /personal_reason/);
const coachPwa = readFileSync(
  resolve('app/coach/fitgraph/[token]/page.tsx'),
  'utf8'
);
assert.match(coachPwa, /I'm away/);
const clinicFields = readFileSync(
  resolve('components/clinic/ClinicDiaryKindFields.tsx'),
  'utf8'
);
assert.match(clinicFields, /Last day away/);

console.log('staff-away.test.ts ok');
