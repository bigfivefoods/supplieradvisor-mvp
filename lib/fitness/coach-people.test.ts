/**
 * Run: npx --yes tsx lib/fitness/coach-people.test.ts
 */
import assert from 'node:assert/strict';
import {
  buildCoachPortalPayload,
  emptyFitgraphStore,
  setGymOwnerEmails,
} from './fitgraph';

const store = emptyFitgraphStore();
const coach = {
  id: 'coh_1',
  code: 'C1',
  name: 'Jordan',
  active: true,
  created_at: '2026-01-01T00:00:00.000Z',
};
const otherCoach = {
  id: 'coh_2',
  code: 'C2',
  name: 'Sam',
  active: true,
  created_at: '2026-01-01T00:00:00.000Z',
};
store.coaches.push(coach, otherCoach);
store.class_types.push({
  id: 'ct_strength',
  code: 'STR',
  name: 'Morning strength',
  created_at: '2026-01-01T00:00:00.000Z',
});
store.clients.push(
  {
    id: 'mem_class',
    code: 'M1',
    name: 'Alex',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'mem_pt',
    code: 'M2',
    name: 'Ada',
    coach_id: 'coh_1',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'mem_other',
    code: 'M3',
    name: 'Whole gym',
    created_at: '2026-01-01T00:00:00.000Z',
  }
);
store.sessions.push(
  {
    id: 'ses_class',
    class_type_id: 'ct_strength',
    coach_id: 'coh_1',
    date: '2026-08-25',
    start_time: '06:00',
    session_kind: 'class',
    status: 'scheduled',
    created_at: '2026-08-01T00:00:00.000Z',
  },
  {
    id: 'ses_other',
    class_type_id: 'ct_strength',
    coach_id: 'coh_2',
    date: '2026-08-25',
    start_time: '07:00',
    session_kind: 'class',
    status: 'scheduled',
    created_at: '2026-08-01T00:00:00.000Z',
  }
);
store.bookings.push(
  {
    id: 'b1',
    session_id: 'ses_class',
    client_id: 'mem_class',
    status: 'booked',
    booked_at: '2026-08-20T00:00:00.000Z',
  },
  {
    id: 'b2',
    session_id: 'ses_other',
    client_id: 'mem_other',
    status: 'booked',
    booked_at: '2026-08-20T00:00:00.000Z',
  }
);

const portal = buildCoachPortalPayload(store, coach, '2026-08-24', '2026-08-31');
const ids = portal.members.map((m) => m.id).sort();
assert.deepEqual(ids, ['mem_class', 'mem_pt']);
const alex = portal.members.find((m) => m.id === 'mem_class');
const ada = portal.members.find((m) => m.id === 'mem_pt');
assert.equal(alex?.in_classes, true);
assert.equal(alex?.is_client, false);
assert.deepEqual(alex?.class_names, ['Morning strength']);
assert.equal(ada?.is_client, true);
assert.equal(ada?.in_classes, false);
assert.equal(portal.sees_all_people, false);

const ownerCoach = {
  ...coach,
  email: 'owner@gym.example',
};
store.settings.contact_email = 'owner@gym.example';
const ownerPortal = buildCoachPortalPayload(
  store,
  ownerCoach,
  '2026-08-24',
  '2026-08-31'
);
assert.equal(ownerPortal.sees_all_people, true);
assert.deepEqual(
  ownerPortal.members.map((m) => m.id).sort(),
  ['mem_class', 'mem_other', 'mem_pt']
);
assert.equal(
  ownerPortal.members.find((m) => m.id === 'mem_other')?.in_classes,
  true
);

store.settings.contact_email = 'hello@gym.example';
setGymOwnerEmails(store, ['jordan@gym.example']);
const viaTeam = buildCoachPortalPayload(
  store,
  { ...coach, email: 'jordan@gym.example' },
  '2026-08-24',
  '2026-08-31'
);
assert.equal(viaTeam.sees_all_people, true);
assert.equal(viaTeam.members.length, 3);

console.log('coach-people.test.ts ok');
