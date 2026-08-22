/**
 * Run: npx --yes tsx lib/advisors/pwa-signin.test.ts
 */
import assert from 'node:assert/strict';
import { findRosterPersonForSignIn } from './pwa-signin';

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

console.log('pwa-signin tests ok');
