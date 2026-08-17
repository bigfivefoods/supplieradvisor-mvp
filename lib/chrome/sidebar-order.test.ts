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

console.log('sidebar-order.test.ts ok');
