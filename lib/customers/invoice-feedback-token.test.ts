/**
 * Run: npx --yes tsx lib/customers/invoice-feedback-token.test.ts
 */
import assert from 'node:assert/strict';
import {
  buildInvoiceFeedbackToken,
  parseInvoiceFeedbackToken,
} from './invoice-feedback-token';

process.env.INVOICE_FEEDBACK_SECRET = 'test-invoice-feedback-secret';
process.env.INVOICE_FEEDBACK_ALLOW_LEGACY = 'true';

const token = buildInvoiceFeedbackToken({
  companyId: 102,
  invoiceId: 9,
  invoiceNumber: 'M1WD',
});
assert.match(token, /^i1\./);
const parsed = parseInvoiceFeedbackToken(token);
assert.equal(parsed?.companyId, 102);
assert.equal(parsed?.invoiceId, 9);
assert.equal(parsed?.invoiceNumber, 'M1WD');

const tampered = token.slice(0, -2) + 'ab';
assert.equal(parseInvoiceFeedbackToken(tampered), null);

const expired = buildInvoiceFeedbackToken({
  companyId: 102,
  invoiceId: 9,
  ttlSeconds: -10,
});
assert.equal(parseInvoiceFeedbackToken(expired), null);

assert.deepEqual(parseInvoiceFeedbackToken('v1_102_9_M1WD'), {
  companyId: 102,
  invoiceId: 9,
  invoiceNumber: 'M1WD',
});

process.env.INVOICE_FEEDBACK_ALLOW_LEGACY = 'false';
assert.equal(parseInvoiceFeedbackToken('v1_102_9_M1WD'), null);
assert.ok(parseInvoiceFeedbackToken(token));

console.log('invoice-feedback-token tests ok');
