/**
 * Run: npx --yes tsx lib/fitness/gym-pwa-roster.test.ts
 */
import assert from 'node:assert/strict';
import { emptyFitgraphStore, type FitClient, type FitCoach } from './fitgraph';
import {
  isGymCoachPortalPath,
  linkGymPersonToPwa,
  preferredGymPwaLink,
} from './gym-pwa-roster';

const store = emptyFitgraphStore();
store.settings = {
  ...store.settings,
  public_token: 'fg_110_pub',
  brand_name: 'VUKA Fitness',
};
store.coaches.push({
  id: 'coh_jarryd',
  code: 'C1',
  name: 'Jarryd',
  email: 'jlunn45@gmail.com',
  active: true,
  portal_token: 'coach_110_live',
} as FitCoach);
store.clients.push({
  id: 'cli_aimee',
  code: 'M1',
  name: 'Aimee Le Roux',
  email: 'aimeeleroux1@gmail.com',
  active: true,
  created_at: '2026-01-01',
} as FitClient);
store.clients.push({
  id: 'cli_jared',
  code: 'M2',
  name: 'Jared-Wade Cawood',
  email: 'jaredcawood77@gmail.com',
  active: true,
  created_at: '2026-01-01',
} as FitClient);
store.coaches.push({
  id: 'coh_jared',
  code: 'C2',
  name: 'Jared',
  email: 'jaredcawood77@gmail.com',
  active: true,
} as FitCoach);

const coachOnly = linkGymPersonToPwa(store, {
  companyId: 110,
  email: 'jlunn45@gmail.com',
  displayName: 'jarryd',
  createIfMissing: true,
});
assert.equal(coachOnly.createdMember, false);
assert.equal(coachOnly.links.length, 1);
assert.equal(coachOnly.links[0].role, 'coach');
assert.equal(coachOnly.links[0].portal_token, 'coach_110_live');
assert.ok(isGymCoachPortalPath(coachOnly.links[0].portal_path));
assert.equal(
  store.clients.filter((c) => c.email === 'jlunn45@gmail.com').length,
  0
);

const memberOnly = linkGymPersonToPwa(store, {
  companyId: 110,
  email: 'aimeeleroux1@gmail.com',
  displayName: 'Aimee Le Roux',
  createIfMissing: true,
});
assert.equal(memberOnly.createdMember, false);
assert.equal(memberOnly.links.length, 1);
assert.equal(memberOnly.links[0].role, 'member');
assert.ok(String(memberOnly.links[0].portal_token).startsWith('member_110_'));
assert.equal(store.clients.find((c) => c.id === 'cli_aimee')?.portal_token, memberOnly.links[0].portal_token);

const both = linkGymPersonToPwa(store, {
  companyId: 110,
  email: 'jaredcawood77@gmail.com',
  displayName: 'Jared',
  createIfMissing: true,
});
assert.equal(both.createdMember, false);
assert.deepEqual(
  both.links.map((l) => l.role).sort(),
  ['coach', 'member']
);
assert.equal(preferredGymPwaLink(both.links)?.role, 'coach');
assert.ok(store.coaches.find((c) => c.id === 'coh_jared')?.portal_token);

const unknown = linkGymPersonToPwa(store, {
  companyId: 110,
  email: 'new@example.com',
  displayName: 'New Person',
  createIfMissing: false,
});
assert.equal(unknown.links.length, 0);
assert.equal(unknown.createdMember, false);

const walkIn = linkGymPersonToPwa(store, {
  companyId: 110,
  email: 'walkin@example.com',
  displayName: 'Walk In',
  createIfMissing: true,
});
assert.equal(walkIn.createdMember, true);
assert.equal(walkIn.links[0].role, 'member');
assert.ok(store.clients.some((c) => c.email === 'walkin@example.com'));

console.log('gym-pwa-roster.test.ts ok');
