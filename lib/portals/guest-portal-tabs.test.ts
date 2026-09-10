/**
 * Run: npx --yes tsx lib/portals/guest-portal-tabs.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { guestPortalTabGroups, guestPortalTabs } from './guest-portal-tabs';

function src(rel: string) {
  return readFileSync(resolve(rel), 'utf8');
}

const customer = guestPortalTabs({ kind: 'customer' }).map((t) => t.id);
assert.deepEqual(customer, [
  'profile',
  'people',
  'docs',
  'enquiries',
  'quotes',
  'newpo',
  'orders',
  'stock',
  'statement',
  'projects',
  'otifef',
  'messages',
  'riad',
  'reviews',
  'demo',
]);
const customerLabels = guestPortalTabs({ kind: 'customer' }).map((t) => t.label);
assert.deepEqual(
  customerLabels.slice(3, 9),
  ['Enquiry', 'Quote', 'Order', 'Sales order', 'Stock', 'Statement']
);
assert.equal(customerLabels.includes('Commercial'), false);

const supplier = guestPortalTabs({ kind: 'supplier' }).map((t) => t.id);
assert.deepEqual(supplier, [
  'profile',
  'people',
  'docs',
  'orders',
  'commercial',
  'stock',
  'projects',
  'otifef',
  'messages',
  'riad',
  'reviews',
  'demo',
]);

const groups = guestPortalTabGroups({ kind: 'customer', profileGaps: 2 });
assert.equal(groups[0].id, 'account');
assert.equal(groups[1].id, 'trade');
assert.equal(groups[2].id, 'work');
assert.equal(groups[3].id, 'relate');
assert.equal(groups.at(-1)?.id, 'demo');
assert.equal(groups.at(-1)?.align, 'end');
assert.equal(groups[0].tabs[0].label, 'Profile (2)');
assert.equal(
  groups[1].tabs.find((t) => t.id === 'statement')?.label,
  'Statement'
);
assert.equal(guestPortalTabGroups({ kind: 'supplier' }).at(-1)?.id, 'demo');

const guest = src('components/portals/GuestTradeWorkspace.tsx');
assert.match(guest, /focus="enquiry"/);
assert.match(guest, /focus="quote"/);
assert.match(guest, /tab === 'commercial' && isSupplier/);
assert.doesNotMatch(guest, /Enquiry → order/);

const docPdf = src('app/api/public/portals/trade/doc-pdf/route.ts');
assert.match(docPdf, /'quote', 'order', 'invoice'/);
assert.match(docPdf, /loadCommercialDocument/);
assert.doesNotMatch(docPdf, /from\('profiles'\)[\s\S]{0,200}\bphone\b/);

console.log('guest-portal-tabs.test.ts ok');
