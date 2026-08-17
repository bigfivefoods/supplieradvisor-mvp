/**
 * Run: npx --yes tsx lib/product/advisor-core-unlocks.test.ts
 */
import assert from 'node:assert/strict';
import {
  addAdvisorPackUnlocks,
  applyAdvisorCoreCompanions,
  enabledAdvisorModules,
} from './advisor-core-unlocks';
import { normalizeEnabledModules } from '../business/company-modules';

const off = applyAdvisorCoreCompanions({
  fitgraph: false,
  people: false,
  customers: false,
  accounting: false,
});
assert.equal(off.people, false);

const gym = applyAdvisorCoreCompanions({
  fitgraph: true,
  people: false,
  customers: false,
  accounting: false,
  suppliers: true,
});
assert.equal(gym.people, true);
assert.equal(gym.customers, true);
assert.equal(gym.accounting, true);
assert.equal(gym.fitgraph, true);

const unlocked = new Set<string>(['network']);
addAdvisorPackUnlocks(unlocked, ['fitness_gym']);
assert.ok(unlocked.has('fitgraph'));
assert.ok(unlocked.has('people'));
assert.ok(unlocked.has('customers'));
assert.ok(unlocked.has('accounting'));

assert.deepEqual(enabledAdvisorModules((id) => id === 'fitgraph'), ['fitgraph']);

const fromStore = normalizeEnabledModules({ fitgraph: true });
assert.equal(fromStore.fitgraph, true);
assert.equal(fromStore.people, true);
assert.equal(fromStore.customers, true);
assert.equal(fromStore.accounting, true);

console.log('advisor-core-unlocks.test.ts ok');
