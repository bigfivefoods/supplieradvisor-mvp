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
import {
  ADVISOR_OS_MODULE_IDS,
  functionalSidebarModules,
} from '@/lib/chrome/functional-nav';
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
assert.equal(sidebar[0]?.id, 'fitgraph', 'GymAdvisor is pinned at the top');
assert.ok(
  !sidebar.some((m) => m.id === 'industry_tools'),
  'Industry Tools is not in the sidenav'
);

const advisorSet = new Set<string>(ADVISOR_OS_MODULE_IDS);
const allOn = functionalSidebarModules({
  isModuleEnabled: () => true,
  packaging: {
    packIds: ['fitness_gym', 'dental', 'logistics_containers'],
  } as never,
  simplifiedSchool: false,
  moduleOrder: ['home', 'my-business', 'fitgraph', 'schools'],
});
const firstNonAdvisor = allOn.findIndex((m) => !advisorSet.has(m.id));
const advisorCount = allOn.filter((m) => advisorSet.has(m.id)).length;
assert.ok(advisorCount > 0, 'all-on workspace still shows Advisor hubs');
assert.equal(
  firstNonAdvisor,
  advisorCount,
  'every Advisor hub sits above Control Tower and Core'
);
assert.ok(
  !allOn.some((m) => m.id === 'industry_tools'),
  'Industry Tools stays off the sidenav when packs are on'
);

const publicPack = resolveVisibleModules({
  stored: { customers: true, schools: false, health: false },
  packaging: { packIds: ['public_procurement'] },
});
assert.equal(
  publicPack.health,
  false,
  'public procurement pack does not force HealthAdvisor on'
);

const dbe = extractEnabledModulesFromMetadata({
  enabled_modules: { schools: true, health: true, customers: true },
  entity_kind: 'government_education',
  programme: 'education',
  industry_packs: ['public_procurement'],
});
assert.equal(dbe.schools, true, 'DBE keeps SchoolAdvisor');
assert.equal(dbe.health, false, 'DBE cannot keep HealthAdvisor on');

const doh = extractEnabledModulesFromMetadata({
  enabled_modules: { schools: true, health: true, customers: true },
  entity_kind: 'government_health',
  programme: 'health',
  industry_packs: ['public_procurement'],
});
assert.equal(doh.health, true, 'DoH keeps HealthAdvisor');
assert.equal(doh.schools, false, 'DoH does not keep SchoolAdvisor');

const dbeBiz = resolveVisibleModules({
  stored: { health: true, schools: true },
  packaging: {
    packIds: ['public_procurement'],
    entityTypeId: 'provincial',
    businessTypeIds: ['prov_dbe'],
  },
});
assert.equal(dbeBiz.health, false);
assert.equal(dbeBiz.schools, true);

console.log('company-modules-visibility.test.ts ok');
