/**
 * Brief 13 — exact public /api/health, programme routes stay gated.
 * Run: npx --yes tsx lib/auth/public-paths.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  isPublicApiPath,
  isPublicPagePath,
  isRecoverPortalPath,
  PUBLIC_API_PREFIXES,
} from './public-paths';

assert.equal(isPublicApiPath('/api/health'), true);
assert.equal(isPublicApiPath('/api/health/agency'), false);
assert.equal(isPublicApiPath('/api/health/programme-role'), false);
assert.equal(isPublicApiPath('/api/system/health'), true);
assert.equal(isPublicApiPath('/api/csp-report'), true);
assert.equal(isPublicApiPath('/api/insights/collect'), true);
assert.equal(isPublicApiPath('/api/system/health/ops'), false);
assert.equal(isPublicApiPath('/api/public/constructiongraph'), true);
assert.equal(isPublicApiPath('/api/construction/constructiongraph'), false);
assert.equal(isPublicApiPath('/api/public/apparelgraph'), true);
assert.equal(isPublicApiPath('/api/apparel/apparelgraph'), false);

assert.ok(
  !PUBLIC_API_PREFIXES.some(
    (p) => p === '/api/health/' || p === '/api/health'
  ),
  'must not prefix-allow /api/health (would open /agency)'
);

function src(rel: string) {
  return readFileSync(resolve(rel), 'utf8');
}

const route = src('app/api/health/route.ts');
assert.match(route, /runtime = 'edge'/);
assert.match(route, /service: 'health'/);
assert.match(route, /max-age=15/);
assert.doesNotMatch(route, /getSupabaseServer/);
assert.doesNotMatch(route, /@privy-io/);
assert.doesNotMatch(route, /from 'viem'/);
assert.doesNotMatch(route, /undici/);
assert.doesNotMatch(route, /requireCompanyAccess/);

const paths = src('lib/auth/public-paths.ts');
assert.doesNotMatch(paths, /@privy-io/);
assert.doesNotMatch(paths, /from 'viem'/);
assert.doesNotMatch(paths, /undici/);
assert.doesNotMatch(paths, /getSupabaseServer/);

assert.equal(isPublicPagePath('/preview/constructiongraph'), true);
assert.equal(isPublicPagePath('/preview/constructiongraph/diary'), true);
assert.equal(isPublicPagePath('/api/public/constructiongraph'), false);
assert.equal(isPublicPagePath('/api/preview/constructiongraph'), false);
assert.equal(isPublicApiPath('/preview/constructiongraph'), false);
assert.equal(isPublicPagePath('/preview/recovergraph'), true);
assert.equal(isPublicPagePath('/preview/recovergraph/queue'), true);
assert.equal(isPublicPagePath('/api/preview/recovergraph'), false);
assert.equal(isPublicApiPath('/preview/recovergraph'), false);

const agency = src('app/api/health/agency/route.ts');
assert.match(agency, /requireCompanyAccess/);
assert.match(agency, /runtime = 'nodejs'/);

assert.equal(isPublicApiPath('/api/recovery/recovergraph'), false);
assert.equal(isRecoverPortalPath('/creditor/recovergraph/person'), true);
assert.equal(isRecoverPortalPath('/debtor/recovergraph/person'), true);
assert.equal(isRecoverPortalPath('/attorney/recovergraph/person'), true);
assert.equal(isRecoverPortalPath('/api/recovery/recovergraph'), false);

const recoverPaths = src('lib/auth/public-paths.ts');
assert.match(recoverPaths, /\/creditor\/recovergraph/);
assert.match(recoverPaths, /\/debtor\/recovergraph/);
assert.match(recoverPaths, /\/attorney\/recovergraph/);
assert.doesNotMatch(recoverPaths, /\/api\/recovery/);

console.log('public-paths Brief 13 tests ok');
