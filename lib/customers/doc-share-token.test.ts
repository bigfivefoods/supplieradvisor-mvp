/**
 * Run: npx --yes tsx lib/customers/doc-share-token.test.ts
 */
import assert from 'node:assert/strict';
import { buildDocShareToken, parseDocShareToken } from './doc-share-token';

const prevNode = process.env.NODE_ENV;
const prevVercel = process.env.VERCEL_ENV;
const prevSecret = process.env.DOC_SHARE_SECRET;
const prevFeedback = process.env.INVOICE_FEEDBACK_SECRET;
const prevCron = process.env.CRON_SECRET;

process.env.NODE_ENV = 'test';
process.env.VERCEL_ENV = 'development';
delete process.env.DOC_SHARE_SECRET;

const t = buildDocShareToken({ companyId: 1, type: 'invoice', id: 9 });
assert.match(t, /^d1\./);
assert.equal(parseDocShareToken(t)?.id, 9);

process.env.NODE_ENV = 'production';
process.env.VERCEL_ENV = 'production';
delete process.env.DOC_SHARE_SECRET;
delete process.env.INVOICE_FEEDBACK_SECRET;
process.env.CRON_SECRET = 'cron-prod-fallback';
const viaCron = buildDocShareToken({ companyId: 1, type: 'invoice', id: 11 });
assert.equal(parseDocShareToken(viaCron)?.id, 11);
delete process.env.CRON_SECRET;
try {
  buildDocShareToken({ companyId: 1, type: 'invoice', id: 9 });
  assert.fail('expected HMAC secret required');
} catch (e) {
  assert.match(String(e), /DOC_SHARE_SECRET/);
}

process.env.NODE_ENV = prevNode;
process.env.VERCEL_ENV = prevVercel;
if (prevSecret) process.env.DOC_SHARE_SECRET = prevSecret;
else delete process.env.DOC_SHARE_SECRET;
if (prevFeedback) process.env.INVOICE_FEEDBACK_SECRET = prevFeedback;
else delete process.env.INVOICE_FEEDBACK_SECRET;
if (prevCron) process.env.CRON_SECRET = prevCron;
else delete process.env.CRON_SECRET;

console.log('doc-share-token tests ok');
