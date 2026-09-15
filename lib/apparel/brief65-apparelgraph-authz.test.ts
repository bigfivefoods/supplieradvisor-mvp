/**
 * Brief 65 — apparelgraph API authz guard order.
 * Run: npx --yes tsx lib/apparel/brief65-apparelgraph-authz.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const routePath = resolve('app/api/apparel/apparelgraph/route.ts');
const src = readFileSync(routePath, 'utf8');

function extractFn(name: 'GET' | 'POST'): string {
  const marker = `export async function ${name}(`;
  const start = src.indexOf(marker);
  assert.ok(start >= 0, `Could not find ${name} in apparelgraph route`);
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

for (const [name, fnBody] of [
  ['GET', getFn],
  ['POST', postFn],
] as const) {
  assert.ok(fnBody.includes('requireCompanyAccess'), `${name} must call requireCompanyAccess`);
  assert.ok(fnBody.includes('if (!gate.ok) return gate.response;'), `${name} must return gate.response on denial`);
  assert.ok(
    fnBody.indexOf('requireCompanyAccess') < fnBody.indexOf('getSupabaseServer'),
    `${name} must call requireCompanyAccess before getSupabaseServer`
  );
}

assert.match(getFn, /!Number\.isFinite\(companyId\)\s*\|\|\s*companyId\s*<=\s*0/);
assert.match(postFn, /!Number\.isFinite\(companyId\)\s*\|\|\s*companyId\s*<=\s*0/);
assert.ok(!src.includes('profiles.phone'), 'must not select profiles.phone');

const publicSrc = readFileSync(
  resolve('app/api/public/apparelgraph/route.ts'),
  'utf8'
);
assert.ok(
  !publicSrc.includes('requireCompanyAccess'),
  'public apparelgraph GET is token-gated, not company-gated'
);
assert.ok(publicSrc.includes('publicReadLimit'), 'public GET must rate-limit');
assert.ok(!publicSrc.includes('profiles.phone'), 'public GET must not select profiles.phone');

console.log('brief65-apparelgraph-authz.test.ts ok');
