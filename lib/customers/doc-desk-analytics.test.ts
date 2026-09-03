/**
 * Run: npx --yes tsx lib/customers/doc-desk-analytics.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  docsDeskTotals,
  docsValueByCustomer,
  docsValueByTime,
} from './doc-desk-analytics';

const docs = [
  {
    id: 1,
    created_at: '2026-09-02T10:00:00.000Z',
    customer_id: 10,
    customer_name: 'Acme',
    total_amount: 100,
    currency: 'ZAR',
    status: 'sent',
  },
  {
    id: 2,
    created_at: '2026-09-02T08:00:00.000Z',
    customer_id: 11,
    customer_name: 'Beta',
    total_amount: 50,
    currency: 'ZAR',
    status: 'draft',
  },
  {
    id: 3,
    created_at: '2026-09-10T12:00:00.000Z',
    customer_id: 10,
    customer_name: 'Acme',
    total_amount: 20,
    currency: 'ZAR',
    status: 'sent',
  },
];

const byTime = docsValueByTime(docs, '2026-09-01', '2026-09-30');
assert.equal(byTime.length, 2);
assert.equal(byTime[0].count, 2);
assert.equal(byTime[0].amount, 150);

const byCust = docsValueByCustomer(docs);
assert.equal(byCust[0].label, 'Acme');
assert.equal(byCust[0].amount, 120);

const tot = docsDeskTotals(docs);
assert.equal(tot.count, 3);
assert.equal(tot.amount, 170);

const ws = readFileSync(
  resolve('components/customers/DocumentWorkspace.tsx'),
  'utf8'
);
assert.match(ws, /DocDeskAnalytics/);
assert.match(ws, /initialPeriodSlicerValue\('this_month'\)/);
assert.match(ws, /expandableList/);
assert.match(ws, /Expand all/);
assert.match(ws, /type === 'invoice'/);

const analyticsUi = readFileSync(
  resolve('components/customers/DocDeskAnalytics.tsx'),
  'utf8'
);
assert.match(analyticsUi, /PeriodSlicer/);
assert.match(analyticsUi, /By customer/);
assert.match(analyticsUi, /All customers/);

console.log('doc-desk-analytics.test.ts ok');
