/**
 * Brief 76 — orders chains authz regression test
 * Run: npx --yes tsx lib/orders/brief76-chains-authz.test.ts
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const chainsPath = resolve(here, '../../app/api/orders/chains/route.ts');

function fnBlock(src: string, name: 'GET' | 'POST' | 'DELETE') {
  const signature = `export async function ${name}(`;
  const start = src.indexOf(signature);
  assert.ok(start >= 0, `Could not locate ${name} in source`);
  const next = src.indexOf('export async function ', start + signature.length);
  return src.slice(start, next >= 0 ? next : undefined);
}

const chainsSrc = readFileSync(chainsPath, 'utf8');
const chainsGet = fnBlock(chainsSrc, 'GET');

assert.ok(chainsGet.includes('requireCompanyAccess'), 'chains GET must call requireCompanyAccess');
assert.ok(
  chainsGet.indexOf('requireCompanyAccess') < chainsGet.indexOf('getSupabaseServer'),
  'chains GET must gate before getSupabaseServer'
);
assert.ok(!chainsSrc.includes('assertCompanyMember'), 'chains route should not use assertCompanyMember');
assert.ok(!chainsGet.includes('if (privyUserId)'), 'chains GET must not have skippable privyUserId branch');
assert.match(chainsGet, /!Number\.isFinite\(companyId\)\s*\|\|\s*companyId\s*<=\s*0/);

console.log('✓ Brief 76 orders chains authz assertions passed');
