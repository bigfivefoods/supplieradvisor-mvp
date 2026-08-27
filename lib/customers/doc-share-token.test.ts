/**
 * Run: npx --yes tsx lib/customers/doc-share-token.test.ts
 */
import assert from 'node:assert/strict';
import { buildDocShareToken, parseDocShareToken } from './doc-share-token';

const prevNode = process.env.NODE_ENV;
const prevVercel = process.env.VERCEL_ENV;
const prevSecret = process.env.DOC_SHARE_SECRET;

process.env.NODE_ENV = 'test';
process.env.VERCEL_ENV = 'development';
delete process.env.DOC_SHARE_SECRET;

const t = buildDocShareToken({ companyId: 1, type: 'invoice', id: 9 });
assert.match(t, /^d1\./);
assert.equal(parseDocShareToken(t)?.id, 9);

process.env.NODE_ENV = 'production';
process.env.VERCEL_ENV = 'production';
delete process.env.DOC_SHARE_SECRET;
try {
  buildDocShareToken({ companyId: 1, type: 'invoice', id: 9 });
  assert.fail('expected DOC_SHARE_SECRET required');
} catch (e) {
  assert.match(String(e), /DOC_SHARE_SECRET/);
}

process.env.NODE_ENV = prevNode;
process.env.VERCEL_ENV = prevVercel;
if (prevSecret) process.env.DOC_SHARE_SECRET = prevSecret;

console.log('doc-share-token tests ok');
