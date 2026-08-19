/**
 * Run: npx --yes tsx lib/people/org-code.test.ts
 */
import assert from 'node:assert/strict';
import { suggestOrgCode } from './org-code';

assert.equal(suggestOrgCode('Consulting', 'BU'), 'BU-CONSULTING');
assert.equal(suggestOrgCode('Exam couch 2', 'AST'), 'AST-EXAM-COUCH-2');
assert.match(suggestOrgCode('   ', 'WC'), /^WC-/);

console.log('org-code.test.ts ok');
