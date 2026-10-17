/**
 * Run: npx --yes tsx lib/loadtest/whoami.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isPublicApiPath } from '../auth/public-paths';
import { loadtestWhoami, projectRefFromSupabaseUrl } from './whoami';

const hidden = loadtestWhoami({});
assert.equal(hidden.status, 404);
assert.deepEqual(hidden.body, { error: 'Not found' });
assert.equal(JSON.stringify(hidden.body).includes('projectRef'), false);

const off = loadtestWhoami({
  LOADTEST_ENDPOINTS: '0',
  NEXT_PUBLIC_SUPABASE_URL: 'https://stagingrefexample.supabase.co',
});
assert.equal(off.status, 404);

const on = loadtestWhoami({
  LOADTEST_ENDPOINTS: '1',
  NEXT_PUBLIC_SUPABASE_URL: 'https://stagingrefexample.supabase.co',
});
assert.equal(on.status, 200);
assert.deepEqual(on.body, { projectRef: 'stagingrefexample', stage: 'staging' });

assert.equal(projectRefFromSupabaseUrl(''), '');
assert.equal(projectRefFromSupabaseUrl('not a url'), '');

assert.equal(isPublicApiPath('/api/_loadtest/whoami'), true);
assert.equal(isPublicApiPath('/api/_loadtest/whoami/extra'), false);
assert.equal(isPublicApiPath('/api/_loadtest'), false);

const allow = JSON.parse(readFileSync('scripts/route-auth-allowlist.json', 'utf8')) as Array<{
  route: string;
  methods: string[];
}>;
assert.equal(
  allow.some((entry) => entry.route === '/api/_loadtest/whoami' && entry.methods.includes('GET')),
  true
);

const route = readFileSync('app/api/_loadtest/whoami/route.ts', 'utf8');
assert.equal(route.includes('requireCompanyAccess'), false);
assert.equal(route.includes('SUPABASE_SERVICE_ROLE_KEY'), false);
assert.match(route, /force-dynamic/);

console.log('whoami.test.ts ok');
