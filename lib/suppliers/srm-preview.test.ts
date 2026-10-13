/**
 * Run: npx --yes tsx lib/suppliers/srm-preview.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isSrmPreviewId, srmPreviewBook, srmPreviewJson } from './srm-preview';

assert.equal(isSrmPreviewId(-11), true);
assert.equal(isSrmPreviewId(11), false);
assert.equal(isSrmPreviewId(0), false);

const book = srmPreviewBook('2026-10-13');
assert.ok(book.suppliers.every((row) => row.id < 0));
assert.equal(book.suppliers[0]?.trading_name, 'Kelpac Marine');
assert.ok((book.suppliers[0]?.certifications || []).includes('HACCP'));
assert.equal(book.purchaseOrders.length, 2);
assert.equal(book.scorecards[0]?.ot_percent, 98);

const list = srmPreviewJson('/api/suppliers?companyId=1') as { suppliers: { id: number }[] };
assert.equal(list.suppliers.length, book.suppliers.length);
const one = srmPreviewJson('/api/suppliers?companyId=1&id=-11') as {
  suppliers: { trading_name: string }[];
};
assert.equal(one.suppliers[0]?.trading_name, 'Kelpac Marine');
const pos = srmPreviewJson('/api/suppliers/purchase-orders?companyId=1') as {
  purchaseOrders: unknown[];
};
assert.equal(pos.purchaseOrders.length, 2);
const docs = srmPreviewJson('/api/suppliers/documents?companyId=1&supplierId=-12') as {
  documents: unknown[];
};
assert.equal(docs.documents.length, 0);
const scores = srmPreviewJson('/api/suppliers/otifef?companyId=1') as { rows: unknown[] };
assert.equal(scores.rows.length, 1);
assert.equal(srmPreviewJson('/pricing'), null);

const src = readFileSync(resolve('lib/suppliers/srm-preview.ts'), 'utf8');
assert.doesNotMatch(src, /supabase/i);
assert.doesNotMatch(src, /\.insert\(/);
assert.doesNotMatch(src, /persist/);
const page = readFileSync(resolve('lib/preview/install-preview-fetch.ts'), 'utf8');
assert.match(page, /nothing was saved on SupplierAdvisor®/);
assert.match(page, /method !== 'GET'/);
assert.match(readFileSync(resolve('app/preview/srm/preview-client.tsx'), 'utf8'), /FixtureStudio/);

console.log('suppliers/srm-preview.test.ts ok');
