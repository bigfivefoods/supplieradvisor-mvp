/**
 * Run: npx --yes tsx lib/portals/guest-portal-tabs.test.ts
 */
import assert from 'node:assert/strict';
import { guestPortalTabGroups, guestPortalTabs } from './guest-portal-tabs';

const customer = guestPortalTabs({ kind: 'customer' }).map((t) => t.id);
assert.deepEqual(customer, [
  'profile',
  'people',
  'docs',
  'quotes',
  'newpo',
  'orders',
  'commercial',
  'statement',
  'projects',
  'otifef',
  'messages',
  'riad',
  'reviews',
  'demo',
]);

const supplier = guestPortalTabs({ kind: 'supplier' }).map((t) => t.id);
assert.deepEqual(supplier, [
  'profile',
  'people',
  'docs',
  'orders',
  'commercial',
  'stock',
  'projects',
  'otifef',
  'messages',
  'riad',
  'reviews',
  'demo',
]);

const groups = guestPortalTabGroups({ kind: 'customer', profileGaps: 2 });
assert.equal(groups[0].id, 'account');
assert.equal(groups[1].id, 'trade');
assert.equal(groups[2].id, 'work');
assert.equal(groups[3].id, 'relate');
assert.equal(groups.at(-1)?.id, 'demo');
assert.equal(groups.at(-1)?.align, 'end');
assert.equal(groups[0].tabs[0].label, 'Profile (2)');
assert.equal(guestPortalTabGroups({ kind: 'supplier' }).at(-1)?.id, 'demo');

console.log('guest-portal-tabs.test.ts ok');
