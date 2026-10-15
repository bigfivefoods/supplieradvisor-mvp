/**
 * ConstructionAdvisor® is one expandable group in the core sidebar.
 * Run: npx --yes tsx lib/chrome/construction-sidebar.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Hammer } from 'lucide-react';
import { MODULE_NAV } from './module-nav';
import { ADVISOR_OS_MODULE_IDS, functionalSidebarModules } from './functional-nav';

const construction = MODULE_NAV.find((mod) => mod.id === 'constructiongraph');
assert.ok(construction);
assert.equal(construction!.name, 'ConstructionAdvisor®');
assert.equal(construction!.href, '/dashboard/constructiongraph');
assert.equal(construction!.resource, 'operations');
assert.equal(construction!.icon, Hammer);
assert.ok(ADVISOR_OS_MODULE_IDS.includes('constructiongraph'));

const expected = [
  ['Home', 'Command', '/dashboard/constructiongraph', true],
  ['Core', 'Clients', '/dashboard/constructiongraph/clients', undefined],
  ['Core', 'Quotes', '/dashboard/constructiongraph/quotes', undefined],
  ['Core', 'Projects', '/dashboard/constructiongraph/sites', undefined],
  ['Ops', 'Programme', '/dashboard/constructiongraph/programme', undefined],
  ['Ops', 'Diary', '/dashboard/constructiongraph/diary', undefined],
  ['Ops', 'Subcontractors', '/dashboard/constructiongraph/subcontractors', undefined],
  ['Ops', 'Materials', '/dashboard/constructiongraph/materials', undefined],
  ['Ops', 'Messages', '/dashboard/messages?from=constructiongraph&channel=connection', undefined],
  ['Money', 'Payments', '/dashboard/constructiongraph/payments', undefined],
  ['Money', 'Variations', '/dashboard/constructiongraph/variations', undefined],
  ['Money', 'Certificates', '/dashboard/constructiongraph/certificates', undefined],
  ['Money', 'Costs', '/dashboard/constructiongraph/costs', undefined],
  ['Assure', 'Safety', '/dashboard/constructiongraph/safety', undefined],
  ['Assure', 'Documents', '/dashboard/constructiongraph/drawings', undefined],
  ['Handover', 'Handover', '/dashboard/constructiongraph/handover', undefined],
  ['Insights', 'Reports', '/dashboard/constructiongraph/reports', undefined],
  ['Grow', 'Portal', '/dashboard/constructiongraph/portal', undefined],
] as const;

assert.equal(construction!.steps.length, 18);
assert.deepEqual(
  construction!.steps.map((step) => [step.section, step.name, step.href, step.exact]),
  expected.map((row) => [row[0], row[1], row[2], row[3]])
);
assert.equal(construction!.steps.find((step) => step.name === 'Messages')?.rail, false);
assert.ok(construction!.steps.filter((step) => step.name !== 'Messages').every((step) => step.rail !== false));

const sidebar = functionalSidebarModules({
  isModuleEnabled: () => true,
  packaging: null,
  simplifiedSchool: false,
}).find((mod) => mod.id === 'constructiongraph');
assert.equal(sidebar?.name, 'ConstructionAdvisor®');
assert.deepEqual(sidebar?.sub.map((step) => step.name), expected.map((row) => row[1]));

const sidebarSrc = readFileSync(resolve('components/Sidebar.tsx'), 'utf8');
assert.match(sidebarSrc, /isAdvisorOsModule\(mod\.id\)/);
assert.match(sidebarSrc, /expandedModules\[mod\.id\] !== false/);

console.log('construction-sidebar.test.ts ok');
