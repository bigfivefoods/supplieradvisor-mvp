/**
 * Run: npx --yes tsx lib/business/advisor-store-resolve.test.ts
 */
import assert from 'node:assert/strict';
import {
  isAdvisorModuleKey,
  isAdvisorTokenIndexKey,
} from './company-data';

assert.equal(isAdvisorModuleKey('fitgraph'), true);
assert.equal(isAdvisorModuleKey('physiograph'), true);
assert.equal(isAdvisorModuleKey('profiles'), false);
assert.equal(isAdvisorTokenIndexKey('fitgraph_public_token'), true);
assert.equal(isAdvisorTokenIndexKey('fitgraph_client_tokens'), true);
assert.equal(isAdvisorTokenIndexKey('physiograph_staff_tokens'), true);
assert.equal(isAdvisorTokenIndexKey('metadata'), false);
assert.equal(isAdvisorTokenIndexKey('fitgraph'), false);

console.log('advisor-store-resolve.test.ts ok');
