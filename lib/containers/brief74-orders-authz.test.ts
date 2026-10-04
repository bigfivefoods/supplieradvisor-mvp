/**
 * Brief 74 — containers orders PATCH authz regression test
 * Run: npx --yes tsx lib/containers/brief74-orders-authz.test.ts
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const routePath = resolve('app/api/containers/orders/route.ts');
const src = readFileSync(routePath, 'utf8');

function extractFn(name: string): string {
  const marker = `export async function ${name}(`;
  const start = src.indexOf(marker);
  assert.ok(start >= 0, `Could not find ${name} in containers/orders route`);
  let depth = 0;
  let inside = false;
  let end = start;
  for (let i = start; i < src.length; i++) {
    if (src[i] === '{') {
      depth++;
      inside = true;
    } else if (src[i] === '}') {
      depth--;
    }
    if (inside && depth === 0) {
      end = i;
      break;
    }
  }
  return src.slice(start, end + 1);
}

const getFn = extractFn('GET');
const postFn = extractFn('POST');
const patchFn = extractFn('PATCH');
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
  /\.select\('\*'\)\s*\.eq\('id', id\)\s*\.eq\('profile_id', companyId\)\s*\.single\(\)/
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
