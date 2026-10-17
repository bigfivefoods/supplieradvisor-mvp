/**
 * Run: npx --yes tsx lib/loadtest/whoami.test.ts
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { isPublicApiPath } from '../auth/public-paths';
import { GET } from '../../app/api/loadtest/whoami/route';
import { PRODUCTION_PROJECT_REF, loadtestWhoami, projectRefFromSupabaseUrl } from './whoami';

const hidden = loadtestWhoami({});
assert.equal(hidden.status, 404);
assert.deepEqual(hidden.body, { error: 'Not found' });
assert.equal(JSON.stringify(hidden.body).includes('projectRef'), false);

const off = loadtestWhoami({
  LOADTEST_ENDPOINTS: '0',
  NEXT_PUBLIC_SUPABASE_URL: 'https://stagingrefexample.supabase.co',
  SUPABASE_URL: 'https://stagingrefexample.supabase.co',
});
assert.equal(off.status, 404);

const staging = 'https://stagingrefexample.supabase.co';
const on = loadtestWhoami({
  LOADTEST_ENDPOINTS: '1',
  NEXT_PUBLIC_SUPABASE_URL: staging,
  SUPABASE_URL: staging,
});
assert.equal(on.status, 200);
assert.deepEqual(on.body, {
  projectRef: 'stagingrefexample',
  serverProjectRef: 'stagingrefexample',
  publicProjectRef: 'stagingrefexample',
  stage: 'staging',
});

const publicOnly = loadtestWhoami({
  LOADTEST_ENDPOINTS: '1',
  NEXT_PUBLIC_SUPABASE_URL: staging,
});
assert.equal(publicOnly.status, 200);
if (publicOnly.status === 200) {
  assert.equal(publicOnly.body.projectRef, 'stagingrefexample');
}

const mismatch = loadtestWhoami({
  LOADTEST_ENDPOINTS: '1',
  SUPABASE_URL: 'https://stagingrefexample.supabase.co',
  NEXT_PUBLIC_SUPABASE_URL: 'https://otherstagingref.supabase.co',
});
assert.equal(mismatch.status, 404);
assert.equal(JSON.stringify(mismatch.body).includes('projectRef'), false);

const prodUrl = `https://${PRODUCTION_PROJECT_REF}.supabase.co`;
const prod = loadtestWhoami({
  LOADTEST_ENDPOINTS: '1',
  SUPABASE_URL: prodUrl,
  NEXT_PUBLIC_SUPABASE_URL: prodUrl,
});
assert.equal(prod.status, 404);
assert.equal(JSON.stringify(prod.body).includes(PRODUCTION_PROJECT_REF), false);

const oneProd = loadtestWhoami({
  LOADTEST_ENDPOINTS: '1',
  SUPABASE_URL: staging,
  NEXT_PUBLIC_SUPABASE_URL: prodUrl,
});
assert.equal(oneProd.status, 404);

const productionDeploy = loadtestWhoami({
  LOADTEST_ENDPOINTS: '1',
  VERCEL_ENV: 'production',
  SUPABASE_URL: staging,
  NEXT_PUBLIC_SUPABASE_URL: staging,
});
assert.equal(productionDeploy.status, 404);

assert.equal(projectRefFromSupabaseUrl(''), '');
assert.equal(projectRefFromSupabaseUrl('not a url'), '');
assert.equal(
  projectRefFromSupabaseUrl('postgresql://postgres.stagingrefexample:pw@aws-0-eu-west-2.pooler.supabase.com:6543/postgres'),
  'stagingrefexample'
);
assert.equal(projectRefFromSupabaseUrl('https://db.stagingrefexample.supabase.co'), 'stagingrefexample');
const encodedUser = `postgres.${PRODUCTION_PROJECT_REF.replace('l', '%6C')}`;
assert.equal(
  projectRefFromSupabaseUrl(`postgresql://${encodedUser}:pw@aws-0-eu-west-2.pooler.supabase.com:6543/postgres`),
  PRODUCTION_PROJECT_REF
);

const routeFile = 'app/api/loadtest/whoami/route.ts';
assert.equal(existsSync(routeFile), true);
assert.equal(existsSync('app/api/_loadtest/whoami/route.ts'), false);
for (const segment of routeFile.split('/')) {
  assert.equal(segment.startsWith('_'), false, segment);
}

assert.equal(isPublicApiPath('/api/loadtest/whoami'), true);
assert.equal(isPublicApiPath('/api/loadtest/whoami/extra'), false);
assert.equal(isPublicApiPath('/api/loadtest'), false);
assert.equal(isPublicApiPath('/api/_loadtest/whoami'), false);

const allow = JSON.parse(readFileSync('scripts/route-auth-allowlist.json', 'utf8')) as Array<{
  route: string;
  methods: string[];
}>;
assert.equal(
  allow.some((entry) => entry.route === '/api/loadtest/whoami' && entry.methods.includes('GET')),
  true
);
assert.equal(allow.some((entry) => entry.route.includes('/_loadtest/')), false);

const route = readFileSync(routeFile, 'utf8');
assert.equal(route.includes('requireCompanyAccess'), false);
assert.equal(route.includes('SUPABASE_SERVICE_ROLE_KEY'), false);
assert.match(route, /force-dynamic/);
assert.match(route, /SUPABASE_URL/);
assert.match(route, /NEXT_PUBLIC_SUPABASE_URL/);

const previous = {
  LOADTEST_ENDPOINTS: process.env.LOADTEST_ENDPOINTS,
  SUPABASE_URL: process.env.SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  VERCEL_ENV: process.env.VERCEL_ENV,
};
function setEnv(name: keyof typeof previous, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
async function main() {
  setEnv('LOADTEST_ENDPOINTS', undefined);
  setEnv('SUPABASE_URL', staging);
  setEnv('NEXT_PUBLIC_SUPABASE_URL', staging);
  setEnv('VERCEL_ENV', 'preview');
  const closed = await GET();
  assert.equal(closed.status, 404);
  assert.equal(JSON.stringify(await closed.json()).includes('projectRef'), false);

  setEnv('LOADTEST_ENDPOINTS', '1');
  const open = await GET();
  assert.equal(open.status, 200);
  const body = await open.json();
  assert.equal(body.stage, 'staging');
  assert.equal(body.serverProjectRef, 'stagingrefexample');
  assert.equal(body.publicProjectRef, 'stagingrefexample');

  setEnv('NEXT_PUBLIC_SUPABASE_URL', prodUrl);
  const refused = await GET();
  assert.equal(refused.status, 404);
  assert.equal(JSON.stringify(await refused.json()).includes(PRODUCTION_PROJECT_REF), false);
}
main()
  .then(() => {
    console.log('whoami.test.ts ok');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    setEnv('LOADTEST_ENDPOINTS', previous.LOADTEST_ENDPOINTS);
    setEnv('SUPABASE_URL', previous.SUPABASE_URL);
    setEnv('NEXT_PUBLIC_SUPABASE_URL', previous.NEXT_PUBLIC_SUPABASE_URL);
    setEnv('VERCEL_ENV', previous.VERCEL_ENV);
  });
