/**
 * FleetAdvisor® is one expandable group in the core sidebar.
 * Run: npx --yes tsx lib/chrome/fleet-sidebar.test.ts
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { Truck } from 'lucide-react';
import { MODULE_NAV } from './module-nav';
import { ADVISOR_OS_MODULE_IDS, functionalSidebarModules } from './functional-nav';

const fleet = MODULE_NAV.find((mod) => mod.id === 'fleetgraph');
assert.ok(fleet, 'FleetAdvisor® is registered in MODULE_NAV');
assert.equal(fleet!.name, 'FleetAdvisor®');
assert.equal(fleet!.href, '/dashboard/fleetgraph');
assert.equal(fleet!.resource, 'operations');
assert.equal(fleet!.icon, Truck);
assert.ok(ADVISOR_OS_MODULE_IDS.includes('fleetgraph'));
assert.equal(fleet!.id.includes('®'), false);
assert.ok(fleet!.steps.every((step) => !step.href.includes('®')));

const expected = [
  ['Home', 'Command', '/dashboard/fleetgraph', true],
  ['Fleet', 'Fleet map', '/dashboard/fleetgraph/map', undefined],
  ['Fleet', 'Vehicles', '/dashboard/fleetgraph/vehicles', undefined],
  ['Fleet', 'Drivers', '/dashboard/fleetgraph/drivers', undefined],
  ['Fleet', 'Compliance', '/dashboard/fleetgraph/compliance', undefined],
  ['Work', 'Jobs', '/dashboard/fleetgraph/jobs', undefined],
  ['Insights', 'CPK', '/dashboard/fleetgraph/cpk', undefined],
  ['Setup', 'Import', '/dashboard/fleetgraph/import', undefined],
  ['Setup', 'Settings', '/dashboard/fleetgraph/settings', undefined],
] as const;

assert.equal(fleet!.steps.length, 9);
assert.deepEqual(
  fleet!.steps.map((step) => [step.section, step.name, step.href, step.exact]),
  expected.map((row) => [row[0], row[1], row[2], row[3]])
);
assert.ok(fleet!.steps.every((step) => step.desc && step.desc.length > 0));

for (const step of fleet!.steps) {
  const path = step.href.split('?')[0];
  const relative = path === '/dashboard/fleetgraph' ? 'app/dashboard/fleetgraph/page.tsx' : `app${path}/page.tsx`;
  assert.equal(existsSync(resolve(relative)), true, relative);
}

const sidebar = functionalSidebarModules({
  isModuleEnabled: () => true,
  packaging: null,
  simplifiedSchool: false,
}).find((mod) => mod.id === 'fleetgraph');
assert.equal(sidebar?.name, 'FleetAdvisor®');
assert.deepEqual(
  sidebar?.sub.map((step) => step.name),
  expected.map((row) => row[1])
);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = resolve(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (name.endsWith('.tsx') || name.endsWith('.ts')) out.push(full);
  }
  return out;
}

const pageFiles = walk(resolve('app/dashboard/fleetgraph'));
assert.ok(pageFiles.length >= 7);
for (const file of pageFiles) {
  const src = readFileSync(file, 'utf8');
  assert.equal(src.includes('<aside'), false, file);
}

const sidebarSrc = readFileSync(resolve('components/Sidebar.tsx'), 'utf8');
assert.match(sidebarSrc, /isAdvisorOsModule\(mod\.id\)/);
assert.match(sidebarSrc, /expandedModules\[mod\.id\] !== false/);

console.log('fleet-sidebar.test.ts ok');
