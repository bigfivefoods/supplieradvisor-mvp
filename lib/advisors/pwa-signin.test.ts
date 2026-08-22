/**
 * Run: npx --yes tsx lib/advisors/pwa-signin.test.ts
 */
import assert from 'node:assert/strict';
import {
  findRosterPersonForSignIn,
  findStaffForPortalSignIn,
  resolveAdvisorPwaLane,
} from './pwa-signin';
import { emptyFitgraphStore, findCoachForPortalSignIn } from '@/lib/fitness/fitgraph';

const patients = [
  {
    id: 'p1',
    name: 'Alex Patient',
    email: 'alex@example.com',
    portal_token: 'ppat_1',
  },
  { id: 'p2', name: 'Sam Inactive', email: 'sam@example.com', active: false },
];

assert.equal(
  findRosterPersonForSignIn(patients, {
    name: 'Alex Patient',
    email: 'alex@example.com',
  })?.id,
  'p1'
);
assert.equal(
  findRosterPersonForSignIn(patients, {
    name: 'alex patient',
    email: 'ALEX@example.com',
  })?.id,
  'p1'
);
assert.equal(
  findRosterPersonForSignIn(patients, {
    name: 'Sam Inactive',
    email: 'sam@example.com',
  }),
  null
);
assert.equal(
  findRosterPersonForSignIn(patients, {
    name: 'Nobody',
    email: 'alex@example.com',
  }),
  null
);

const invited = [
  {
    id: 'p3',
    name: 'Jordan Invite',
    invite_email: 'jordan@practice.com',
    portal_token: 'ppat_3',
  },
];
assert.equal(
  findRosterPersonForSignIn(invited, {
    name: 'Jordan Invite',
    email: 'jordan@practice.com',
  })?.id,
  'p3'
);

const hireCustomers = [
  {
    id: '88',
    name: 'Craig Customer',
    email: 'craig@example.com',
    invite_email: 'craig.hire@example.com',
    portal_token: 'hire_cust_1',
  },
];
assert.equal(
  findRosterPersonForSignIn(hireCustomers, {
    name: 'Craig Customer',
    email: 'craig@example.com',
  })?.id,
  '88'
);
assert.equal(
  findRosterPersonForSignIn(hireCustomers, {
    name: 'Craig Customer',
    email: 'craig.hire@example.com',
  })?.id,
  '88'
);

const gym = emptyFitgraphStore();
gym.coaches = [
  {
    id: 'c1',
    code: 'C1',
    name: 'Alex Coach',
    email: 'alex.coach@example.com',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
];
assert.equal(
  findCoachForPortalSignIn(gym, {
    name: 'Alex Coach',
    email: 'alex.coach@example.com',
  })?.id,
  'c1'
);
assert.equal(
  findCoachForPortalSignIn(gym, {
    email: 'alex.coach@example.com',
  })?.id,
  'c1'
);
assert.equal(
  findCoachForPortalSignIn(gym, {
    name: 'Wrong Name',
    email: 'alex.coach@example.com',
  }),
  null
);

assert.equal(
  findStaffForPortalSignIn(
    [
      {
        id: 'pr1',
        name: 'Dr Pat',
        email: 'pat@clinic.example',
      },
    ],
    { email: 'pat@clinic.example' }
  )?.id,
  'pr1'
);

assert.equal(
  (
    resolveAdvisorPwaLane({
      expectRole: 'staff',
      hasStaff: true,
      hasMember: true,
      staffLabel: 'Coach',
      staffListLabel: 'Coaches',
    }) as { ok: true; lane: 'staff' | 'member' }
  ).lane,
  'staff'
);
assert.equal(
  (
    resolveAdvisorPwaLane({
      expectRole: 'member',
      hasStaff: true,
      hasMember: true,
      staffLabel: 'Coach',
      staffListLabel: 'Coaches',
    }) as { ok: true; lane: 'staff' | 'member' }
  ).lane,
  'member'
);
assert.match(
  (
    resolveAdvisorPwaLane({
      expectRole: 'staff',
      hasStaff: false,
      hasMember: true,
      staffLabel: 'Coach',
      staffListLabel: 'Coaches',
    }) as { ok: false; error: string }
  ).error,
  /SA Member/
);
assert.match(
  (
    resolveAdvisorPwaLane({
      expectRole: 'member',
      hasStaff: true,
      hasMember: false,
      staffLabel: 'Practitioner',
      staffListLabel: 'Practitioners',
    }) as { ok: false; error: string }
  ).error,
  /practitioner/i
);
assert.equal(
  (
    resolveAdvisorPwaLane({
      hasStaff: true,
      hasMember: true,
      staffLabel: 'Coach',
      staffListLabel: 'Coaches',
    }) as { ok: true; lane: 'staff' | 'member' }
  ).lane,
  'staff'
);

console.log('pwa-signin tests ok');
