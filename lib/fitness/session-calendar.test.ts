/**
 * Run: npx --yes tsx lib/fitness/session-calendar.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  classCalendarPeople,
  sessionCalendarDescription,
  sessionCalendarRecipients,
} from './session-calendar';
import {
  buildSessionIcs,
  createSessionsFromTemplate,
  emptyFitgraphStore,
  type FitgraphStore,
} from './fitgraph';

const who = classCalendarPeople({
  roster: [
    { name: 'Ann', status: 'booked', rsvp: 'coming' },
    { name: 'Sipho', status: 'booked', rsvp: null },
  ],
});
assert.deepEqual(who.planned, ['Ann', 'Sipho']);
assert.deepEqual(who.coming, ['Ann']);
assert.match(who.person, /Ann/);
assert.match(who.person, /Sipho/);
assert.match(who.comingLabel, /Coming: Ann/);
assert.doesNotMatch(who.person, /^Class$/);

const desc = sessionCalendarDescription({
  className: 'HIIT',
  date: '2026-09-01',
  startTime: '06:00',
  location: 'Studio 1',
  coachName: 'Thandi',
  classPlan: 'Warm-up\nStrength',
});
assert.match(desc, /Class Plan:/);
assert.match(desc, /Warm-up/);
assert.match(desc, /Thandi/);

const ics = buildSessionIcs({
  sessionId: 'ses_1',
  title: 'HIIT',
  date: '2026-09-01',
  start_time: '06:00',
  duration_min: 45,
  description: desc,
  method: 'REQUEST',
});
assert.match(ics, /UID:ses_1@supplieradvisor\.fitgraph/);
assert.match(ics, /METHOD:REQUEST/);
assert.match(ics, /Class Plan:/);
const icsPub = buildSessionIcs({
  sessionId: 'ses_1',
  title: 'HIIT',
  date: '2026-09-01',
  start_time: '06:00',
});
assert.match(icsPub, /METHOD:PUBLISH/);
assert.equal(
  ics.match(/UID:ses_1@supplieradvisor\.fitgraph/g)?.length,
  icsPub.match(/UID:ses_1@supplieradvisor\.fitgraph/g)?.length
);

const store: FitgraphStore = {
  ...emptyFitgraphStore(),
  coaches: [
    {
      id: 'coh_1',
      name: 'Thandi',
      email: 'thandi@vuka.test',
      code: 'T',
      created_at: '',
      updated_at: '',
    } as never,
  ],
  clients: [
    {
      id: 'c1',
      name: 'Ann',
      email: 'ann@vuka.test',
      code: 'A',
      created_at: '',
      updated_at: '',
    } as never,
    {
      id: 'c2',
      name: 'No Mail',
      email: '',
      code: 'N',
      created_at: '',
      updated_at: '',
    } as never,
  ],
  sessions: [
    {
      id: 'ses_1',
      class_type_id: 'ct1',
      coach_id: 'coh_1',
      date: '2026-09-01',
      start_time: '06:00',
      status: 'scheduled',
      created_at: '',
    } as never,
  ],
  bookings: [
    {
      id: 'bk1',
      session_id: 'ses_1',
      client_id: 'c1',
      status: 'booked',
      booked_at: '',
    } as never,
    {
      id: 'bk2',
      session_id: 'ses_1',
      client_id: 'c2',
      status: 'booked',
      booked_at: '',
    } as never,
  ],
};
const recips = sessionCalendarRecipients(store, store.sessions[0]);
assert.ok(recips.includes('thandi@vuka.test'));
assert.ok(recips.includes('ann@vuka.test'));
assert.ok(!recips.some((e) => !e.includes('@')));

{
  const gym = emptyFitgraphStore();
  gym.class_types = [
    {
      id: 'ct1',
      name: 'HIIT',
      duration_min: 45,
      capacity: 20,
      created_at: '',
    } as never,
  ];
  const created = createSessionsFromTemplate(
    gym,
    {
      class_type_id: 'ct1',
      coach_id: 'coh_1',
      date: '2026-09-01',
      start_time: '06:00',
      class_plan: 'Warm-up',
    },
    { frequency: 'weekly', count: 2, interval: 1 }
  );
  assert.equal(created.length, 2);
  assert.equal(created[0].class_plan, 'Warm-up');
  assert.equal(created[1].class_plan, 'Warm-up');
  created[0].class_plan = 'This date only';
  assert.equal(created[1].class_plan, 'Warm-up');
  assert.notEqual(created[0].id, created[1].id);
}

const coachPage = readFileSync(
  resolve('app/coach/fitgraph/[token]/page.tsx'),
  'utf8'
);
assert.match(coachPage, /Class Plan/);
assert.match(coachPage, /classCalendarPeople/);
assert.match(coachPage, /update_session/);
assert.doesNotMatch(
  coachPage.split('const toCalEvent')[1]?.slice(0, 900) || '',
  /person:\s*kind === 'workout' \? 'Workout'/
);

const memberPage = readFileSync(
  resolve('app/member/fitgraph/[token]/page.tsx'),
  'utf8'
);
assert.match(memberPage, /plan=\{/);
assert.match(memberPage, /onRate=/);
assert.match(memberPage, /delete_goal/);

const actCoach = readFileSync(
  resolve('app/api/public/fitgraph/coach/route.ts'),
  'utf8'
);
assert.match(actCoach, /emailSessionCalendar/);
assert.match(actCoach, /session_id: session\.id/);
assert.match(actCoach, /class_plan/);

const goals = readFileSync(resolve('lib/fitness/member-goals.ts'), 'utf8');
assert.match(goals, /removeGoalFromStore/);

const goalsUi = readFileSync(
  resolve('components/fitness/MemberGoalsPanel.tsx'),
  'utf8'
);
assert.match(goalsUi, /onDeleteGoal/);
assert.doesNotMatch(goalsUi, /flex gap-2[\s\S]{0,200}Log/);
assert.doesNotMatch(goalsUi, /Hide this goal/);

console.log('session-calendar.test.ts ok');
