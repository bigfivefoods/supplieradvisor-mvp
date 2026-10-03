/**
 * Run: npx --yes tsx lib/business/company-deeplink.test.ts
 */
import assert from 'node:assert/strict';
import { findDeepLinkedCompany, parseCompanyParam } from './company-deeplink';

assert.equal(parseCompanyParam('102'), '102');
assert.equal(parseCompanyParam(' 5748 '), '5748');
for (const bad of ['', '0', '-1', '12a', '1e3', '01', '1.5', null, undefined, '9999999999999']) {
  assert.equal(parseCompanyParam(bad as string), null, `should reject ${JSON.stringify(bad)}`);
}

const mine = [
  { id: '102', trading_name: 'Big Five Foods' },
  { id: '124', trading_name: 'Big Five Direct' },
];
assert.equal(findDeepLinkedCompany(mine, '102')?.trading_name, 'Big Five Foods');
assert.equal(findDeepLinkedCompany(mine, '125'), null, 'not a member: no auto-select');
assert.equal(findDeepLinkedCompany(mine, 'abc'), null);
assert.equal(findDeepLinkedCompany([], '102'), null);

console.log('company-deeplink tests passed');
