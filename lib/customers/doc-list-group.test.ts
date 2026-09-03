/**
 * Run: npx --yes tsx lib/customers/doc-list-group.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  filterGroupedDocs,
  groupDocs,
  groupMoneyTotal,
} from './doc-list-group';

const docs = [
  {
    id: 1,
    created_at: '2026-09-02T10:00:00.000Z',
    customer_id: 10,
    customer_name: 'Acme',
    total_amount: 100,
    currency: 'ZAR',
  },
  {
    id: 2,
    created_at: '2026-09-02T08:00:00.000Z',
    customer_id: 11,
    customer_name: 'Beta',
    total_amount: 50,
    currency: 'ZAR',
  },
  {
    id: 3,
    created_at: '2026-09-01T12:00:00.000Z',
    customer_id: 10,
    customer_name: 'Acme',
    total_amount: 20,
    currency: 'ZAR',
  },
  {
    id: 4,
    created_at: null,
    customer_id: null,
    customer_name: null,
    total_amount: 5,
    currency: 'ZAR',
  },
];

const byDate = groupDocs(docs, 'date');
assert.deepEqual(
  byDate.map((g) => g.key),
  ['2026-09-02', '2026-09-01', 'none']
);
assert.equal(byDate[0].items.length, 2);
assert.equal(byDate[0].label, '2 Sep 2026');

const byCustomer = groupDocs(docs, 'customer');
assert.deepEqual(
  byCustomer.map((g) => g.label),
  ['Acme', 'Beta', 'No customer']
);
assert.equal(byCustomer[0].items.length, 2);

const acme = filterGroupedDocs(docs, { customerId: '10' });
assert.deepEqual(
  acme.map((d) => d.id),
  [1, 3]
);

const day = filterGroupedDocs(docs, {
  dateFrom: '2026-09-02',
  dateTo: '2026-09-02',
});
assert.deepEqual(
  day.map((d) => d.id),
  [1, 2]
);

const tot = groupMoneyTotal(byDate[0].items);
assert.equal(tot?.amount, 150);
assert.equal(tot?.currency, 'ZAR');

assert.equal(groupDocs(docs, 'none').length, 1);
assert.equal(groupDocs(docs, 'none')[0].label, '');

const ws = readFileSync(
  resolve('components/customers/DocumentWorkspace.tsx'),
  'utf8'
);
assert.match(ws, /View: by date/);
assert.match(ws, /View: by customer/);
assert.match(ws, /listCustomerId/);
assert.match(ws, /groupDocs/);
assert.match(ws, /canGroupList = type === 'quote' \|\| type === 'order'/);

const route = readFileSync(
  resolve('app/api/customers/docs/route.ts'),
  'utf8'
);
assert.match(route, /customerId/);
assert.match(route, /searchParams.get\('from'\)/);
assert.match(route, /searchParams.get\('to'\)/);
assert.match(route, /kind === 'quote' \|\| kind === 'order'/);

console.log('doc-list-group.test.ts ok');
