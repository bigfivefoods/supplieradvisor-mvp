/**
 * Run: npx --yes tsx loadtest/lib/guard.test.ts
 * This file does not start k6 and does not open a socket.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  assertHostAllowed,
  hostnameOf,
  prepareRun,
  productionDenyHosts,
  productionProjectRef,
  watchResponse,
} from './guard.js';
import { pickUser } from './users.js';

assert.equal(hostnameOf('http://localhost:3000/api'), 'localhost');
assert.equal(hostnameOf('https://user:token@staging.example.test/x'), 'staging.example.test');
assert.equal(hostnameOf('not a url'), '');

const prodRef = productionProjectRef();
const [apex, www, alias] = productionDenyHosts();
assert.deepEqual(productionDenyHosts(), [
  'supplieradvisor.com',
  'www.supplieradvisor.com',
  'supplieradvisor-mvp.vercel.app',
]);
assert.equal(apex, 'supplieradvisor.com');
assert.equal(www, 'www.supplieradvisor.com');
assert.equal(alias, 'supplieradvisor-mvp.vercel.app');

const stagingHost = 'staging.example.test';
const stagingUrl = `https://${stagingHost}`;
const expectRef = 'stagingrefexample';

function countGet(body: unknown, status = 200, headers: Record<string, string> = {}) {
  let calls = 0;
  const get = () => {
    calls += 1;
    return { status, body, headers };
  };
  return {
    get,
    calls: () => calls,
  };
}

function refusal(fn: () => void): string {
  try {
    fn();
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
  assert.fail('expected a refusal');
}

const cases: Array<{ name: string; run: () => void; calls: number; message: string }> = [
  {
    name: 'production host',
    calls: 0,
    message: 'production deny list',
    run: () => {
      const fake = countGet({ projectRef: expectRef, stage: 'staging' });
      assert.throws(
        () =>
          prepareRun({
            baseUrl: `https://${www}`,
            allowedHosts: `${www},${stagingHost}`,
            expectProjectRef: expectRef,
            get: fake.get,
          }),
        /production deny list/
      );
      assert.equal(fake.calls(), 0);
    },
  },
  {
    name: 'production apex',
    calls: 0,
    message: 'production deny list',
    run: () => {
      const fake = countGet({ projectRef: expectRef, stage: 'staging' });
      assert.throws(
        () =>
          prepareRun({
            baseUrl: `https://${apex}/api/dashboard/home`,
            allowedHosts: apex,
            expectProjectRef: expectRef,
            get: fake.get,
          }),
        /production deny list/
      );
      assert.equal(fake.calls(), 0);
    },
  },
  {
    name: 'production vercel alias',
    calls: 0,
    message: 'production deny list',
    run: () => {
      const fake = countGet({ projectRef: expectRef, stage: 'staging' });
      assert.throws(
        () =>
          prepareRun({
            baseUrl: `https://${alias}`,
            allowedHosts: alias,
            expectProjectRef: expectRef,
            get: fake.get,
          }),
        /production deny list/
      );
      assert.equal(fake.calls(), 0);
    },
  },
  {
    name: 'production project host',
    calls: 0,
    message: 'production deny list',
    run: () => {
      const fake = countGet({ projectRef: expectRef, stage: 'staging' });
      const host = `${prodRef}.supabase.co`;
      assert.throws(
        () =>
          prepareRun({
            baseUrl: `https://${host}`,
            allowedHosts: host,
            expectProjectRef: expectRef,
            get: fake.get,
          }),
        /production deny list/
      );
      assert.equal(fake.calls(), 0);
    },
  },
  {
    name: 'localhost without an allow-list',
    calls: 0,
    message: 'LOADTEST_ALLOWED_HOSTS is empty',
    run: () => {
      const fake = countGet({ projectRef: expectRef, stage: 'staging' });
      assert.throws(
        () =>
          prepareRun({
            baseUrl: 'http://localhost:3000',
            allowedHosts: '',
            expectProjectRef: expectRef,
            get: fake.get,
          }),
        /LOADTEST_ALLOWED_HOSTS is empty/
      );
      assert.equal(fake.calls(), 0);
    },
  },
  {
    name: 'host not on the allow-list',
    calls: 0,
    message: 'not on LOADTEST_ALLOWED_HOSTS',
    run: () => {
      const fake = countGet({ projectRef: expectRef, stage: 'staging' });
      assert.throws(
        () =>
          prepareRun({
            baseUrl: stagingUrl,
            allowedHosts: 'other.example.test',
            expectProjectRef: expectRef,
            get: fake.get,
          }),
        /not on LOADTEST_ALLOWED_HOSTS/
      );
      assert.equal(fake.calls(), 0);
    },
  },
  {
    name: 'missing expected ref',
    calls: 0,
    message: 'LOADTEST_EXPECT_PROJECT_REF is empty',
    run: () => {
      const fake = countGet({ projectRef: expectRef, stage: 'staging' });
      assert.throws(
        () =>
          prepareRun({
            baseUrl: stagingUrl,
            allowedHosts: stagingHost,
            expectProjectRef: '',
            get: fake.get,
          }),
        /LOADTEST_EXPECT_PROJECT_REF is empty/
      );
      assert.equal(fake.calls(), 0);
    },
  },
  {
    name: 'expected ref is production',
    calls: 0,
    message: 'production project',
    run: () => {
      const fake = countGet({ projectRef: prodRef, stage: 'staging' });
      assert.throws(
        () =>
          prepareRun({
            baseUrl: stagingUrl,
            allowedHosts: stagingHost,
            expectProjectRef: prodRef,
            get: fake.get,
          }),
        /production project/
      );
      assert.equal(fake.calls(), 0);
    },
  },
];

for (const item of cases) {
  item.run();
  assert.equal(refusal(() => assertHostAllowed({ baseUrl: '', allowedHosts: stagingHost })).includes('BASE_URL'), true);
}

const pass = countGet(JSON.stringify({ projectRef: expectRef, stage: 'staging' }));
assert.equal(
  prepareRun({
    baseUrl: stagingUrl,
    allowedHosts: ` ${stagingHost} `,
    expectProjectRef: expectRef,
    get: pass.get,
  }),
  expectRef
);
assert.equal(pass.calls(), 1);

const poisoned = countGet(
  JSON.stringify({ projectRef: prodRef, stage: 'staging' }),
  200,
  { 'x-supabase-ref': prodRef }
);
assert.throws(
  () =>
    prepareRun({
      baseUrl: stagingUrl,
      allowedHosts: stagingHost,
      expectProjectRef: expectRef,
      get: poisoned.get,
    }),
  /production project ref/
);
assert.equal(poisoned.calls(), 1);

let aborted = '';
watchResponse(
  { status: 200, body: `hello ${prodRef}`, headers: {} },
  (message: string) => {
    aborted = message;
  }
);
assert.match(aborted, /production project ref/);

aborted = '';
watchResponse({ status: 200, body: '{"projectRef":"stagingrefexample"}', headers: { 'x-ref': prodRef } }, (message: string) => {
  aborted = message;
});
assert.match(aborted, /production project ref/);

watchResponse({ status: 200, body: '{"ok":true}', headers: { 'x-ref': 'stagingrefexample' } }, () => {
  throw new Error('should not abort');
});

assert.throws(() => pickUser([], 0), /no synthetic users/);
assert.equal(pickUser([{ id: 'a' }, { id: 'b' }], 3).id, 'b');

const profiles = readdirSync('loadtest/profiles').filter((name) => name.endsWith('.js'));
assert.deepEqual(profiles.sort(), ['baseline.js', 'breakpoint.js', 'smoke.js', 'soak.js', 'spike.js', 'step.js']);
for (const name of profiles) {
  const text = readFileSync(join('loadtest/profiles', name), 'utf8');
  const guardAt = text.indexOf('assertHostAllowed(');
  const httpAt = text.indexOf('http.get(');
  assert.equal(guardAt >= 0 && httpAt > guardAt, true, name);
  assert.equal(text.includes('__ENV.BASE_URL'), true, name);
  assert.equal(/BASE_URL\s*=\s*['"]https?:/.test(text), false, name);
}

for (const name of readdirSync('.github/workflows')) {
  const text = readFileSync(join('.github/workflows', name), 'utf8');
  assert.equal(text.includes('k6'), false, name);
  assert.equal(text.includes('loadtest'), false, name);
}
const pkg = readFileSync('package.json', 'utf8');
assert.equal(pkg.includes('k6'), false);
assert.equal(pkg.includes('loadtest'), false);

console.log('guard.test.ts ok');
