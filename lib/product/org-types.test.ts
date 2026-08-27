/**
 * Run: npx --yes tsx lib/product/org-types.test.ts
 */
import assert from 'node:assert/strict';
import {
  orgTypeFromCompany,
  resolveB2bOrgType,
} from './org-types';

assert.equal(resolveB2bOrgType('npo')?.id, 'npo');
assert.equal(resolveB2bOrgType('NPO / NPC')?.id, 'npo');
assert.equal(resolveB2bOrgType('Non-Profit Company (NPC)')?.id, 'npo');
assert.equal(resolveB2bOrgType('consumer_org')?.id, 'npo');
assert.equal(resolveB2bOrgType('NGO / Impact organisation')?.id, 'npo');
assert.equal(resolveB2bOrgType('private')?.id, 'private');
assert.equal(resolveB2bOrgType('association')?.id, 'association');
assert.equal(resolveB2bOrgType('Community organisation'), null);

assert.equal(
  orgTypeFromCompany({ business_type: 'consumer_org' })?.id,
  'npo'
);
assert.equal(
  orgTypeFromCompany({ legal_form: 'npo', business_type: 'business' })?.id,
  'npo'
);

console.log('org-types tests ok');
