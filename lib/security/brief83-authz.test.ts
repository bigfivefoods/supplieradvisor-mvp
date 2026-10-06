/**
 * Brief 83 — authz regression scan for manufacturing/distribution + identity trust routes
 * Run: npx --yes tsx lib/security/brief83-authz.test.ts
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isPublicApiPath } from '../auth/public-paths';

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

function fnBlock(src: string, method: Method): string {
  const signature = new RegExp(`^export async function ${method}\\(`, 'm');
  const match = signature.exec(src);
  const start = match?.index ?? -1;
  assert.ok(start >= 0, `Could not locate ${method} handler`);

  const bodyStart = src.indexOf('{', start);
  assert.ok(bodyStart >= 0, `Could not locate ${method} body start`);

  let depth = 0;
  for (let i = bodyStart; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === '{') depth += 1;
    if (ch === '}') depth -= 1;
    if (depth === 0) return src.slice(start, i + 1);
  }

  assert.fail(`Could not locate ${method} body end`);
}

function assertGateBeforeSupabase(label: string, fnSrc: string) {
  const gateIdx = Math.max(
    fnSrc.indexOf('requireCompanyAccess'),
    fnSrc.indexOf('requireCompanyPermission'),
    fnSrc.indexOf('requireCompanyRoles')
  );
  const sbIdx = fnSrc.indexOf('getSupabaseServer');
  assert.ok(gateIdx >= 0, `${label} must call a company auth gate`);
  if (sbIdx >= 0) {
    assert.ok(gateIdx < sbIdx, `${label} must gate before getSupabaseServer`);
  }
  assert.ok(!fnSrc.includes('assertCompanyMember('), `${label} must not gate with assertCompanyMember`);
}

const targets: Array<{ path: string; methods: Method[] }> = [
  { path: 'app/api/manufacturing/boms/route.ts', methods: ['GET', 'PATCH', 'DELETE'] },
  { path: 'app/api/manufacturing/mps/route.ts', methods: ['GET', 'PATCH'] },
  { path: 'app/api/manufacturing/mrp/route.ts', methods: ['GET'] },
  { path: 'app/api/manufacturing/production-orders/route.ts', methods: ['GET', 'PATCH', 'DELETE'] },
  { path: 'app/api/manufacturing/work-centers/route.ts', methods: ['PATCH', 'DELETE'] },
  { path: 'app/api/distribution/carriers/route.ts', methods: ['PATCH', 'DELETE'] },
  { path: 'app/api/distribution/fleet/route.ts', methods: ['PATCH', 'DELETE'] },
  { path: 'app/api/distribution/shipments/route.ts', methods: ['GET', 'PATCH', 'DELETE'] },
  { path: 'app/api/orders/cascade/route.ts', methods: ['POST'] },
  { path: 'app/api/orders/chain-setups/route.ts', methods: ['GET', 'POST', 'PATCH', 'DELETE'] },
  { path: 'app/api/orders/production-status/route.ts', methods: ['POST'] },
  { path: 'app/api/orders/raise-invoice-from-so/route.ts', methods: ['POST'] },
  { path: 'app/api/orders/raise-linked-po/route.ts', methods: ['POST'] },
  { path: 'app/api/pricing/agreements/route.ts', methods: ['POST', 'PATCH'] },
  { path: 'app/api/marketplace/listings/route.ts', methods: ['POST', 'PATCH', 'DELETE'] },
  { path: 'app/api/marketplace/inquiries/route.ts', methods: ['POST', 'PATCH'] },
  { path: 'app/api/suppliers/connect/route.ts', methods: ['POST', 'PATCH'] },
  { path: 'app/api/suppliers/invites/route.ts', methods: ['POST', 'PATCH'] },
  { path: 'app/api/suppliers/ratings/route.ts', methods: ['POST'] },
  { path: 'app/api/buyer/purchase-orders/route.ts', methods: ['GET', 'POST', 'PATCH'] },
  { path: 'app/api/buyer/reviews/route.ts', methods: ['GET', 'POST'] },
  { path: 'app/api/connections/route.ts', methods: ['POST', 'PATCH'] },
];

for (const target of targets) {
  const src = readFileSync(resolve(target.path), 'utf8');
  for (const method of target.methods) {
    const block = fnBlock(src, method);
    assertGateBeforeSupabase(`${target.path} ${method}`, block);
    assert.match(
      block,
      /!Number\.isFinite\((?:[A-Za-z_][A-Za-z0-9_]*CompanyId|companyId)\)/,
      `${target.path} ${method} must validate numeric companyId`
    );
    assert.match(
      block,
      /<=\s*0/,
      `${target.path} ${method} must reject non-positive companyId`
    );
  }
}

assert.equal(
  isPublicApiPath('/api/system/health/ops'),
  false,
  '/api/system/health/ops must not be public'
);
assert.equal(
  isPublicApiPath('/api/system/health'),
  true,
  '/api/system/health must remain public'
);

console.log('✓ Brief 83 authz assertions passed');
