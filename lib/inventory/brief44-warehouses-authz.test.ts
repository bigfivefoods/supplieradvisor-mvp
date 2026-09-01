/**
 * Brief 44 — string-scan authz gate test for app/api/inventory/warehouses/route.ts
 *
 * Asserts that GET, PATCH, and DELETE all call requireCompanyAccess, and that
 * PATCH and DELETE scope their DB operations with .eq('profile_id', companyId).
 *
 * Run: npx --yes tsx lib/inventory/brief44-warehouses-authz.test.ts
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const root = join(__dirname, '../../');
const src = readFileSync(
  join(root, 'app/api/inventory/warehouses/route.ts'),
  'utf8'
);

type Check = { label: string; pass: boolean };
const checks: Check[] = [];

function assert(label: string, condition: boolean) {
  checks.push({ label, pass: condition });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Extract the body of the named export function */
function extractFn(name: string): string {
  const marker = `export async function ${name}(`;
  const start = src.indexOf(marker);
  if (start === -1) return '';
  // Grab everything from start; balance braces to find end
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

const getFn     = extractFn('GET');
const patchFn   = extractFn('PATCH');
const deleteFn  = extractFn('DELETE');
const postFn    = extractFn('POST');

// ── Checks ───────────────────────────────────────────────────────────────────

assert('GET calls requireCompanyAccess',    getFn.includes('requireCompanyAccess'));
assert('GET returns _gate.response on !ok', getFn.includes('_gate.response'));
assert('PATCH calls requireCompanyAccess',  patchFn.includes('requireCompanyAccess'));
assert('PATCH returns _gate.response',      patchFn.includes('_gate.response'));
assert('DELETE calls requireCompanyAccess', deleteFn.includes('requireCompanyAccess'));
assert('DELETE returns _gate.response',     deleteFn.includes('_gate.response'));

// profile_id scoping in PATCH
assert(
  "PATCH update scoped with .eq('profile_id', companyId)",
  patchFn.includes(".eq('profile_id', companyId)"),
);

// profile_id scoping in DELETE
assert(
  "DELETE scoped with .eq('profile_id', companyId)",
  deleteFn.includes(".eq('profile_id', companyId)"),
);

// POST is unchanged — still has its own gate
assert('POST still calls requireCompanyAccess', postFn.includes('requireCompanyAccess'));

// ── Report ────────────────────────────────────────────────────────────────────

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
