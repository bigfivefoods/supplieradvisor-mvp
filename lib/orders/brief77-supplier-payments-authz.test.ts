/**
 * Brief 77 — orders supplier-payments authz regression test
 * Run: npx --yes tsx lib/orders/brief77-supplier-payments-authz.test.ts
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const routePath = resolve(here, '../../app/api/orders/supplier-payments/route.ts');

function fnBlock(src: string, name: 'GET' | 'POST' | 'PATCH') {
  const signature = `export async function ${name}(`;
  const start = src.indexOf(signature);
  assert.ok(start >= 0, `Could not locate ${name} in source`);
  const next = src.indexOf('export async function ', start + signature.length);
  return src.slice(start, next >= 0 ? next : undefined);
}

const src = readFileSync(routePath, 'utf8');
const getFn = fnBlock(src, 'GET');
const postFn = fnBlock(src, 'POST');
const patchFn = fnBlock(src, 'PATCH');

for (const [name, fn] of [
  ['supplier-payments GET', getFn],
  ['supplier-payments POST', postFn],
  ['supplier-payments PATCH', patchFn],
] as const) {
  assert.ok(fn.includes('requireCompanyAccess'), `${name} must call requireCompanyAccess`);
  assert.ok(
    fn.indexOf('requireCompanyAccess') < fn.indexOf('getSupabaseServer'),
    `${name} must gate before getSupabaseServer`
  );
}

assert.ok(!src.includes('assertCompanyMember'), 'supplier-payments route should not use assertCompanyMember');
assert.ok(!getFn.includes('if (privyUserId)'), 'supplier-payments GET must not have skippable privyUserId branch');
assert.match(getFn, /!Number\.isFinite\(companyId\)\s*\|\|\s*companyId\s*<=\s*0/);
assert.match(postFn, /!Number\.isFinite\(companyId\)\s*\|\|\s*companyId\s*<=\s*0/);
assert.match(patchFn, /!Number\.isFinite\(companyId\)\s*\|\|\s*companyId\s*<=\s*0/);

console.log('✓ Brief 77 orders supplier-payments authz assertions passed');
