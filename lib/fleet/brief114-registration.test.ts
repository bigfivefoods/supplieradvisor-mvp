/**
 * FleetAdvisor® registration. Ids, sidebar name, catalogue, skin, permissions.
 * Run: npx --yes tsx lib/fleet/brief114-registration.test.ts
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { MODULE_NAV } from '../chrome/module-nav';
import {
  ADVISOR_OS_MODULE_IDS,
  FUNCTIONAL_DISPLAY_NAME,
  FUNCTIONAL_MODULE_ORDER,
  PACK_TO_ADVISOR_MODULE,
} from '../chrome/functional-nav';
import {
  INDUSTRY_ADVISOR_MODULE_IDS,
  MODULE_CATEGORIES,
  SECTOR_VERTICAL_MODULE_IDS,
  moduleIdForPath,
} from '../business/company-modules';
import { SIDEBAR_MODULE_RESOURCE, resourceForPath } from '../business/permissions';
import { ADVISOR_MODULE_CORE_HREF, ADVISOR_PACK_UNLOCKS } from '../product/advisor-core-unlocks';
import { appModulesUnlockedByPack, getIndustryPack } from '../product/architecture';
import { ADVISOR_SKINS } from '../brand/advisor-skins';
import { PUBLIC_PAGE_PREFIXES, isPublicApiPath, isPublicPagePath } from '../auth/public-paths';

assert.equal(PACK_TO_ADVISOR_MODULE.logistics_fleet, 'fleetgraph');
assert.equal(FUNCTIONAL_DISPLAY_NAME.fleetgraph, 'FleetAdvisor®');
assert.ok(ADVISOR_OS_MODULE_IDS.includes('fleetgraph'));
assert.ok(FUNCTIONAL_MODULE_ORDER.includes('fleetgraph'));
assert.ok(INDUSTRY_ADVISOR_MODULE_IDS.includes('fleetgraph'));
assert.ok(SECTOR_VERTICAL_MODULE_IDS.tertiary.includes('fleetgraph'));
assert.ok(SECTOR_VERTICAL_MODULE_IDS.secondary.includes('fleetgraph'));
assert.equal(moduleIdForPath('/dashboard/fleetgraph/vehicles'), 'fleetgraph');
assert.equal(SIDEBAR_MODULE_RESOURCE.fleetgraph, 'operations');
assert.equal(resourceForPath('/dashboard/fleetgraph/cpk'), 'operations');

const band = MODULE_CATEGORIES.find((category) => category.id === 'ind_transport');
assert.equal(band?.title, 'Transport & logistics');
assert.deepEqual(band?.moduleIds, ['fleetgraph']);
assert.ok(MODULE_CATEGORIES.find((category) => category.id === 'ind_services')?.moduleIds.includes('containers'));
assert.equal(
  MODULE_CATEGORIES.find((category) => category.id === 'ind_services')?.moduleIds.includes('fleetgraph'),
  false
);

const unlock = ADVISOR_MODULE_CORE_HREF.fleetgraph;
assert.equal(unlock.label, 'FleetAdvisor®');
assert.equal(unlock.staff, '/dashboard/people/directory');
assert.equal(unlock.book, '/dashboard/fleetgraph/jobs');
assert.equal(unlock.money, '/dashboard/accounting');
assert.ok(ADVISOR_PACK_UNLOCKS.logistics_fleet.includes('fleetgraph'));
assert.ok(ADVISOR_PACK_UNLOCKS.logistics_fleet.includes('distribution'));

const pack = getIndustryPack('logistics_fleet');
assert.ok(pack);
assert.equal(pack!.name, 'Fleet & Transport');
assert.ok(appModulesUnlockedByPack(pack!).includes('fleetgraph'));
assert.ok(appModulesUnlockedByPack(pack!).includes('sheq'));

const skin = ADVISOR_SKINS.find((item) => item.id === 'fleet');
assert.equal(skin?.registered, 'FleetAdvisor®');
assert.deepEqual(skin?.prefixes, ['/dashboard/fleetgraph']);
assert.deepEqual(skin?.moduleIds, ['fleetgraph']);
assert.deepEqual(skin?.packIds, ['logistics_fleet']);
assert.equal(skin?.brand, '#00b4d8');
assert.equal(skin?.brandDeep, '#0077b6');

const fleetNav = MODULE_NAV.find((mod) => mod.id === 'fleetgraph');
assert.equal(fleetNav?.name, 'FleetAdvisor®');
assert.equal(fleetNav?.steps.length, 9);
const icons = MODULE_NAV.map((mod) => mod.icon);
assert.equal(new Set(icons).size, icons.length);

assert.ok(PUBLIC_PAGE_PREFIXES.includes('/preview/fleetgraph'));
assert.equal(isPublicPagePath('/preview/fleetgraph'), true);
assert.equal(isPublicPagePath('/preview/fleetgraph/map'), true);
assert.equal(isPublicPagePath('/api/fleet/fleetgraph'), false);
assert.equal(isPublicApiPath('/api/fleet/fleetgraph'), false);
assert.equal(isPublicApiPath('/preview/fleetgraph'), false);
assert.equal(
  PUBLIC_PAGE_PREFIXES.some((prefix) => prefix.startsWith('/api')),
  false
);
assert.equal(existsSync(resolve('app/api/public/fleetgraph')), false);
assert.equal(existsSync(resolve('app/preview/fleetgraph/page.tsx')), true);

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = resolve(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const roots = [
  'app/dashboard/fleetgraph',
  'app/preview/fleetgraph',
  'components/fleet',
  'lib/fleet',
  'lib/chrome/module-nav.ts',
  'lib/chrome/functional-nav.ts',
];
const files = roots.flatMap((root) => {
  const full = resolve(root);
  if (!existsSync(full)) return [];
  return statSync(full).isDirectory() ? walk(full) : [full];
});

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const bare = src.match(new RegExp('Fleet' + 'Advisor(?!®)'));
  assert.equal(bare, null, `${file} missing the registered mark`);
  assert.equal(src.includes('®') && /\/dashboard\/[^'"\s]*®/.test(src), false, file);
}

console.log('brief114-registration.test.ts ok');
