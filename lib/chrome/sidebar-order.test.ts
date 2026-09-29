/**
 * Run: npx --yes tsx lib/chrome/sidebar-order.test.ts
 */
import assert from 'node:assert/strict';
import {
  applySidebarModuleOrder,
  mergeUserSidebarOrderIntoCompanyMeta,
  moveSidebarModule,
  parseSidebarModuleOrder,
  readUserSidebarOrderFromCompanyMeta,
} from './sidebar-order';
import { orderSidebarModules, pinAdvisorHubsFirst } from './functional-nav';

assert.deepEqual(parseSidebarModuleOrder(['home', 'home', '', 'people']), [
  'home',
  'people',
]);

const mods = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
assert.deepEqual(
  applySidebarModuleOrder(mods, ['c', 'a']).map((m) => m.id),
  ['c', 'a', 'b']
);

assert.deepEqual(moveSidebarModule(['a', 'b', 'c'], 'c', 'a'), [
  'c',
  'a',
  'b',
]);

const meta = mergeUserSidebarOrderIntoCompanyMeta({}, 'did:privy:1', [
  'fitgraph',
  'home',
]);
assert.deepEqual(readUserSidebarOrderFromCompanyMeta(meta, 'did:privy:1'), [
  'fitgraph',
  'home',
]);

const hubs = [
  { id: 'home' },
  { id: 'fitgraph' },
  { id: 'schools' },
  { id: 'my-business' },
];

assert.deepEqual(
  pinAdvisorHubsFirst(hubs).map((m) => m.id),
  ['fitgraph', 'schools', 'home', 'my-business']
);

assert.deepEqual(
  orderSidebarModules(hubs, null).map((m) => m.id),
  ['fitgraph', 'schools', 'home', 'my-business'],
  'no saved order: Advisors stay at the top'
);

assert.deepEqual(
  orderSidebarModules(hubs, [
    'home',
    'my-business',
    'fitgraph',
    'schools',
  ]).map((m) => m.id),
  ['home', 'my-business', 'fitgraph', 'schools'],
  'saved Arrange order can move Advisors below Core'
);

assert.deepEqual(
  orderSidebarModules(
    [...hubs, { id: 'constructiongraph' }],
    ['home', 'fitgraph', 'schools', 'my-business']
  ).map((m) => m.id),
  ['constructiongraph', 'home', 'fitgraph', 'schools', 'my-business'],
  'newly enabled Advisor not in the saved list starts at the top'
);

console.log('sidebar-order.test.ts ok');
