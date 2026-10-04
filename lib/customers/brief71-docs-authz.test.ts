/**
 * Brief 71 — customers/docs DELETE + PATCH authz regression test
 * Run: npx --yes tsx lib/customers/brief71-docs-authz.test.ts
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const routePath = resolve('app/api/customers/docs/route.ts');
const src = readFileSync(routePath, 'utf8');

function extractFn(name: string): string {
  const marker = `export async function ${name}(`;
  const start = src.indexOf(marker);
  assert.ok(start >= 0, `Could not find ${name} in customers/docs route`);
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
const deleteFn = extractFn('DELETE');
const flatPatch = patchFn.replace(/\s+/g, ' ');
const flatDelete = deleteFn.replace(/\s+/g, ' ');

assert.ok(getFn.includes('requireCompanyAccess'), 'GET must keep requireCompanyAccess');
assert.ok(postFn.includes('requireCompanyAccess'), 'POST must keep requireCompanyAccess');

assert.ok(patchFn.includes('requireCompanyAccess'), 'PATCH must call requireCompanyAccess');
assert.ok(deleteFn.includes('requireCompanyAccess'), 'DELETE must call requireCompanyAccess');
assert.ok(
  patchFn.indexOf('requireCompanyAccess') < patchFn.indexOf('getSupabaseServer'),
  'PATCH must call requireCompanyAccess before getSupabaseServer'
);
assert.ok(
  deleteFn.indexOf('requireCompanyAccess') < deleteFn.indexOf('getSupabaseServer'),
  'DELETE must call requireCompanyAccess before getSupabaseServer'
);

assert.match(
  patchFn,
  /!Number\.isFinite\(companyId\)\s*\|\|\s*companyId\s*<=\s*0\s*\|\|\s*!Number\.isFinite\(docId\)\s*\|\|\s*docId\s*<=\s*0/
);
assert.match(deleteFn, /!Number\.isFinite\(companyId\)\s*\|\|\s*companyId\s*<=\s*0/);
assert.match(deleteFn, /!Number\.isFinite\(id\)\s*\|\|\s*id\s*<=\s*0/);

assert.match(flatDelete, /\.delete\(\)\s*\.eq\('id', id\)\s*\.eq\('profile_id', companyId\)/);
assert.match(
  flatPatch,
  /\.update\(updates\)\s*\.eq\('id', docId\)\s*\.eq\('profile_id', companyId\)/
);
assert.doesNotMatch(
  flatPatch,
  /\.update\(updates\)\s*\.eq\('id', docId\)(?!\s*\.eq\('profile_id', companyId\))/
);

console.log('✓ Brief 71 customers/docs authz assertions passed');
