/**
 * Brief 72 — containers inventory GET/DELETE authz regression test
 * Run: npx --yes tsx lib/containers/brief72-inventory-authz.test.ts
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const routePath = resolve('app/api/containers/inventory/route.ts');
const src = readFileSync(routePath, 'utf8');

function extractFn(name: string): string {
  const marker = `export async function ${name}(`;
  const start = src.indexOf(marker);
  assert.ok(start >= 0, `Could not find ${name} in containers/inventory route`);
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
const deleteFn = extractFn('DELETE');
const flatDelete = deleteFn.replace(/\s+/g, ' ');

assert.ok(
  getFn.includes('assertContractorContainerAccess'),
  'GET must keep assertContractorContainerAccess for contractor branch'
);
assert.ok(
  getFn.includes('requireCompanyAccess'),
  'GET company path must call requireCompanyAccess'
);
assert.ok(postFn.includes('requireCompanyAccess'), 'POST must keep requireCompanyAccess');
assert.ok(deleteFn.includes('requireCompanyAccess'), 'DELETE must call requireCompanyAccess');

assert.ok(
  getFn.indexOf('requireCompanyAccess') < getFn.indexOf('getSupabaseServer'),
  'GET must gate with requireCompanyAccess before getSupabaseServer on company path'
);
assert.ok(
  deleteFn.indexOf('requireCompanyAccess') < deleteFn.indexOf('getSupabaseServer'),
  'DELETE must call requireCompanyAccess before getSupabaseServer'
);

assert.match(getFn, /!Number\.isFinite\(companyId\)\s*\|\|\s*companyId\s*<=\s*0/);
assert.match(deleteFn, /!Number\.isFinite\(companyId\)\s*\|\|\s*companyId\s*<=\s*0/);
assert.match(deleteFn, /!Number\.isFinite\(id\)\s*\|\|\s*id\s*<=\s*0/);
assert.match(flatDelete, /\.delete\(\)\s*\.eq\('id', id\)\s*\.eq\('profile_id', companyId\)/);

console.log('✓ Brief 72 containers inventory authz assertions passed');
