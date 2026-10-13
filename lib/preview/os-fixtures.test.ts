/**
 * Run: npx --yes tsx lib/preview/os-fixtures.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { mapFixtureHref } from './fixture-href';
import { osDashboardHome, osInventorySummary, previewJson } from './os-fixtures';

const home = previewJson('/api/dashboard/home?companyId=1') as { company: { trading_name: string } };
assert.equal(home.company.trading_name, osDashboardHome().company.trading_name);

const stock = previewJson('/api/inventory/summary?companyId=1') as {
  summary: { products: number };
};
assert.equal(stock.summary.products, osInventorySummary().products);

const sheq = previewJson('/api/sheq/summary?companyId=1') as {
  counts: { incidentsOpen: number };
};
assert.equal(sheq.counts.incidentsOpen, 1);

const ratings = previewJson('/api/business/ratings?companyId=1&role=customer') as {
  aggregates: { name: string }[];
};
assert.equal(ratings.aggregates[0]?.name, 'Atlantic Table');

const pos = previewJson('/api/suppliers/purchase-orders?companyId=1') as {
  purchaseOrders: { id: number; po_number: string }[];
};
assert.ok(pos.purchaseOrders.every((row) => row.id < 0));
assert.equal(pos.purchaseOrders[0]?.po_number, 'PO-4410');

assert.equal(previewJson('/pricing'), null);
assert.equal(previewJson('/api/not-a-sample'), null);

assert.equal(mapFixtureHref('/dashboard/customers/leads?tab=pipeline'), '/preview/crm?screen=pipeline');
assert.equal(mapFixtureHref('/dashboard/inventory/stock?low=1'), '/preview/inventory?screen=stock&low=1');
assert.equal(mapFixtureHref('/dashboard/suppliers/po?po=12'), '/preview/po?po=12');
assert.equal(mapFixtureHref('/preview/crm'), null);

const src = readFileSync(resolve('lib/preview/os-fixtures.ts'), 'utf8');
const gate = readFileSync(resolve('lib/preview/install-preview-fetch.ts'), 'utf8');
assert.doesNotMatch(src, /supabase/i);
assert.doesNotMatch(src, /\.insert\(/);
assert.doesNotMatch(gate, /supabase/i);
assert.match(gate, /nothing was saved on SupplierAdvisor®/);
assert.match(gate, /method !== 'GET'/);
assert.match(gate, /parsed\.origin === window\.location\.origin/);
assert.match(gate, /auth\.privy\.io\/api\/v1\/apps/);
assert.doesNotMatch(src + gate, /#0099b8/);

console.log('preview/os-fixtures.test.ts ok');
