/**
 * Brief 58 — string-scan authz gate test for app/api/inventory/transfers/route.ts
 *
 * Asserts that GET validates positive companyId, performs requireCompanyAccess
 * before DB reads, and that POST remains gated.
 *
 * Run: npx --yes tsx lib/inventory/brief58-transfers-authz.test.ts
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const root = join(__dirname, '../../');
const src = readFileSync(
  join(root, 'app/api/inventory/transfers/route.ts'),
  'utf8'
);

type Check = { label: string; pass: boolean };
const checks: Check[] = [];

function assert(label: string, condition: boolean) {
  checks.push({ label, pass: condition });
}

function extractFn(name: string): string {
  const marker = `export async function ${name}(`;
  const start = src.indexOf(marker);
  if (start === -1) return '';
  let depth = 0;
  let inside = false;
  let end = start;
  for (let i = start; i < src.length; i++) {
    if (src[i] === '{') { depth++; inside = true; }
    else if (src[i] === '}') { depth--; }
    if (inside && depth === 0) { end = i; break; }
  }
  return src.slice(start, end + 1);
}

const getFn = extractFn('GET');
const postFn = extractFn('POST');

assert('GET validates finite companyId', getFn.includes('Number.isFinite(companyId)'));
assert('GET validates positive companyId', getFn.includes('companyId <= 0'));
assert('GET calls requireCompanyAccess', getFn.includes('requireCompanyAccess'));
assert('GET returns _gate.response on !ok', getFn.includes('_gate.response'));

const getGateIdx = getFn.indexOf('requireCompanyAccess');
const getSupabaseIdx = getFn.indexOf('getSupabaseServer');
const getOrdersIdx = getFn.indexOf(".from('stock_transfer_orders')");

assert('GET requireCompanyAccess appears before getSupabaseServer', getGateIdx !== -1 && getSupabaseIdx !== -1 && getGateIdx < getSupabaseIdx);
assert("GET requireCompanyAccess appears before .from('stock_transfer_orders')", getGateIdx !== -1 && getOrdersIdx !== -1 && getGateIdx < getOrdersIdx);

assert('POST still calls requireCompanyAccess', postFn.includes('requireCompanyAccess'));
assert('POST still returns _gate.response', postFn.includes('_gate.response'));

let failed = 0;
for (const c of checks) {
  const icon = c.pass ? '✓' : '✗';
  console.log(`  ${icon}  ${c.label}`);
  if (!c.pass) failed++;
}

if (failed > 0) {
  console.error(`\n${failed} check(s) FAILED`);
  process.exit(1);
} else {
  console.log(`\nAll ${checks.length} checks passed`);
}
