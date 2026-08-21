/**
 * Run: npx --yes tsx lib/fitness/portal-signin.test.ts
 */
import assert from 'node:assert/strict';
import {
  findClientForPortalSignIn,
  namesMatchForPortalSignIn,
  type FitClient,
  type FitgraphStore,
} from './fitgraph';

assert.equal(namesMatchForPortalSignIn('Craig Smith', 'craig smith'), true);
assert.equal(namesMatchForPortalSignIn('Craig John Smith', 'Craig Smith'), true);
assert.equal(namesMatchForPortalSignIn('Craig Smith', 'Craig'), false);
assert.equal(namesMatchForPortalSignIn('Craig Smith', 'Someone Else'), false);

const store = {
  clients: [
    {
      id: 'cli_1',
      name: 'Craig Smith',
      email: 'craig@bigfivefoods.com',
      active: true,
      portal_token: 'member_110_abc',
    } as FitClient,
    {
      id: 'cli_2',
      name: 'Other Member',
      email: 'other@example.com',
      active: true,
    } as FitClient,
  ],
} as FitgraphStore;

const hit = findClientForPortalSignIn(store, {
  name: 'Craig Smith',
  email: 'craig@bigfivefoods.com',
});
assert.equal(hit?.id, 'cli_1');

assert.equal(
  findClientForPortalSignIn(store, {
    name: 'Craig Smith',
    email: 'wrong@example.com',
  }),
  null
);
assert.equal(
  findClientForPortalSignIn(store, {
    name: 'Wrong Name',
    email: 'craig@bigfivefoods.com',
  }),
  null
);

const invited = {
  clients: [
    {
      id: 'cli_inv',
      name: 'Pat Member',
      invite_email: 'pat@gym.example',
      active: true,
      portal_token: 'member_inv',
    } as FitClient,
  ],
} as FitgraphStore;
assert.equal(
  findClientForPortalSignIn(invited, {
    name: 'Pat Member',
    email: 'pat@gym.example',
  })?.id,
  'cli_inv'
);

console.log('portal-signin tests ok');
