/**
 * Brief 67 — container RIAD route authz regression test
 * Run: npx --yes tsx lib/containers/brief67-riad-authz.test.ts
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const routePath = resolve('app/api/containers/riad/route.ts');
const src = readFileSync(routePath, 'utf8');

function extractFn(name: string): string {
  const marker = `export async function ${name}(`;
  const start = src.indexOf(marker);
  assert.ok(start >= 0, `Could not find ${name} in containers/riad/route.ts`);
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

assert.ok(getFn.includes('requireCompanyAccess'), 'GET must call requireCompanyAccess');
assert.ok(getFn.includes('_gate.response'), 'GET must return _gate.response on !ok');
assert.ok(postFn.includes('requireCompanyAccess'), 'POST must keep requireCompanyAccess');
assert.ok(postFn.includes('_gate.response'), 'POST must keep returning _gate.response on !ok');
assert.ok(patchFn.includes('requireCompanyAccess'), 'PATCH must call requireCompanyAccess');
assert.ok(patchFn.includes('_gate.response'), 'PATCH must return _gate.response on !ok');
assert.ok(deleteFn.includes('requireCompanyAccess'), 'DELETE must call requireCompanyAccess');
assert.ok(deleteFn.includes('_gate.response'), 'DELETE must return _gate.response on !ok');
assert.ok(getFn.includes('assertContractorContainerAccess'), 'GET contractor flow must still use assertContractorContainerAccess');
assert.ok(patchFn.includes('assertContractorContainerAccess'), 'PATCH contractor flow must still use assertContractorContainerAccess');

assert.ok(
  getFn.indexOf('requireCompanyAccess') < getFn.indexOf('getSupabaseServer'),
  'GET must call requireCompanyAccess before getSupabaseServer'
);
assert.ok(
  patchFn.indexOf('requireCompanyAccess') < patchFn.indexOf('getSupabaseServer'),
  'PATCH must call requireCompanyAccess before getSupabaseServer'
);
assert.ok(
  deleteFn.indexOf('requireCompanyAccess') < deleteFn.indexOf('getSupabaseServer'),
  'DELETE must call requireCompanyAccess before getSupabaseServer'
);

assert.match(getFn, /!Number\.isFinite\(companyId\)\s*\|\|\s*companyId\s*<=\s*0/);
assert.match(patchFn, /!Number\.isFinite\(id\)\s*\|\|\s*id\s*<=\s*0/);
assert.match(patchFn, /!Number\.isFinite\(companyId\)\s*\|\|\s*companyId\s*<=\s*0/);
assert.match(deleteFn, /!Number\.isFinite\(id\)\s*\|\|\s*id\s*<=\s*0/);
assert.match(deleteFn, /!Number\.isFinite\(companyId\)\s*\|\|\s*companyId\s*<=\s*0/);
assert.ok(deleteFn.includes("searchParams.get('companyId')"), 'DELETE must read companyId from search params');

assert.match(
  patchFn,
  /\.eq\('id', id\)\s*\.eq\('profile_id', companyId\)\s*\.maybeSingle\(\)/,
  'PATCH pre-read must scope by id and profile_id before update'
);
assert.ok(
  patchFn.indexOf('.maybeSingle') < patchFn.indexOf('.update('),
  'PATCH pre-select (maybeSingle) must come before the update call'
);
assert.match(flatPatch, /\.update\(updates\)\s*\.eq\('id', id\)\s*\.eq\('profile_id', companyId\)/);
assert.match(flatDelete, /\.delete\(\)\s*\.eq\('id', id\)\s*\.eq\('profile_id', companyId\)/);
assert.ok(getFn.includes('isContractorRequest'), 'GET contractor detection should stay explicit');

console.log('container RIAD authz tests passed');
