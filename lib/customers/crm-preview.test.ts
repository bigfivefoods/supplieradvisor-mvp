/**
 * Run: npx --yes tsx lib/customers/crm-preview.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  crmPreviewBook,
  crmPreviewJson,
  customerActivity,
  isCrmPreviewId,
  sortCrmRows,
} from './crm-preview';

assert.equal(isCrmPreviewId(-1), true);
assert.equal(isCrmPreviewId(1), false);
assert.equal(isCrmPreviewId(0), false);
assert.equal(isCrmPreviewId(null), false);

const book = crmPreviewBook('2026-10-13');
assert.ok(book.customers.every((c) => c.id < 0));
assert.ok(book.leads.every((l) => l.id < 0));
assert.ok(book.opportunities.every((o) => o.id < 0));
assert.ok(book.tasks.every((t) => t.id < 0));
assert.ok(book.summary.customers > 0);
assert.ok(book.summary.pipelineValue > 0);
assert.ok(book.desk.length > 0);
assert.equal(book.summary.overdueFollowups > 0, true);

const sorted = sortCrmRows(book.customers, (c) => c.trading_name);
assert.equal(sorted[0]?.trading_name, 'Harbour & Co');
assert.notEqual(sorted, book.customers);

const timeline = customerActivity({
  name: 'Harbour & Co',
  created_at: '2026-09-01',
  notes: 'Tuesday delivery',
  invite_status: 'accepted',
  contact_name: 'Thandi Nkosi',
  city: 'Cape Town',
});
assert.ok(timeline.some((item) => item.title === 'Note' && item.detail === 'Tuesday delivery'));
assert.ok(timeline.some((item) => item.tone === 'good'));

const summary = crmPreviewJson('/api/customers/summary?companyId=1') as { summary: { customers: number } };
assert.equal(summary.summary.customers, book.customers.length);
const one = crmPreviewJson('/api/customers?companyId=1&id=-1') as {
  book: boolean;
  customers: { id: number }[];
};
assert.equal(one.book, true);
assert.equal(one.customers[0]?.id, -1);
assert.equal(crmPreviewJson('/pricing'), null);

const src = readFileSync(resolve('lib/customers/crm-preview.ts'), 'utf8');
assert.doesNotMatch(src, /supabase/i);
assert.doesNotMatch(src, /\.insert\(/);
assert.match(src, /SupplierAdvisor®/);
assert.match(src, /Super-Cube®/);
assert.doesNotMatch(src, /#0099b8/);

console.log('customers/crm-preview.test.ts ok');
