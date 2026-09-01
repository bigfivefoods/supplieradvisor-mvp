/**
 * Brief 43 — IDOR gate: GET/PATCH/DELETE in products/route.ts must call requireCompanyAccess.
 * Run: npx --yes tsx lib/inventory/brief43-products-authz.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const src = readFileSync(
  resolve('app/api/inventory/products/route.ts'),
  'utf8'
);

// Split into per-export function blocks for targeted assertion
function extractBlock(fnName: string): string {
  const marker = `export async function ${fnName}`;
  const start = src.indexOf(marker);
  assert.ok(start >= 0, `Could not find ${fnName} in products/route.ts`);
  // Walk to matching closing brace
  let depth = 0;
  let i = start;
  let entered = false;
  while (i < src.length) {
    if (src[i] === '{') { depth++; entered = true; }
    if (src[i] === '}') { depth--; }
    if (entered && depth === 0) { i++; break; }
    i++;
  }
  return src.slice(start, i);
}

const getBlock    = extractBlock('GET');
const patchBlock  = extractBlock('PATCH');
const deleteBlock = extractBlock('DELETE');

// 1. GET must call requireCompanyAccess
assert.ok(
  getBlock.includes('requireCompanyAccess'),
  'GET must call requireCompanyAccess'
);

// 2. PATCH must call requireCompanyAccess
assert.ok(
  patchBlock.includes('requireCompanyAccess'),
  'PATCH must call requireCompanyAccess'
);

// 3. DELETE must call requireCompanyAccess
assert.ok(
  deleteBlock.includes('requireCompanyAccess'),
  'DELETE must call requireCompanyAccess'
);

// 4. PATCH must scope update by profile_id
assert.ok(
  patchBlock.includes("eq('profile_id', companyId)") ||
  patchBlock.includes('eq("profile_id", companyId)'),
  'PATCH must filter by profile_id to prevent cross-tenant writes'
);

// 5. DELETE must scope delete by profile_id
assert.ok(
  deleteBlock.includes("eq('profile_id', companyId)") ||
  deleteBlock.includes('eq("profile_id", companyId)'),
  'DELETE must filter by profile_id to prevent cross-tenant deletes'
);

// 6. GET must gate before querying (requireCompanyAccess call appears before 'from(')
const getGateIdx = getBlock.indexOf('requireCompanyAccess');
const getQueryIdx = Math.min(
  ...[".from('products')", '.from("products")']
    .map(s => getBlock.indexOf(s))
    .filter(i => i >= 0)
);
assert.ok(
  getGateIdx < getQueryIdx,
  'GET: requireCompanyAccess must be called before querying products'
);

// 7. DELETE must require companyId from query params
assert.ok(
  deleteBlock.includes("searchParams.get('companyId')"),
  'DELETE must read companyId from query params'
);

console.log('✓ Brief 43 products authz assertions passed');
