/**
 * Run: npx --yes tsx lib/riad/slice-metrics.test.ts
 */
import assert from 'node:assert/strict';
import { riadSlicePack, riadSummaryOf } from './slice-metrics';

const items = [
  { entry_type: 'risk', status: 'open', severity: 'critical', owner_name: 'Craig', category: 'Delivery / OTIF', created_at: '2026-08-01' },
  { entry_type: 'issue', status: 'in_progress', severity: 'medium', owner_name: 'Craig', category: 'Credit / payment', created_at: '2026-08-10' },
  { entry_type: 'action', status: 'closed', severity: 'low', owner_name: 'Ada', category: 'Onboarding', created_at: '2026-07-02' },
  { entry_type: 'decision', status: 'open', severity: 'high', owner_name: null, category: null, created_at: '2026-08-20' },
];

const sum = riadSummaryOf(items);
assert.equal(sum.total, 4);
assert.equal(sum.open, 3);
assert.equal(sum.closed, 1);
assert.equal(sum.inProgress, 1);
assert.equal(sum.critical, 1);

const pack = riadSlicePack(items);
assert.equal(pack.byType.find((s) => s.label === 'Risk')?.value, 1);
assert.equal(pack.bySeverity.find((s) => s.label === 'Critical')?.value, 1);
assert.equal(pack.byOwner.find((s) => s.label === 'Craig')?.value, 2);
assert.equal(pack.byOwner.find((s) => s.label === 'Unassigned')?.value, 1);
assert.equal(pack.byCategory.find((s) => s.label === 'Uncategorised')?.value, 1);
assert.equal(pack.byMonth.length, 6);

console.log('slice-metrics.test.ts ok');
