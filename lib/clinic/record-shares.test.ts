/**
 * Run: npx --yes tsx lib/clinic/record-shares.test.ts
 */
import assert from 'node:assert/strict';
import { normalizeRecordShares } from './record-shares';
import { scopesAllowedForPractitioner } from '@/lib/services/advisor-b2c-relationship';

const grants = normalizeRecordShares([
  {
    id: 'g1',
    person_id: 'p1',
    from_company_id: 1,
    from_module: 'physio',
    to: { type: 'practitioner', practitioner_id: 'pr1', label: 'Dr A' },
    scopes: ['summary', 'scripts', 'nope'],
    status: 'active',
    requested_by: 'practice',
    created_at: '2026-08-01',
    consented_at: '2026-08-01',
    consent_source: 'desk',
  },
  { id: 'bad' },
]);
assert.equal(grants.length, 1);
assert.equal(grants[0].to.type, 'practitioner');
assert.deepEqual(grants[0].scopes, ['summary', 'scripts']);
assert.deepEqual(scopesAllowedForPractitioner(grants, 'p1', 'pr1'), [
  'summary',
  'scripts',
]);
assert.deepEqual(scopesAllowedForPractitioner(grants, 'p1', 'pr2'), []);

console.log('record-shares ok');
