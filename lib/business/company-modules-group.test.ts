/**
 * Run: npx --yes tsx lib/business/company-modules-group.test.ts
 */
import assert from 'node:assert/strict';
import {
  GOVERNMENT_PROGRAMME_MODULE_IDS,
  INDUSTRY_ADVISOR_MODULE_IDS,
  groupWorkspaceModules,
  isSupplierAdvisorPlatformCompany,
  verticalModuleIdsForPacks,
} from './company-modules';

const g = groupWorkspaceModules();
assert.deepEqual(
  g.map((x) => x.layer),
  ['core', 'industry', 'government']
);

const core = g.find((x) => x.layer === 'core')!;
const industry = g.find((x) => x.layer === 'industry')!;
const government = g.find((x) => x.layer === 'government')!;

assert.ok(core.moduleIds.includes('accounting'));
assert.ok(core.moduleIds.includes('suppliers'));
assert.ok(!core.moduleIds.includes('platform'));
assert.ok(!core.moduleIds.includes('fitgraph'));
assert.ok(!core.moduleIds.includes('schools'));

assert.ok(industry.moduleIds.includes('fitgraph'));
assert.ok(industry.moduleIds.includes('containers'));
assert.ok(!industry.moduleIds.includes('schools'));
assert.ok(!industry.moduleIds.includes('health'));
assert.equal(industry.moduleIds.length, INDUSTRY_ADVISOR_MODULE_IDS.length);

assert.deepEqual(government.moduleIds, [...GOVERNMENT_PROGRAMME_MODULE_IDS]);

const withPlat = groupWorkspaceModules({ showPlatform: true });
assert.ok(
  withPlat.find((x) => x.layer === 'core')!.moduleIds.includes('platform')
);

const all = g.flatMap((x) => x.moduleIds);
assert.equal(new Set(all).size, all.length, 'no duplicate module ids');

assert.ok(verticalModuleIdsForPacks(['fitness_gym']).includes('fitgraph'));
assert.ok(
  isSupplierAdvisorPlatformCompany({ tradingName: 'SupplierAdvisor' })
);
assert.ok(
  !isSupplierAdvisorPlatformCompany({ tradingName: 'Big Five Foods' })
);

console.log('company-modules-group.test.ts ok');
