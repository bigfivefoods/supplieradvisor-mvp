/**
 * Brief 49 — string-scan authz gate test for app/api/inventory/categories/route.ts
 *
 * Asserts that GET and DELETE call requireCompanyAccess before any DB access,
 * that both require companyId > 0, that DELETE requires id > 0, and that the
 * DELETE update is scoped with .eq('profile_id', companyId).
 *
 * Run: npx --yes tsx lib/inventory/brief49-categories-authz.test.ts
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const root = join(__dirname, '../../');
const src = readFileSync(
  join(root, 'app/api/inventory/categories/route.ts'),
  'utf8'
);

type Check = { label: string; pass: boolean };
const checks: Check[] = [];

function assert(label: string, condition: boolean) {
  checks.push({ label, pass: condition });
}

/** Extract the body of the named export function */
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

const getFn    = extractFn('GET');
const deleteFn = extractFn('DELETE');
const postFn   = extractFn('POST');

// ── GET checks ────────────────────────────────────────────────────────────────

assert('GET calls requireCompanyAccess',    getFn.includes('requireCompanyAccess'));
assert('GET returns _gate.response on !ok', getFn.includes('_gate.response'));

// Gate must not be wrapped in `if (privyUserId)` — requireCompanyAccess appears
// at the top level before any product_categories access.
assert(
  "GET's requireCompanyAccess is NOT inside if (privyUserId)",
  !getFn.match(/if\s*\([^)]*privyUserId[^)]*\)[^}]*requireCompanyAccess/s),
);

// requireCompanyAccess must appear before .from('product_categories')
assert(
  "GET calls requireCompanyAccess BEFORE .from('product_categories')",
  getFn.indexOf('requireCompanyAccess') < getFn.indexOf(".from('product_categories')"),
);

// Must require companyId > 0, not just isFinite
assert(
  'GET requires companyId > 0',
  getFn.includes('companyId <= 0') || getFn.includes('companyId > 0'),
);

// ── DELETE checks ─────────────────────────────────────────────────────────────

assert('DELETE calls requireCompanyAccess',    deleteFn.includes('requireCompanyAccess'));
assert('DELETE returns _gate.response on !ok', deleteFn.includes('_gate.response'));

assert(
  "DELETE calls requireCompanyAccess BEFORE .from('product_categories') / getSupabaseServer",
  deleteFn.indexOf('requireCompanyAccess') <
    Math.min(
      deleteFn.indexOf('.from(') === -1 ? Infinity : deleteFn.indexOf('.from('),
      deleteFn.indexOf('getSupabaseServer') === -1 ? Infinity : deleteFn.indexOf('getSupabaseServer'),
    ),
);

assert(
  'DELETE requires companyId > 0',
  deleteFn.includes('companyId <= 0') || deleteFn.includes('companyId > 0'),
);

assert(
  'DELETE requires id > 0',
  deleteFn.includes('id <= 0') || deleteFn.includes('id > 0'),
);

assert(
  "DELETE update scoped with .eq('profile_id', companyId)",
  deleteFn.includes(".eq('profile_id', companyId)"),
);

// ── POST regression check ─────────────────────────────────────────────────────

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
