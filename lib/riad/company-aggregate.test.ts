/**
 * Run: npx --yes tsx lib/riad/company-aggregate.test.ts
 */
import assert from 'node:assert/strict';
import {
  mapCustomerRiad,
  mapOperationsRiad,
  mapSupplierRiad,
  normalizeSeverity,
  sortCompanyRiad,
} from './company-aggregate';
import { riadSlicePack } from './slice-metrics';

assert.equal(normalizeSeverity('critical'), 'critical');
assert.equal(normalizeSeverity(5), 'critical');
assert.equal(normalizeSeverity(2, 'high'), 'high');
assert.equal(normalizeSeverity(null), 'medium');

const c = mapCustomerRiad(
  {
    id: 11,
    entry_type: 'risk',
    title: 'Credit hold',
    status: 'open',
    severity: 'high',
    created_at: '2026-08-20T00:00:00.000Z',
  },
  'Boxer'
);
assert.equal(c.source, 'customer');
assert.equal(c.party_name, 'Boxer');
assert.equal(c.href, '/dashboard/customers/riad-log');

const s = mapSupplierRiad(
  {
    id: 7,
    entry_type: 'issue',
    title: 'Late lots',
    status: 'in_progress',
    priority: 'medium',
    created_at: '2026-08-21T00:00:00.000Z',
  },
  'Kelpac'
);
assert.equal(s.source, 'supplier');
assert.equal(s.severity, 'medium');

const o = mapOperationsRiad({
  id: 3,
  riad_type: 'action',
  title: 'Count outlet 4',
  status: 'open',
  severity: 4,
  container_name: 'Sandton kiosk',
  created_at: '2026-08-22T00:00:00.000Z',
});
assert.equal(o.source, 'operations');
assert.equal(o.severity, 'high');
assert.equal(o.party_name, 'Sandton kiosk');

const sorted = [c, s, o].sort(sortCompanyRiad);
assert.equal(sorted[0].key, 'operations:3');

const pack = riadSlicePack(
  [c, s, o].map((r) => ({
    entry_type: r.entry_type,
    status: r.status,
    severity: r.severity,
    source: r.source,
    created_at: r.created_at,
  }))
);
assert.equal(pack.summary.total, 3);
assert.equal(pack.bySource.length, 3);

console.log('company-aggregate.test.ts ok');
