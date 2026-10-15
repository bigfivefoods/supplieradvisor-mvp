/**
 * Safety kinds, expiry window, and no identity numbers.
 * Run: npx --yes tsx lib/construction/brief113-safety.test.ts
 */
import assert from 'node:assert/strict';
import { assertSafetyRows, expiryFlag, expiringInductions, LEGACY_SAFETY_KINDS } from './safety-model';

assert.equal(expiryFlag('2026-11-01', '2026-10-15'), 'expiring');
assert.equal(expiryFlag('2026-10-01', '2026-10-15'), 'expired');
assert.equal(expiryFlag('2026-12-20', '2026-10-15'), 'ok');
assert.equal(expiryFlag(undefined, '2026-10-15'), 'none');
assert.deepEqual(LEGACY_SAFETY_KINDS, ['toolbox', 'incident', 'inspection', 'permit']);

const rows = [
  { id: 'a', kind: 'toolbox', title: 'Talk', status: 'closed' },
  { id: 'b', kind: 'induction', title: 'Induction', person_name: 'Sample Person', expires_on: '2026-11-01', status: 'open' },
];
assert.equal(assertSafetyRows(rows).ok, true);
assert.equal(expiringInductions(rows, '2026-10-15').length, 1);
assert.equal(assertSafetyRows([{ id: 'c', kind: 'induction', title: 'No', id_number: '800101' } as never]).ok, false);
assert.equal(assertSafetyRows([{ id: 'd', kind: 'incident', title: 'Near', severity: 'near_miss' }]).ok, true);
assert.equal(assertSafetyRows([{ id: 'e', kind: 'incident', title: 'Bad', severity: 'score' }]).ok, false);

console.log('brief113-safety.test.ts ok');
