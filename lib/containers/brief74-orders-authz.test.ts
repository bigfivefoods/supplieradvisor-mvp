/**
 * Brief 74 — containers orders PATCH authz regression test
 * Run: npx --yes tsx lib/containers/brief74-orders-authz.test.ts
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const routePath = resolve(here, '../../app/api/containers/orders/route.ts');
const src = readFileSync(routePath, 'utf8');
const getStart = src.indexOf('export async function GET(');
const postStart = src.indexOf('export async function POST(');
const patchStart = src.indexOf('export async function PATCH(');

assert.ok(getStart >= 0 && postStart > getStart, 'Could not locate GET/POST boundaries');
assert.ok(postStart >= 0 && patchStart > postStart, 'Could not locate POST/PATCH boundaries');

const getFn = src.slice(getStart, postStart);
const postFn = src.slice(postStart, patchStart);
const patchEnd = src.indexOf('export async function ', patchStart + 1);
const patchFn = src.slice(patchStart, patchEnd >= 0 ? patchEnd : undefined);
const flatPatch = patchFn.replace(/\s+/g, ' ');

assert.ok(getFn.includes('requireCompanyAccess'), 'GET gate should remain requireCompanyAccess');
assert.ok(postFn.includes('requireCompanyAccess'), 'POST gate should remain requireCompanyAccess');
assert.ok(
  patchFn.includes('assertContractorContainerAccess'),
  'PATCH must keep assertContractorContainerAccess for contractor path'
);
assert.ok(patchFn.includes('requireCompanyAccess'), 'PATCH company path must call requireCompanyAccess');
assert.ok(
  patchFn.indexOf('requireCompanyAccess') < patchFn.indexOf('getSupabaseServer'),
  'PATCH company path must call requireCompanyAccess before getSupabaseServer'
);

assert.match(patchFn, /!Number\.isFinite\(companyId\)\s*\|\|\s*companyId\s*<=\s*0/);
assert.match(patchFn, /!Number\.isFinite\(id\)\s*\|\|\s*id\s*<=\s*0/);

assert.match(
  flatPatch,
  /let orderQuery = supabase\s*\.from\('container_orders'\)\s*\.select\('\*'\)\s*\.eq\('id', id\)\s*\.eq\('profile_id', companyId\)/
);
assert.match(
  flatPatch,
  /orderQuery = orderQuery\.eq\('container_id', requestedContainerId\)/
);
assert.match(
  flatPatch,
  /await orderQuery\.single\(\)/
);
assert.match(
  flatPatch,
  /\.update\(updates\)\s*\.eq\('id', id\)\s*\.eq\('profile_id', companyId\)\s*\.select\('\*'\)\s*\.single\(\)/
);

assert.match(
  flatPatch,
  /\.select\('id, qty_on_hand'\)\s*\.eq\('profile_id', order\.profile_id\)\s*\.eq\('container_id', order\.container_id\)\s*\.eq\('product_name', item\.product_name\)/
);
assert.match(
  flatPatch,
  /\.eq\('id', existing\.id\)\s*\.eq\('profile_id', order\.profile_id\)/
);

console.log('✓ Brief 74 containers orders authz assertions passed');
