/**
 * Run: npx --yes tsx lib/chrome/customers-trade-nav.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MODULE_NAV } from './module-nav';

const customers = MODULE_NAV.find((m) => m.id === 'customers');
assert.ok(customers, 'customers module exists');

const tradeRail = customers!.steps
  .filter((s) => s.section === 'Trade' && s.rail !== false)
  .map((s) => s.name);

assert.deepEqual(tradeRail, [
  'Enquiry',
  'Quote',
  'Order',
  'Invoice',
  'Projects',
]);
assert.equal(
  customers!.steps.find((s) => s.name === 'Enquiry')?.href,
  '/dashboard/customers/enquiries'
);

const names = customers!.steps.filter((s) => s.rail !== false).map((s) => s.name);
const invoiceAt = names.indexOf('Invoice');
const projectsAt = names.indexOf('Projects');
assert.ok(invoiceAt >= 0 && projectsAt >= 0);
assert.ok(projectsAt === invoiceAt + 1, 'Projects sits immediately below Invoice');

const page = readFileSync(
  resolve('app/dashboard/customers/enquiries/page.tsx'),
  'utf8'
);
assert.match(page, /focus="enquiry"/);
assert.match(page, /DocumentWorkspace/);

const desk = readFileSync(
  resolve('components/customers/DocumentWorkspace.tsx'),
  'utf8'
);
assert.match(desk, /focus\?: 'enquiry'/);
assert.match(desk, /stable ENQ UID/);
assert.match(desk, /isEnquiryInboxRow/);
assert.match(desk, /resolveEnquiryUid/);

console.log('customers-trade-nav.test.ts ok');
