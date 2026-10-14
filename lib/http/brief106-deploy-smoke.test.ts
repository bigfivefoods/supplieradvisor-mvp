/**
 * Brief 106 — unauth smoke targets the deployment that just succeeded.
 * Run: npx --yes tsx lib/http/brief106-deploy-smoke.test.ts
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NextRequest } from 'next/server';
import { deployedCommit, GET } from '../../app/api/health/route';

const root = process.cwd();

function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

async function healthResponse(url = 'https://www.supplieradvisor.com/api/health') {
  const previous = process.env.VERCEL_GIT_COMMIT_SHA;
  try {
    return await GET(new NextRequest(url));
  } finally {
    if (previous === undefined) delete process.env.VERCEL_GIT_COMMIT_SHA;
    else process.env.VERCEL_GIT_COMMIT_SHA = previous;
  }
}

async function main(): Promise<void> {
delete process.env.VERCEL_GIT_COMMIT_SHA;
const open = await healthResponse();
assert.equal(open.status, 200);
assert.equal(open.headers.get('cache-control'), 'public, max-age=15, stale-while-revalidate=60');
assert.equal(JSON.stringify(await open.json()), JSON.stringify({ ok: true, service: 'health', commit: null }));

process.env.VERCEL_GIT_COMMIT_SHA = 'abcdef1234567890aaaa';
const stamped = await healthResponse();
assert.equal(stamped.status, 200);
const stampedBody = await stamped.json();
assert.equal(stampedBody.ok, true);
assert.equal(stampedBody.service, 'health');
assert.equal(stampedBody.commit, 'abcdef1');
assert.match(stampedBody.commit, /^[0-9a-f]{7}$/);

process.env.VERCEL_GIT_COMMIT_SHA = '  abcdef1234567890  ';
const trimmed = await healthResponse();
assert.equal((await trimmed.json()).commit, 'abcdef1');

delete process.env.VERCEL_GIT_COMMIT_SHA;
const cleared = await healthResponse();
assert.equal((await cleared.json()).commit, null);

assert.equal(deployedCommit(undefined), null);
assert.equal(deployedCommit(null), null);
assert.equal(deployedCommit(''), null);
assert.equal(deployedCommit('abc'), null);
assert.equal(deployedCommit('ABCDEF1234567890'), 'ABCDEF1');

const route = read('app/api/health/route.ts');
assert.match(route, /runtime = 'edge'/);
assert.match(route, /service: 'health'/);
assert.match(route, /max-age=15/);
assert.match(route, /deployedCommit\(\)/);
assert.doesNotMatch(route, /getSupabaseServer/);
assert.doesNotMatch(route, /requireCompanyAccess/);
assert.doesNotMatch(route, /@privy-io/);
assert.doesNotMatch(route, /from 'viem'/);
assert.doesNotMatch(route, /undici/);

const systemHealth = read('app/api/system/health/route.ts');
assert.doesNotMatch(systemHealth, /deployedCommit/);
assert.doesNotMatch(systemHealth, /VERCEL_GIT_COMMIT_SHA/);

type BypassProbe = {
  hasHeaders: boolean;
  keys: string[];
  cookie: string | null;
  bypassMatches: boolean;
};

function loadPlaywrightConfig(secret: string | undefined): BypassProbe {
  const env: NodeJS.ProcessEnv = { ...process.env, PLAYWRIGHT_BASE_URL: 'http://127.0.0.1:9' };
  delete env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (secret !== undefined) env.VERCEL_AUTOMATION_BYPASS_SECRET = secret;

  const child = spawnSync(
    'npx',
    [
      '--yes',
      'tsx',
      '-e',
      `
        import config from './playwright.config.ts';
        const headers = config.use && config.use.extraHTTPHeaders ? config.use.extraHTTPHeaders : null;
        const value = process.env.VERCEL_AUTOMATION_BYPASS_SECRET ?? '';
        const bypass = headers && headers['x-vercel-protection-bypass'] ? headers['x-vercel-protection-bypass'] : '';
        process.stdout.write(JSON.stringify({
          hasHeaders: headers !== null,
          keys: headers ? Object.keys(headers).sort() : [],
          cookie: headers && headers['x-vercel-set-bypass-cookie'] ? headers['x-vercel-set-bypass-cookie'] : null,
          bypassMatches: value.length > 0 && bypass === value,
        }));
      `,
    ],
    { cwd: root, env, encoding: 'utf8' }
  );

  const stdout = child.stdout ?? '';
  const stderr = child.stderr ?? '';
  if (secret && (stdout.includes(secret) || stderr.includes(secret))) {
    throw new Error('playwright config leaked VERCEL_AUTOMATION_BYPASS_SECRET to stdout or stderr');
  }
  assert.equal(child.status, 0, stderr || stdout || 'playwright config child failed');
  const line = stdout.trim().split('\n').filter((row) => row.startsWith('{')).pop();
  assert.ok(line, 'playwright config probe did not print JSON');
  return JSON.parse(line) as BypassProbe;
}

const withoutSecret = loadPlaywrightConfig(undefined);
assert.equal(withoutSecret.hasHeaders, false);
assert.deepEqual(withoutSecret.keys, []);
assert.equal(withoutSecret.cookie, null);
assert.equal(withoutSecret.bypassMatches, false);

const blankSecret = loadPlaywrightConfig('   ');
assert.equal(blankSecret.hasHeaders, false);
assert.deepEqual(blankSecret.keys, []);

const withSecret = loadPlaywrightConfig('brief106-bypass-token');
assert.equal(withSecret.hasHeaders, true);
assert.deepEqual(withSecret.keys, ['x-vercel-protection-bypass']);
assert.equal(withSecret.cookie, null);
assert.equal(withSecret.bypassMatches, true);

const configSource = read('playwright.config.ts');
assert.match(configSource, /VERCEL_AUTOMATION_BYPASS_SECRET/);
assert.match(configSource, /x-vercel-protection-bypass/);
assert.doesNotMatch(configSource, /x-vercel-set-bypass-cookie/);
assert.doesNotMatch(configSource, /console\.(log|info|debug|warn|error)/);

const smoke = read('.github/workflows/e2e-smoke.yml');
assert.match(smoke, /name: Unauth API smoke/);
assert.match(smoke, /deployment_status/);
assert.match(smoke, /github\.event\.deployment_status\.state == 'success'/);
assert.match(smoke, /github\.event\.deployment\.sha/);
assert.match(smoke, /github\.event\.deployment\.id/);
assert.match(smoke, /cancel-in-progress: false/);
assert.doesNotMatch(smoke, /cancel-in-progress: true/);
assert.match(smoke, /default: https:\/\/www\.supplieradvisor\.com/);
assert.match(smoke, /::warning::Set VERCEL_AUTOMATION_BYPASS_SECRET to smoke previews/);
assert.match(smoke, /secrets\.VERCEL_AUTOMATION_BYPASS_SECRET/);
assert.doesNotMatch(smoke, /echo[^\n]*\$\{\{\s*secrets\.VERCEL_AUTOMATION_BYPASS_SECRET/);
assert.doesNotMatch(smoke, /echo[^\n]*\$VERCEL_AUTOMATION_BYPASS_SECRET/);
assert.doesNotMatch(smoke, /echo[^\n]*\$\{\{[^}\n]*x-vercel-/);
assert.doesNotMatch(smoke, /printenv/);
assert.doesNotMatch(smoke, /set -x/);
assert.match(smoke, /npm run test:e2e:auth/);
assert.match(
  smoke,
  /npx playwright test e2e\/trade-loop-smoke\.spec\.ts e2e\/happy-path-api\.spec\.ts e2e\/golden-path-smoke\.spec\.ts e2e\/major-bets-smoke\.spec\.ts e2e\/paid-verification-smoke\.spec\.ts e2e\/growth-settles\.spec\.ts/
);
assert.doesNotMatch(smoke, /push:/);
assert.doesNotMatch(smoke, /pull_request:/);
assert.doesNotMatch(smoke, /merge_group:/);
assert.doesNotMatch(smoke, /settle-mutate/);
assert.doesNotMatch(smoke, /E2E_ACCESS_TOKEN/);
assert.match(smoke, /every 10s, max 5 min/);
assert.match(smoke, /https:\/\/www\.supplieradvisor\.com/);

const session = read('.github/workflows/e2e-session.yml');
assert.match(session, /name: Session e2e \(optional secrets\)/);
assert.match(session, /E2E_ACCESS_TOKEN/);
assert.match(
  session,
  /npx playwright test e2e\/authenticated-session\.spec\.ts e2e\/trade-loop-smoke\.spec\.ts e2e\/golden-path-auth\.spec\.ts e2e\/major-bets-auth\.spec\.ts e2e\/growth-settles\.spec\.ts e2e\/settle-mutate\.spec\.ts/
);
assert.match(session, /push:/);
assert.match(session, /pull_request:/);
assert.match(session, /merge_group:/);
assert.doesNotMatch(session, /deployment_status/);
assert.doesNotMatch(session, /VERCEL_AUTOMATION_BYPASS_SECRET/);

console.log('brief106-deploy-smoke.test.ts ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
