/**
 * Run: npx --yes tsx lib/advisors/process-flows/brief121-core-mounts.test.ts
 * Every core id in MODULE_NAV is mounted, skipped with a reason, or held for a later change.
 * Later is not a skip: those modules still need a flow, and this change does not ship them.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ADVISOR_OS_MODULE_IDS } from '../../chrome/functional-nav';
import { MODULE_NAV } from '../../chrome/module-nav';
import { CORE_FLOWS } from './core';
import { ADVISOR_FLOWS } from './index';

const MOUNTED: Record<string, string> = {
  home: 'app/dashboard/page.tsx',
  suppliers: 'app/dashboard/suppliers/page.tsx',
  customers: 'app/dashboard/customers/page.tsx',
  'sales-portal': 'app/sales/page.tsx',
};

const SKIPPED: Record<string, string> = {
  intelligence: 'Read-only analysis. No hand-off and no job to do in order.',
  'my-business': 'Settings and identity. It already has its own checklist.',
  platform: 'Internal console for platform staff. Not a customer workflow.',
  guide: 'The page is the training diagram. A flow on top would repeat it.',
};

const LATER: Record<string, string> = {
  operations: 'Later. The hub already has numbered stage cards.',
  manufacturing: 'Later. The make screens are a real chain.',
  distribution: 'Later. Proof of delivery is only an event label today.',
  inventory: 'Later. Catalogue, stock, transfers and counts are a real chain.',
  quality: 'Later. Inspection, trace and the recall drill are a real chain.',
  sheq: 'Later. Incident to corrective action is a real loop.',
  projects: 'Later. Some screens depend on migrations.',
  accounting: 'Later. Owner and finance only.',
  people: 'Later. Payroll records pay and does not pay staff from a bank.',
  sustainability: 'Later. The page guard uses the operations resource.',
  network: 'Later. Discover, invite, accept, price and trade is a short chain.',
};

const advisorIds = new Set<string>(ADVISOR_OS_MODULE_IDS);
const coreIds = MODULE_NAV.map((item) => item.id).filter((id) => !advisorIds.has(id));
const placed = [...Object.keys(MOUNTED), ...Object.keys(SKIPPED), ...Object.keys(LATER)];
assert.deepEqual([...placed].sort(), [...coreIds].sort());
assert.equal(new Set(placed).size, placed.length);

const doc = readFileSync('docs/advisor-process-flows.md', 'utf8');
for (const [id, reason] of Object.entries(SKIPPED)) {
  assert.ok(reason.length > 0, id);
  assert.match(doc, new RegExp(`\\| ${id} \\| Skipped\\.`));
}
for (const [id, reason] of Object.entries(LATER)) {
  assert.ok(reason.length > 0, id);
  assert.match(doc, new RegExp(`\\| ${id} \\| Later\\.`));
  assert.equal(id in CORE_FLOWS, false, id);
}
for (const id of Object.keys(MOUNTED)) assert.match(doc, new RegExp(`\\| ${id} \\| Mounted`));

for (const [id, file] of Object.entries(MOUNTED)) {
  const text = readFileSync(file, 'utf8');
  const tag = `<CoreProcessFlow module="${id}" />`;
  assert.equal((text.match(new RegExp(tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length, 1, id);
  assert.match(text, /import \{ CoreProcessFlow \} from '@\/components\/advisors\/CoreProcessFlow'/);
  assert.equal(/<CoreProcessFlow[^>]*\brole=/.test(text), false, id);
  assert.equal(/\bdefaultCollapsed\b/.test(text), false, id);
  assert.equal(/\bopenByDefault\b/.test(text), false, id);
  assert.ok(CORE_FLOWS[id as keyof typeof CORE_FLOWS], id);
  assert.equal(ADVISOR_FLOWS[id as keyof typeof ADVISOR_FLOWS], undefined, id);
}

const home = readFileSync(MOUNTED.home, 'utf8');
const homeFlow = home.indexOf('<CoreProcessFlow module="home" />');
const loadedMarker = home.indexOf('{loading && !kpis ? (');
const membershipAt = home.indexOf('if (membershipLoading && !fixtureStudio)');
const sendAt = home.indexOf('if (sendToAdvisor)', membershipAt);
const successAt = home.indexOf('return (', sendAt + 'if (sendToAdvisor)'.length);
assert.ok(home.lastIndexOf('</ExpandableSection>', homeFlow) > loadedMarker);
assert.equal(home.slice(membershipAt, successAt).includes('<CoreProcessFlow'), false);
assert.ok(homeFlow > successAt);

const suppliers = readFileSync(MOUNTED.suppliers, 'utf8');
const journey = suppliers.indexOf('<JourneyChecklist');
const catalogue = suppliers.indexOf('<CatalogueEmptyBanner');
const supplierFlow = suppliers.indexOf('<CoreProcessFlow module="suppliers" />');
const activity = suppliers.indexOf('<ActivityFeed');
assert.ok(journey < catalogue && catalogue < supplierFlow && supplierFlow < activity);
assert.equal(suppliers.includes('useCompanyRole'), false);

const customers = readFileSync(MOUNTED.customers, 'utf8');
assert.match(customers, /<CoreProcessFlow module="customers" \/>\s*<\/CustomersPage>/);
assert.ok(customers.indexOf('CRM_PATH.map') < customers.indexOf('<CoreProcessFlow'));
assert.equal(customers.includes('useCompanyRole'), false);

const sales = readFileSync(MOUNTED['sales-portal'], 'utf8');
const salesFlow = sales.indexOf('<CoreProcessFlow module="sales-portal" />');
assert.ok(salesFlow > sales.indexOf('Highest-value opportunities'));
assert.ok(salesFlow < sales.indexOf('function Kpi'));
assert.equal(sales.slice(sales.indexOf('if (loading) {'), sales.indexOf('if (error || !summary)')).includes('<CoreProcessFlow'), false);
assert.equal(sales.slice(sales.indexOf('if (error || !summary)'), sales.indexOf('Highest-value opportunities')).includes('<CoreProcessFlow'), false);
assert.equal(sales.includes('useCompanyRole'), false);

const landing = readFileSync('app/page.tsx', 'utf8');
assert.equal(landing.includes('lib/advisors/process-flows'), false);
assert.equal(landing.includes('components/advisors'), false);

const coreComponent = readFileSync('components/advisors/CoreProcessFlow.tsx', 'utf8');
assert.equal(/\bopenByDefault\b/.test(coreComponent), false);
assert.equal(coreComponent.includes("'owner'"), false);
assert.equal(coreComponent.includes('"owner"'), false);

for (const flow of Object.values(CORE_FLOWS)) {
  assert.match(flow.hrefRoot, /^\/dashboard(?:\/|$)|^\/sales$/);
}

console.log('brief121-core-mounts.test.ts ok');
