/**
 * Brief 75 — orders links + batches authz regression test
 * Run: npx --yes tsx lib/orders/brief75-links-batches-authz.test.ts
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const linksPath = resolve(here, '../../app/api/orders/links/route.ts');
const batchesPath = resolve(here, '../../app/api/orders/batches/route.ts');

function fnBlock(src: string, name: 'GET' | 'POST' | 'DELETE') {
  const start = src.indexOf(`export async function ${name}(`);
  assert.ok(start >= 0, `Could not locate ${name} in source`);
  const next = src.indexOf('export async function ', start + 1);
  return src.slice(start, next >= 0 ? next : undefined);
}

const linksSrc = readFileSync(linksPath, 'utf8');
const linksGet = fnBlock(linksSrc, 'GET');
const linksPost = fnBlock(linksSrc, 'POST');
const linksDelete = fnBlock(linksSrc, 'DELETE');

for (const [name, fn] of [
  ['links GET', linksGet],
  ['links POST', linksPost],
  ['links DELETE', linksDelete],
] as const) {
  assert.ok(fn.includes('requireCompanyAccess'), `${name} must call requireCompanyAccess`);
  assert.ok(
    fn.indexOf('requireCompanyAccess') < fn.indexOf('getSupabaseServer'),
    `${name} must gate before getSupabaseServer`
  );
}

assert.ok(!linksGet.includes('if (privyUserId)'), 'links GET must not have skippable privyUserId branch');
assert.ok(!linksSrc.includes('assertCompanyMember'), 'links route should not use assertCompanyMember');
assert.match(linksGet, /!Number\.isFinite\(companyId\)\s*\|\|\s*companyId\s*<=\s*0/);
assert.match(linksGet, /!Number\.isFinite\(orderId\)\s*\|\|\s*orderId\s*<=\s*0/);
assert.match(linksPost, /!Number\.isFinite\(companyId\)\s*\|\|\s*companyId\s*<=\s*0/);
assert.match(linksDelete, /!Number\.isFinite\(companyId\)\s*\|\|\s*companyId\s*<=\s*0/);

const batchesSrc = readFileSync(batchesPath, 'utf8');
const batchesGet = fnBlock(batchesSrc, 'GET');
const batchesPost = fnBlock(batchesSrc, 'POST');

for (const [name, fn] of [
  ['batches GET', batchesGet],
  ['batches POST', batchesPost],
] as const) {
  assert.ok(fn.includes('requireCompanyAccess'), `${name} must call requireCompanyAccess`);
  assert.ok(
    fn.indexOf('requireCompanyAccess') < fn.indexOf('getSupabaseServer'),
    `${name} must gate before getSupabaseServer`
  );
}

assert.ok(!batchesSrc.includes('assertCompanyMember'), 'batches route should not use assertCompanyMember');
assert.match(batchesGet, /!Number\.isFinite\(companyId\)\s*\|\|\s*companyId\s*<=\s*0/);
assert.match(batchesGet, /!Number\.isFinite\(orderId\)\s*\|\|\s*orderId\s*<=\s*0/);
assert.match(batchesPost, /!Number\.isFinite\(companyId\)\s*\|\|\s*companyId\s*<=\s*0/);
assert.match(batchesPost, /!Number\.isFinite\(orderId\)\s*\|\|\s*orderId\s*<=\s*0/);

console.log('✓ Brief 75 orders links + batches authz assertions passed');
