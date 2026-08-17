/**
 * Run: npx --yes tsx lib/business/company-modules-group.test.ts
 */
import assert from 'node:assert/strict';
import {
  groupWorkspaceModules,
  verticalModuleIdsForPacks,
} from './company-modules';

const gym = groupWorkspaceModules({
  sectorId: 'tertiary',
  industryIds: ['fitness_wellness'],
});
const layers = gym.map((g) => g.layer);
assert.deepEqual(layers, ['core', 'sector', 'industry']);

const all = gym.flatMap((g) => g.moduleIds);
assert.equal(new Set(all).size, all.length, 'no duplicate module ids');

const industry = gym.find((g) => g.layer === 'industry')!;
assert.ok(industry.moduleIds.includes('fitgraph'));

const sector = gym.find((g) => g.layer === 'sector')!;
assert.ok(!sector.moduleIds.includes('fitgraph'));
assert.ok(sector.moduleIds.includes('physiograph'));

const core = gym.find((g) => g.layer === 'core')!;
assert.ok(core.moduleIds.includes('suppliers'));
assert.ok(!core.moduleIds.includes('fitgraph'));

assert.ok(verticalModuleIdsForPacks(['fitness_gym']).includes('fitgraph'));
assert.ok(!verticalModuleIdsForPacks(['fitness_gym']).includes('suppliers'));

const empty = groupWorkspaceModules({ sectorId: null, industryIds: [] });
assert.equal(empty.find((g) => g.layer === 'industry')!.moduleIds.length, 0);

console.log('company-modules-group.test.ts ok');
