/**
 * Advisor sidenav: one click navigates. Run:
 * npx --yes tsx lib/chrome/advisor-sidebar-one-click.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sidebar = readFileSync(resolve('components/Sidebar.tsx'), 'utf8');
assert.match(sidebar, /ADVISOR_OS_MODULE_IDS/);
assert.match(sidebar, /isAdvisorOsModule\(mod\.id\)/);
assert.match(sidebar, /e\.preventDefault\(\);\s*\n\s*router\.push\(sub\.href\)/);
assert.match(sidebar, /router\.push\(mod\.href\)/);
assert.match(sidebar, /touch-manipulation/);
assert.match(sidebar, /@media\(hover:hover\)/);
assert.match(sidebar, /!isAdvisorOsModule\(mod\.id\) &&/);

console.log('advisor-sidebar-one-click.test.ts ok');
