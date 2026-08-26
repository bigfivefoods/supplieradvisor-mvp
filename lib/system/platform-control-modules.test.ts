/**
 * Run: npx --yes tsx lib/system/platform-control-modules.test.ts
 */
import assert from 'node:assert/strict';
import { clampGovernmentModules } from './platform-control';

const withAccounting = clampGovernmentModules(
  { schools: true, accounting: true, network: true, fitgraph: true },
  'education'
);
assert.equal(withAccounting.accounting, true, 'DBE can enable Finance');
assert.equal(withAccounting.schools, true, 'SchoolAdvisor stays on');
assert.equal(withAccounting.fitgraph, false, 'GymAdvisor stays off');
assert.equal(withAccounting.health, false, 'Health programme stays off');
assert.equal(withAccounting.home, true);

const empty = clampGovernmentModules({}, 'education');
assert.equal(empty.schools, true);
assert.equal(empty.accounting, undefined);

const health = clampGovernmentModules(
  { health: true, accounting: true, schools: true },
  'health'
);
assert.equal(health.accounting, true);
assert.equal(health.health, true);
assert.equal(health.schools, false);

console.log('platform-control-modules.test.ts ok');
