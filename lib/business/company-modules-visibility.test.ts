/**
 * Run: npx --yes tsx lib/business/company-modules-visibility.test.ts
 */
import assert from 'node:assert/strict';
import {
  applyAdvisorVisibility,
  extractEnabledModulesFromMetadata,
  failOpenEnabledModules,
  isModuleEnabled,
  normalizeEnabledModules,
  resolveVisibleModules,
} from './company-modules';
import { functionalSidebarModules } from '@/lib/chrome/functional-nav';
import { readPackagingFromMetadata } from '@/lib/product/architecture';

const emptyChrome = normalizeEnabledModules({});
assert.equal(emptyChrome.fitgraph, false, 'missing Advisor keys stay opt-in off');

const vuka = extractEnabledModulesFromMetadata(
  { enabled_modules: { customers: true } },
  { companyId: 110, companyName: 'VUKA Fitness' }
);
assert.equal(vuka.fitgraph, true, 'company 110 always keeps GymAdvisor');
assert.equal(vuka.people, true);
assert.equal(vuka.customers, true);
assert.equal(vuka.accounting, true);

const byName = applyAdvisorVisibility({
  map: normalizeEnabledModules({}),
  companyName: 'VUKA Fitness',
});
assert.equal(byName.fitgraph, true);

const bigFive = extractEnabledModulesFromMetadata(
  { enabled_modules: { customers: true } },
  { companyId: 102, companyName: 'Big Five Foods' }
);
assert.equal(bigFive.fitgraph, false, 'other founder companies do not get gym');

const fromPack = resolveVisibleModules({
  stored: { fitgraph: false, customers: true },
  packaging: { packIds: ['fitness_gym'] },
});
assert.equal(fromPack.fitgraph, true, 'fitness pack turns GymAdvisor back on');

const fromMetaPack = extractEnabledModulesFromMetadata({
  industry_packs: ['fitness_gym'],
});
assert.equal(fromMetaPack.fitgraph, true);

const packOnlyChrome = readPackagingFromMetadata({
  industry_packs: ['fitness_gym'],
});
assert.ok(packOnlyChrome);
assert.ok(packOnlyChrome?.packIds.includes('fitness_gym'));

const failOpen = failOpenEnabledModules();
assert.equal(failOpen.fitgraph, true);
assert.equal(isModuleEnabled(failOpen, 'fitgraph'), true);

const sidebar = functionalSidebarModules({
  isModuleEnabled: (id) => isModuleEnabled(vuka, id),
  packaging: { packIds: ['fitness_gym'] } as never,
  simplifiedSchool: false,
});
assert.ok(
  sidebar.some((m) => m.id === 'fitgraph'),
  'GymAdvisor appears in the sidenav for VUKA'
);
assert.ok(
  sidebar
    .find((m) => m.id === 'fitgraph')
    ?.sub.some((s) => s.href === '/dashboard/fitgraph/calendar'),
  'gym process steps stay on the hub'
);

console.log('company-modules-visibility.test.ts ok');
