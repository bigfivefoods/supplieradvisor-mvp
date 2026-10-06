import assert from 'node:assert/strict';
import { creditDecisionHtml, creditSubmittedHtml } from './credit-application-mail';

const submitted = creditSubmittedHtml({
  sellerName: 'Big Five Foods',
  applicantName: 'Palm Footwear',
  requested: 'R 50,000.00',
  terms: '30 days',
});
assert.match(submitted, /Palm Footwear/);
assert.equal(submitted.includes('1234567890'), false);

const decided = creditDecisionHtml({
  sellerName: 'Big Five Foods',
  decision: 'approved',
  limit: 'R 40,000.00',
  terms: '30 days',
  notes: 'Trade references checked',
});
assert.match(decided, /approved a credit limit/);
assert.equal(decided.includes('account number'), false);

console.log('credit-application-mail.test.ts ok');
