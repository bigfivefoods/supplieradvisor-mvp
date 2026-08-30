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
assert.ok(cols.includes('is_active'));

const sql = readFileSync(resolve('RUN_THIS_FOR_PRODUCTS_IS_ACTIVE.sql'), 'utf8');
assert.match(sql, /ALTER TABLE public\.products/);
assert.match(sql, /ADD COLUMN IF NOT EXISTS is_active/);

const kpi = readFileSync(resolve('lib/dashboard/company-kpi-snapshot.ts'), 'utf8');
assert.match(kpi, /from\('products'\)[\s\S]*is_active/);

console.log('products-list.test.ts ok');
