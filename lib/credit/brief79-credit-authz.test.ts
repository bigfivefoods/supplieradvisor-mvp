/**
 * Run: npx --yes tsx lib/credit/brief79-credit-authz.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (full.endsWith('.ts')) out.push(full);
  }
  return out;
}

function fnBlock(src: string, name: 'GET' | 'POST' | 'PATCH') {
  const signature = new RegExp(`export\\s+async\\s+function\\s+${name}\\(`, 'm');
  const match = signature.exec(src);
  if (!match) return '';
  const start = match.index;
  const bodyStart = src.indexOf('{', start);
  if (bodyStart < 0) return '';
  let depth = 0;
  for (let i = bodyStart; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    if (src[i] === '}') depth -= 1;
    if (depth === 0) return src.slice(start, i + 1);
  }
  return '';
}

const supplierDir = resolve('app/api/customers/credit-applications');
const supplierFiles = walk(supplierDir);
for (const file of supplierFiles) {
  const src = readFileSync(file, 'utf8');
  for (const method of ['GET', 'POST', 'PATCH'] as const) {
    if (!src.includes(`export async function ${method}(`)) continue;
    assert.ok(src.includes('requireCompanyAccess'), `${file} ${method} must call requireCompanyAccess`);
    if (src.includes('getSupabaseServer')) {
      assert.ok(
        src.indexOf('requireCompanyAccess') < src.indexOf('getSupabaseServer'),
        `${file} ${method} must gate before getSupabaseServer`
      );
    }
  }

  if (file.endsWith('/[id]/route.ts')) {
    assert.ok(src.includes('requireCompanyRoles'), '[id]/route.ts must call requireCompanyRoles');
    assert.ok(src.includes("action === 'approve'"), 'approve action should exist');
    assert.ok(src.includes("action === 'decline'"), 'decline action should exist');
    assert.ok(src.includes("request.nextUrl.searchParams.get('reveal')"), 'reveal query should exist');
  }

  const creditFroms = src.match(/\.from\('credit_application[^']*'\)/g) || [];
  if (creditFroms.length) {
    assert.ok(src.includes(".eq('profile_id'"), `${file} credit_application queries must scope profile_id`);
  }
}

const publicDir = resolve('app/api/public/portals/trade/credit-application');
const publicFiles = walk(publicDir);
for (const file of publicFiles) {
  const src = readFileSync(file, 'utf8');
  for (const method of ['GET', 'POST', 'PATCH'] as const) {
    const block = fnBlock(src, method);
    if (!block) continue;
    if (block.includes(".from('")) {
      assert.ok(
        block.includes('resolveGuestViewer') &&
          block.indexOf('resolveGuestViewer') < block.indexOf(".from('"),
        `${file} ${method} must call resolveGuestViewer before DB reads`
      );
    }
  }
  assert.ok(src.includes('customer_id') || !src.includes(".from('credit_applications'"), `${file} must scope by customer_id`);
}

for (const file of [...walk(resolve('lib/credit')), ...publicFiles, ...supplierFiles]) {
  if (file.endsWith('brief79-credit-authz.test.ts')) continue;
  const src = readFileSync(file, 'utf8');
  assert.ok(!src.includes('uploadPortalDocument'), `${file} must not use uploadPortalDocument`);
  assert.ok(!src.includes('getPublicUrl'), `${file} must not use getPublicUrl`);
  assert.ok(!src.includes('public: true'), `${file} must not set public bucket`);
}

const actRoute = readFileSync(resolve('app/api/public/portals/trade/act/route.ts'), 'utf8');
assert.match(actRoute, /if \(portal\.kind === 'supplier'\)\s*\{\s*map\.payment_terms = 'payment_terms';\s*\}/);

console.log('brief79-credit-authz.test.ts ok');
