/**
 * Brief 13 — exact public /api/health, programme routes stay gated.
 * Run: npx --yes tsx lib/auth/public-paths.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isPublicApiPath, PUBLIC_API_PREFIXES } from './public-paths';

assert.equal(isPublicApiPath('/api/health'), true);
assert.equal(isPublicApiPath('/api/health/agency'), false);
assert.equal(isPublicApiPath('/api/health/programme-role'), false);
assert.equal(isPublicApiPath('/api/system/health'), true);
assert.equal(isPublicApiPath('/api/system/health/ops'), true);

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

const agency = src('app/api/health/agency/route.ts');
assert.match(agency, /requireCompanyAccess/);
assert.match(agency, /runtime = 'nodejs'/);

console.log('public-paths Brief 13 tests ok');
