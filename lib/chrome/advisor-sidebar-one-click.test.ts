/**
 * Advisor sidenav: one click navigates. Run:
 * npx --yes tsx lib/chrome/advisor-sidebar-one-click.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MODULE_NAV } from './module-nav';

const sidebar = readFileSync(resolve('components/Sidebar.tsx'), 'utf8');
assert.match(sidebar, /ADVISOR_OS_MODULE_IDS/);
// isAdvisorOsModule helper still defined (ADVISOR_OS_MODULE_IDS constant in use).
assert.match(sidebar, /function isAdvisorOsModule/);
assert.match(sidebar, /e\.preventDefault\(\);\s*\n\s*router\.push\(sub\.href\)/);
assert.match(sidebar, /router\.push\(mod\.href\)/);
assert.match(sidebar, /touch-manipulation/);
assert.match(sidebar, /@media\(hover:hover\)/);

import { MODULE_NAV } from './module-nav';

const ADVISOR_FLOOR_IDS = [
  'fitgraph',
  'physiograph',
  'dentalgraph',
  'psychiatrygraph',
  'medicalgraph',
  'vetgraph',
];
for (const id of ADVISOR_FLOOR_IDS) {
  const mod = MODULE_NAV.find((m) => m.id === id);
  assert.ok(mod, `${id} nav exists`);
  const sections = (mod!.steps as Array<{ name: string; section?: string }>).map(
    (s) => s.section || ''
  );
  const firstFloor = sections.indexOf('Floor');
  const lastFloor = sections.lastIndexOf('Floor');
  const floorRun = sections.slice(firstFloor, lastFloor + 1);
  assert.ok(
    floorRun.length > 0 && floorRun.every((s) => s === 'Floor'),
    `${id} must have one Floor block (Messages sits with calendar/bookings, not after Money)`
  );
  const messages = mod!.steps.find((s) => s.name === 'Messages');
  assert.ok(messages, `${id} has Messages`);
  assert.equal(messages!.section, 'Floor');
}

for (const id of ['fitgraph', 'medicalgraph'] as const) {
  const mod = MODULE_NAV.find((m) => m.id === id);
  const tasks = mod!.steps.find((s) => s.name === 'Tasks');
  assert.ok(tasks, `${id} has Tasks`);
  assert.equal(tasks!.section, 'Floor');
  assert.match(String(tasks!.href), /\/tasks$/);
}

// Chevron button is shown for ALL modules with children (no Advisor exclusion).
assert.match(sidebar, /mod\.sub\.length > 0 && \(/);
// isExpanded must NOT force-open Advisor modules.
assert.doesNotMatch(sidebar, /isAdvisorOsModule\(mod\.id\) \|\|/);

console.log('advisor-sidebar-one-click.test.ts ok');
