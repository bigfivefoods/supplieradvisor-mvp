/**
 * Advisor sidenav: one click navigates. Run:
 * npx --yes tsx lib/chrome/advisor-sidebar-one-click.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sidebar = readFileSync(resolve('components/Sidebar.tsx'), 'utf8');
assert.match(sidebar, /ADVISOR_OS_MODULE_IDS/);
// isAdvisorOsModule helper still defined (ADVISOR_OS_MODULE_IDS constant in use).
assert.match(sidebar, /function isAdvisorOsModule/);
assert.match(sidebar, /e\.preventDefault\(\);\s*\n\s*router\.push\(sub\.href\)/);
assert.match(sidebar, /router\.push\(mod\.href\)/);
assert.match(sidebar, /touch-manipulation/);
assert.match(sidebar, /@media\(hover:hover\)/);

// Chevron button is shown for ALL modules with children (no Advisor exclusion).
assert.match(sidebar, /mod\.sub\.length > 0 && \(/);
// isExpanded must NOT force-open Advisor modules.
assert.doesNotMatch(sidebar, /isAdvisorOsModule\(mod\.id\) \|\|/);

console.log('advisor-sidebar-one-click.test.ts ok');
