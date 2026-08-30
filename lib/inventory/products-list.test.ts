/**
 * Run: npx --yes tsx lib/inventory/products-list.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const src = readFileSync(resolve('app/api/inventory/products/route.ts'), 'utf8');
const get = src.split('export async function POST')[0];
assert.match(get, /PRODUCT_LIST_COLUMNS/);
assert.match(get, /stripSelectColumn/);
assert.match(get, /missingSelectColumn/);
const cols = /const PRODUCT_LIST_COLUMNS =\s*'([^']+)'/.exec(src)?.[1] || '';
assert.ok(cols.includes('status'));
assert.equal(cols.includes('is_active'), false);

console.log('products-list.test.ts ok');
