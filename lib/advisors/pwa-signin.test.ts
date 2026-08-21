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

console.log('pwa-signin tests ok');
