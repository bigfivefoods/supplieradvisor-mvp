/**
 * Run: npx --yes tsx lib/chrome/module-nav-integrity.test.ts
 */
import assert from 'node:assert/strict';
import { MODULE_NAV } from './module-nav';
import {
  FUNCTIONAL_DISPLAY_NAME,
  FUNCTIONAL_MODULE_ORDER,
  functionalSidebarModules,
} from './functional-nav';
import { auditModuleNavIntegrity } from './module-nav-integrity';

const report = auditModuleNavIntegrity();
assert.equal(report.ok, true, 'module nav integrity should remain complete');

const apparel = MODULE_NAV.find((m) => m.id === 'apparelgraph');
assert.ok(apparel, 'MODULE_NAV should register apparelgraph');
assert.equal(apparel!.steps.length, 15, 'apparelgraph should expose 15 nav steps');
assert.deepEqual(
  apparel!.steps.map((s) => s.name),
  [
    'Overview',
    'Range',
    'Styles',
    'Samples',
    'Costing',
    'Path',
    'Capability',
    'Materials',
    'Floor',
    'Quality',
    'Wholesale',
    'Ship',
    'Reports',
    'Portal',
    'Messages',
  ]
);
assert.ok(
  FUNCTIONAL_MODULE_ORDER.includes('apparelgraph'),
  'functional nav order should include apparelgraph'
);

const construction = MODULE_NAV.find((m) => m.id === 'constructiongraph');
assert.ok(construction, 'MODULE_NAV should register constructiongraph');
assert.equal(construction!.name, 'ConstructionAdvisor®');
assert.equal(
  construction!.steps.length,
  18,
  'constructiongraph should expose 18 nav steps'
);
assert.deepEqual(
  construction!.steps.map((s) => s.name),
  [
    'Command',
    'Clients',
    'Quotes',
    'Projects',
    'Programme',
    'Diary',
    'Subcontractors',
    'Materials',
    'Messages',
    'Payments',
    'Variations',
    'Certificates',
    'Costs',
    'Safety',
    'Documents',
    'Handover',
    'Reports',
    'Portal',
  ]
);
assert.ok(
  FUNCTIONAL_MODULE_ORDER.includes('constructiongraph'),
  'functional nav order should include constructiongraph'
);
assert.equal(
  FUNCTIONAL_DISPLAY_NAME.constructiongraph,
  'ConstructionAdvisor®',
  'sidenav label is ConstructionAdvisor®'
);
const constructionSidebar = functionalSidebarModules({
  isModuleEnabled: () => true,
  packaging: null,
  simplifiedSchool: false,
}).find((m) => m.id === 'constructiongraph');
assert.ok(constructionSidebar, 'sidenav includes ConstructionAdvisor');
assert.equal(constructionSidebar!.name, 'ConstructionAdvisor®');
assert.equal(
  constructionSidebar!.sub.length,
  18,
  'sidenav ConstructionAdvisor® is expandable with the full desk tree'
);
assert.deepEqual(
  constructionSidebar!.sub.map((s) => s.name),
  construction!.steps.map((s) => s.name)
);

const fleet = MODULE_NAV.find((m) => m.id === 'fleetgraph');
assert.ok(fleet, 'MODULE_NAV should register fleetgraph');
assert.equal(fleet!.name, 'FleetAdvisor®');
assert.equal(fleet!.steps.length, 7, 'fleetgraph should expose 7 nav steps');
assert.deepEqual(
  fleet!.steps.map((s) => s.name),
  ['Command', 'Fleet map', 'Vehicles', 'Drivers', 'Jobs', 'CPK', 'Settings']
);
assert.ok(FUNCTIONAL_MODULE_ORDER.includes('fleetgraph'), 'functional nav order should include fleetgraph');
assert.equal(FUNCTIONAL_DISPLAY_NAME.fleetgraph, 'FleetAdvisor®');

const iconKeys = MODULE_NAV.map((m) => m.icon.displayName || m.icon.name || String(m.icon));
assert.equal(
  new Set(iconKeys).size,
  iconKeys.length,
  'each MODULE_NAV hub must use a unique Lucide icon'
);

console.log('module-nav-integrity.test.ts ok');
