/**
 * TradeAdvisor® lives in the core sidebar the same way GymAdvisor® does.
 * Run: npx --yes tsx lib/chrome/trade-sidebar.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MODULE_NAV } from './module-nav';
import { ADVISOR_OS_MODULE_IDS, functionalSidebarModules } from './functional-nav';
import { isStepActive } from './module-lifecycles';
import { officeHrefAliases, officeOn, officeUsesCoreSidebar } from '../trades/office-nav';
import { OFFICE_NAV_GROUPS } from '../../components/trades/TradeOffice';

const trade = MODULE_NAV.find((m) => m.id === 'tradegraph');
const gym = MODULE_NAV.find((m) => m.id === 'fitgraph');
assert.ok(trade, 'TradeAdvisor® is registered in MODULE_NAV');
assert.ok(gym, 'GymAdvisor® is registered in MODULE_NAV');
assert.equal(trade!.name, 'TradeAdvisor®');
assert.ok(ADVISOR_OS_MODULE_IDS.includes('tradegraph'));
assert.ok(ADVISOR_OS_MODULE_IDS.includes('fitgraph'));

const expected = [
  ['Floor', 'Home', '/dashboard/tradegraph'],
  ['Floor', 'Jobs', '/dashboard/tradegraph/board'],
  ['Floor', 'Quote', '/dashboard/tradegraph/quote'],
  ['Floor', 'Gantt', '/dashboard/tradegraph/gantt'],
  ['Floor', 'Calendar', '/dashboard/tradegraph/calendar'],
  ['Money', 'Invoices', '/dashboard/tradegraph/invoices'],
  ['Money', 'Reports', '/dashboard/tradegraph/reports'],
  ['People', 'Customers', '/dashboard/tradegraph/customers'],
  ['People', 'Team', '/dashboard/tradegraph/team'],
  ['People', 'Sites', '/dashboard/tradegraph/sites'],
  ['People', 'Messages', '/dashboard/tradegraph/messages'],
  ['People', 'Reviews', '/dashboard/tradegraph/reviews'],
  ['Yard', 'Materials', '/dashboard/tradegraph/materials'],
  ['Yard', 'Tasks', '/dashboard/tradegraph/tasks'],
  ['Yard', 'Arrival', '/dashboard/tradegraph/arrival'],
  ['Yard', 'Compliance', '/dashboard/tradegraph/compliance'],
  ['Yard', 'Notices', '/dashboard/tradegraph/notices'],
  ['Yard', 'Website', '/dashboard/tradegraph/website'],
] as const;

assert.deepEqual(
  trade!.steps.map((step) => [step.section, step.name, step.href]),
  expected.map((row) => [...row])
);
assert.deepEqual(
  OFFICE_NAV_GROUPS.flatMap((group) => group.items.map((item) => [group.label, item.label, item.href])),
  expected.map((row) => [row[0], row[1], row[2].replace('/dashboard/tradegraph', '')])
);
assert.equal(trade!.steps[0]?.exact, true, 'Home highlights only the office root');
assert.ok(
  trade!.steps.every((step) => step.rail !== false),
  'TradeAdvisor® steps stay on the process rail, like GymAdvisor®'
);
assert.ok(gym!.steps.every((step) => step.rail !== false));

const sidebar = functionalSidebarModules({
  isModuleEnabled: () => true,
  packaging: null,
  simplifiedSchool: false,
}).find((mod) => mod.id === 'tradegraph');
assert.ok(sidebar);
assert.equal(sidebar!.name, 'TradeAdvisor®');
assert.deepEqual(
  sidebar!.sub.map((step) => step.name),
  expected.map((row) => row[1])
);
assert.deepEqual(
  sidebar!.sub.map((step) => step.section),
  expected.map((row) => row[0])
);

assert.equal(isStepActive('/dashboard/tradegraph', '/dashboard/tradegraph', true), true);
assert.equal(isStepActive('/dashboard/tradegraph/board', '/dashboard/tradegraph', true), false);
assert.equal(isStepActive('/dashboard/tradegraph/board', '/dashboard/tradegraph/board'), true);
assert.equal(isStepActive('/dashboard/tradegraph/jobs', '/dashboard/tradegraph/board'), true);
assert.equal(isStepActive('/dashboard/tradegraph/jobs?new=1', '/dashboard/tradegraph/quote'), false);
assert.equal(isStepActive('/dashboard/tradegraph/schedule', '/dashboard/tradegraph/calendar'), true);
assert.equal(isStepActive('/dashboard/tradegraph/gantt', '/dashboard/tradegraph/gantt'), true);
assert.equal(isStepActive('/dashboard/fitgraph/calendar', '/dashboard/fitgraph/calendar'), true);

assert.equal(officeUsesCoreSidebar('/dashboard/tradegraph'), true);
assert.equal(officeUsesCoreSidebar('/preview/tradegraph'), false);
assert.equal(officeUsesCoreSidebar('/customer/tradegraph/demo'), false);
assert.deepEqual(officeHrefAliases('/board'), ['/jobs']);
assert.equal(officeOn('/preview/tradegraph', '/preview/tradegraph', ''), true);
assert.equal(officeOn('/preview/tradegraph/board', '/preview/tradegraph', ''), false);
assert.equal(officeOn('/preview/tradegraph/board', '/preview/tradegraph', '/board'), true);
assert.equal(officeOn('/preview/tradegraph/jobs', '/preview/tradegraph', '/board'), true);
assert.equal(officeOn('/preview/tradegraph/schedule', '/preview/tradegraph', '/calendar'), true);
assert.equal(officeOn('/dashboard/tradegraph/invoices', '/dashboard/tradegraph', '/invoices'), true);

const office = readFileSync(resolve('components/trades/TradeOffice.tsx'), 'utf8');
const coreAt = office.indexOf('officeUsesCoreSidebar(base)');
const asideAt = office.indexOf('aria-label="TradeAdvisor®"');
assert.ok(coreAt > 0 && asideAt > coreAt, 'dashboard returns before the in-page sidebar');
assert.match(office, /data-office-chrome="core"/);
assert.match(office, /data-office-chrome="preview"/);
assert.match(office, /lg:hidden/);

const appShell = readFileSync(resolve('components/chrome/AppShell.tsx'), 'utf8');
assert.match(appShell, /<Sidebar forceExpanded/);
const processBar = readFileSync(resolve('components/chrome/ModuleProcessBar.tsx'), 'utf8');
assert.match(processBar, /aria-label="Open menu"/);
assert.match(processBar, /onOpenMobileMenu/);

const sidebarSource = readFileSync(resolve('components/Sidebar.tsx'), 'utf8');
assert.match(sidebarSource, /isAdvisorOsModule\(mod\.id\)/);
assert.match(sidebarSource, /expandedModules\[mod\.id\] !== false/);
assert.match(sidebarSource, /tradeStepAliases/);

const customer = readFileSync(resolve('components/trades/CustomerTradeApp.tsx'), 'utf8');
assert.match(customer, /fixed inset-x-0 bottom-0/);
const memberShell = readFileSync(resolve('components/advisors/MemberAdvisorShell.tsx'), 'utf8');
assert.match(memberShell, /fixed inset-x-0 bottom-0/);
const work = readFileSync(resolve('components/trades/WorkPwa.tsx'), 'utf8');
assert.match(work, /MemberAdvisorShell/);
assert.match(work, /mobileNav="bottom"/);

const skin = readFileSync(resolve('lib/brand/advisor-skins.ts'), 'utf8');
assert.match(skin, /skin\.id === 'trade' \? '#0f172a'/);

console.log('trade-sidebar.test.ts ok');
