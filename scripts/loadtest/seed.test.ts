/**
 * Run: npx --yes tsx scripts/loadtest/seed.test.ts
 * Distribution, refusal, and the rule that CI does not execute the seed.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import net from 'node:net';
import { join } from 'node:path';
import { buildPlan, moduleBytes, volumeFor } from './lib/distribution.mjs';
import {
  PRODUCTION_PROJECT_REF,
  assertBatchId,
  evaluateSeedTarget,
  libpqEnv,
  productionDenyHosts,
} from './lib/guard.mjs';
import { interpretPsql, missingColumns, notNullWithoutDefault, omittedNotNullColumns, redactSecrets, renderSeedSql, renderTeardownSql } from './lib/sql.mjs';
import { parseArgs, runSeed } from './seed.mjs';
import { parseArgs as parseTeardownArgs, runTeardown } from './seed-teardown.mjs';

const bannedNumber = ['1', '10'].join('');
const bannedName = ['kwa', 'den'].join('');
const bannedClaim = ['cert', 'ified'].join('');

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, acc);
    else acc.push(full);
  }
  return acc;
}

function capture() {
  let text = '';
  return {
    write(chunk: string) {
      text += chunk;
    },
    read() {
      return text;
    },
  };
}

const s1 = buildPlan('s1');
const s2 = buildPlan('s2');

assert.equal(s1.companies, 5000);
assert.equal(s1.peers, 500);
assert.equal(s1.users, 36250);
assert.equal(s1.medianUsers, 8);
assert.equal(s1.minUsers, 5);
assert.equal(s1.maxUsers, 20);
assert.equal(s1.tailCompanies, 250);
assert.equal(s1.whales, 4);
assert.equal(s1.heavyTailCompanies, 0);
assert.equal(s1.pendingUsers, 1812);
assert.ok(Math.abs(s1.pendingUsers / s1.users - 0.05) <= 0.0005);
assert.equal(s1.totals.customers, 1079200);
assert.equal(s1.totals.activity_log, 107920000);
assert.equal(s1.totals.journal_lines, s1.totals.journal_entries * 3);
assert.equal(s1.moduleByteMedianBand, 4500);
assert.equal(s1.statedUserTargets.s1, 25000);
assert.notEqual(s1.users, s1.statedUserTargets.s1);

assert.equal(s2.users, s1.users);
assert.equal(s2.medianUsers, 8);
assert.equal(s2.heavyTailCompanies, 250);
assert.equal(s2.totals.customers, 3587600);
assert.equal(s2.totals.journal_lines, s2.totals.journal_entries * 3);
assert.equal(volumeFor('customers', 1, 's2'), 200 * 3 * 100);
assert.equal(volumeFor('customers', 20, 's2'), 200 * 10);
assert.equal(volumeFor('customers', 21, 's2'), 200 * 3);
assert.equal(moduleBytes(1), 5 * 1024);
assert.equal(moduleBytes(10), 50 * 1024);
assert.equal(moduleBytes(50), 400 * 1024);

assert.throws(() => buildPlan('s3'), /profile must be s1 or s2/);

const seedSql = renderSeedSql('s1', 's1');
const teardownSql = renderTeardownSql('s1');
assert.equal(readFileSync('scripts/loadtest/sql/seed.sql', 'utf8'), seedSql);
assert.equal(readFileSync('scripts/loadtest/sql/teardown.sql', 'utf8'), teardownSql);
assert.match(seedSql, /generate_series/);
assert.match(seedSql, /COPY \(/);
assert.match(seedSql, /ANALYZE public.profiles/);
assert.match(seedSql, /@loadtest\.invalid/);
assert.match(seedSql, /bank_account_id/);
assert.equal(seedSql.includes('statement_timeout'), false);
assert.equal(seedSql.includes(PRODUCTION_PROJECT_REF), false);
assert.equal(renderSeedSql('s1', 's1').includes('WHEN n % 20 = 0'), false);
const s2Sql = renderSeedSql('s2', 's2');
assert.match(s2Sql, /WHEN n % 20 = 0/);
assert.equal(s2Sql.includes(bannedNumber), false);
assert.match(teardownSql, /DELETE FROM public.profiles/);
assert.match(readFileSync('scripts/loadtest/sql/reference.sql', 'utf8'), /does not/);

assert.deepEqual(interpretPsql('ERROR: LOADTEST_ALREADY_SEEDED', 1), {
  exitCode: 0,
  alreadySeeded: true,
});
assert.deepEqual(interpretPsql('partial loadtest batch s1', 1), {
  exitCode: 1,
  alreadySeeded: false,
});
assert.deepEqual(interpretPsql('', 0), { exitCode: 0, alreadySeeded: false });

const secretUrl = 'postgres://loadtest:pw-fixture@db.staging.example.test:5432/postgres';
const redacted = redactSecrets(`boom ${secretUrl} also postgresql://user:other-secret@db.example.test/postgres`, secretUrl);
assert.equal(redacted.includes('pw-fixture'), false);
assert.equal(redacted.includes('other-secret'), false);
assert.match(redacted, /\[redacted-url\]/);
assert.match(redacted, /postgres:\/\/\[redacted\]@/);

assert.equal(missingColumns({}).length > 0, true);
assert.equal(
  missingColumns({
    profiles: new Set(['id', 'trading_name', 'legal_name', 'email', 'supplier_status', 'user_id', 'metadata']),
  }).includes('profiles.created_at'),
  true
);
assert.equal(
  missingColumns({
    profiles: new Set(['id', 'trading_name', 'legal_name', 'email', 'supplier_status', 'user_id', 'metadata', 'created_at']),
  }).some((item) => item.startsWith('profiles.')),
  false
);

const notNullSnapshot = JSON.parse(readFileSync('scripts/loadtest/schema/not-null-columns.json', 'utf8'));
const requiredNotNull = notNullWithoutDefault(notNullSnapshot);
assert.deepEqual(requiredNotNull.profiles, ['created_at']);
assert.equal(omittedNotNullColumns(seedSql, notNullSnapshot).length, 0);
assert.equal(omittedNotNullColumns(renderSeedSql('s2', 's2'), notNullSnapshot).length, 0);
const droppedCreatedAt = seedSql.replace(/, created_at/g, '');
assert.deepEqual(omittedNotNullColumns(droppedCreatedAt, notNullSnapshot), ['profiles.created_at']);
const withExtra = JSON.parse(JSON.stringify(notNullSnapshot));
withExtra.tables.customers.push({
  column: 'must_write',
  nullable: 'NO',
  default: null,
  identity: 'NO',
  generated: 'NEVER',
});
assert.deepEqual(omittedNotNullColumns(seedSql, withExtra), ['customers.must_write']);
const withDefault = JSON.parse(JSON.stringify(notNullSnapshot));
withDefault.tables.profiles = withDefault.tables.profiles.map((col: { column: string }) =>
  col.column === 'created_at' ? { ...col, default: 'now()' } : col
);
assert.equal(omittedNotNullColumns(droppedCreatedAt, withDefault).includes('profiles.created_at'), false);
assert.match(seedSql, /created_at/);
assert.match(seedSql, /TIMESTAMPTZ '2024-01-01 00:00:00\+00'/);

const small = buildPlan('s1', { preset: 'small' });
assert.equal(small.companies, 500);
assert.equal(small.users, 2500);
assert.equal(small.medianUsers, 5);
assert.equal(small.minUsers, 5);
assert.equal(small.maxUsers, 5);
assert.equal(small.peers, 50);
assert.equal(small.totals.activity_log, 10000);
assert.equal(small.activityPerCompany, 20);
const smallSql = renderSeedSql('s1', 'small', { preset: 'small' });
assert.match(smallSql, /generate_series\(1, 500\)/);
assert.match(smallSql, /IF existing = 500/);
assert.equal(omittedNotNullColumns(smallSql, notNullSnapshot).length, 0);
assert.equal(smallSql.includes(PRODUCTION_PROJECT_REF), false);
const overridden = buildPlan('s2', { companies: 100, users: 400, activityPerCompany: 3 });
assert.equal(overridden.companies, 100);
assert.equal(overridden.users, 400);
assert.equal(overridden.totals.activity_log, 300);
assert.throws(() => buildPlan('s1', { companies: 5001 }), /companies must be an integer/);
assert.throws(() => buildPlan('s1', { preset: 'small', users: 1 }), /users must be an integer/);
assert.throws(() => buildPlan('s1', { preset: 'huge' }), /preset must be small/);

const parts = libpqEnv(`${secretUrl}?sslmode=require`);
assert.equal(parts.PGHOST, 'db.staging.example.test');
assert.equal(parts.PGSSLMODE, 'require');
assert.equal(parts.PGPASSWORD, 'pw-fixture');
assert.throws(() => libpqEnv('not a url'), /SEED_DATABASE_URL is not a URL/);

const host = 'db.staging.example.test';
const goodEnv = {
  SEED_TARGET_PROJECT_REF: 'stagingprojectref',
  LOADTEST_EXPECT_PROJECT_REF: 'stagingprojectref',
  SEED_DATABASE_URL: `postgres://postgres.stagingprojectref:pw-fixture@${host}:5432/postgres?sslmode=require`,
  LOADTEST_ALLOWED_HOSTS: host,
  DATABASE_URL: `postgres://prod:nope@db.${PRODUCTION_PROJECT_REF}.supabase.co:5432/postgres`,
  NEXT_PUBLIC_SUPABASE_URL: `https://${PRODUCTION_PROJECT_REF}.supabase.co`,
};

function refusal(env: Record<string, string>, needle: RegExp) {
  const stdout = capture();
  const stderr = capture();
  let spawned = false;
  const result = runSeed({
    argv: ['--apply', '--expect-ref', 'stagingprojectref'],
    env,
    stdout,
    stderr,
    spawn() {
      spawned = true;
      throw new Error('spawned');
    },
  });
  assert.equal(result.exitCode, 1);
  assert.equal(spawned, false);
  assert.match(stderr.read(), needle);
  assert.equal(stdout.read().includes('pw-fixture'), false);
  assert.equal(stderr.read().includes('pw-fixture'), false);
}

refusal({}, /SEED_TARGET_PROJECT_REF and LOADTEST_EXPECT_PROJECT_REF are required/);
refusal(
  { ...goodEnv, SEED_TARGET_PROJECT_REF: PRODUCTION_PROJECT_REF, LOADTEST_EXPECT_PROJECT_REF: PRODUCTION_PROJECT_REF },
  /production project/
);
refusal(
  { ...goodEnv, SEED_TARGET_PROJECT_REF: 'stagingprojectref', LOADTEST_EXPECT_PROJECT_REF: 'otherprojectref' },
  /does not match/
);
refusal({ ...goodEnv, LOADTEST_ALLOWED_HOSTS: '' }, /LOADTEST_ALLOWED_HOSTS is empty/);
refusal({ ...goodEnv, LOADTEST_ALLOWED_HOSTS: 'other.example.test' }, /not on LOADTEST_ALLOWED_HOSTS/);
refusal(
  {
    ...goodEnv,
    SEED_DATABASE_URL: `postgres://loadtest:pw-fixture@${host}:5432/${PRODUCTION_PROJECT_REF}`,
  },
  /database URL contains the production project ref/
);

const denied = productionDenyHosts()[0];
refusal(
  {
    ...goodEnv,
    SEED_DATABASE_URL: `postgres://postgres.stagingprojectref:pw-fixture@${denied}:5432/postgres`,
    LOADTEST_ALLOWED_HOSTS: denied,
  },
  /production deny list/
);

assert.equal(
  evaluateSeedTarget({
    targetProjectRef: 'stagingprojectref',
    expectProjectRef: 'stagingprojectref',
    databaseUrl: goodEnv.SEED_DATABASE_URL,
    allowedHosts: host,
  }).ok,
  true
);
assert.equal(
  evaluateSeedTarget({
    targetProjectRef: '  StagingProjectRef ',
    expectProjectRef: 'STAGINGPROJECTREF',
    databaseUrl: `postgres://postgres.stagingprojectref:pw-fixture@${host}.:5432/postgres`,
    allowedHosts: `${host}.`,
  }).ok,
  true
);
const encodedRef = PRODUCTION_PROJECT_REF.replace('l', '%6C');
assert.equal(
  evaluateSeedTarget({
    targetProjectRef: 'stagingprojectref',
    expectProjectRef: 'stagingprojectref',
    databaseUrl: `postgres://postgres.${encodedRef}:pw-fixture@${host}:5432/postgres`,
    allowedHosts: host,
  }).ok,
  false
);
refusal(
  {
    ...goodEnv,
    SEED_DATABASE_URL: `postgres://postgres.stagingprojectref:pw-fixture@not${host}:5432/postgres`,
  },
  /not on LOADTEST_ALLOWED_HOSTS/
);
refusal({ ...goodEnv, LOADTEST_ALLOWED_HOSTS: 'example.test' }, /not on LOADTEST_ALLOWED_HOSTS/);
const quiet = runSeed({
  argv: [],
  env: goodEnv,
  stdout: capture(),
  stderr: capture(),
  spawn() {
    throw new Error('spawned');
  },
});
assert.equal(quiet.exitCode, 0);
const blockedCi = capture();
const ciRun = runSeed({
  argv: ['--apply', '--expect-ref', 'stagingprojectref'],
  env: { ...goodEnv, CI: 'true' },
  stdout: capture(),
  stderr: blockedCi,
  spawn() {
    throw new Error('spawned');
  },
});
assert.equal(ciRun.exitCode, 1);
assert.match(blockedCi.read(), /CI is set/);
const blockedVercel = capture();
const vercelRun = runSeed({
  argv: ['--apply', '--expect-ref', 'stagingprojectref'],
  env: { ...goodEnv, VERCEL: '1' },
  stdout: capture(),
  stderr: blockedVercel,
  spawn() {
    throw new Error('spawned');
  },
});
assert.equal(vercelRun.exitCode, 1);
assert.match(blockedVercel.read(), /VERCEL is set/);
const missingFlag = capture();
const noExpect = runSeed({
  argv: ['--apply'],
  env: goodEnv,
  stdout: capture(),
  stderr: missingFlag,
  spawn() {
    throw new Error('spawned');
  },
});
assert.equal(noExpect.exitCode, 1);
assert.match(missingFlag.read(), /--apply requires --expect-ref/);

const dry = capture();
const dryErr = capture();
const dryResult = runSeed({ argv: ['--dry-run'], env: {}, stdout: dry, stderr: dryErr, spawn() { throw new Error('spawned'); } });
assert.equal(dryResult.exitCode, 0);
assert.match(dry.read(), /users 36250/);
assert.match(dry.read(), /median_users 8/);
assert.match(dry.read(), /dry-run does not connect/);
assert.match(dry.read(), /@loadtest\.invalid/);
assert.equal(dryErr.read(), '');

const dryBad = runSeed({
  argv: ['--dry-run'],
  env: { SEED_TARGET_PROJECT_REF: PRODUCTION_PROJECT_REF },
  stdout: capture(),
  stderr: capture(),
  spawn() {
    throw new Error('spawned');
  },
});
assert.equal(dryBad.exitCode, 1);

const calls: Array<[string, string[], { input: string; env: NodeJS.ProcessEnv }]> = [];
const seededOut = capture();
const seededErr = capture();
const seeded = runSeed({
  argv: ['--apply', '--expect-ref', 'stagingprojectref', '--profile', 's1', '--batch', 's1'],
  env: goodEnv,
  stdout: seededOut,
  stderr: seededErr,
  spawn(cmd: string, args: string[], opts: { input: string; env: NodeJS.ProcessEnv }) {
    calls.push([cmd, args, opts]);
    return { status: 0, stdout: 'table_name,total_size\nprofiles,1 kB\n', stderr: '' };
  },
});
assert.equal(seeded.exitCode, 0);
assert.equal(calls.length, 1);
assert.equal(calls[0][0], 'psql');
assert.equal(calls[0][1].join(' ').includes('statement_timeout'), false);
assert.equal(calls[0][1].join(' ').includes('pw-fixture'), false);
assert.equal(calls[0][1].join(' ').includes(host), false);
assert.match(calls[0][2].input, /BEGIN/);
assert.equal(calls[0][2].env.PGHOST, host);
assert.equal(calls[0][2].env.PGSSLMODE, 'require');
assert.equal(calls[0][2].env.PGPASSWORD, 'pw-fixture');
assert.equal(calls[0][2].env.SEED_DATABASE_URL, undefined);
assert.equal(calls[0][2].env.DATABASE_URL, undefined);
assert.equal(calls[0][2].env.NEXT_PUBLIC_SUPABASE_URL, undefined);
assert.equal(seededOut.read().includes('pw-fixture'), false);
assert.match(seededOut.read(), /profiles,1 kB/);

const againOut = capture();
const again = runSeed({
  argv: ['--apply', '--expect-ref', 'stagingprojectref'],
  env: goodEnv,
  stdout: againOut,
  stderr: capture(),
  spawn() {
    return { status: 3, stdout: '', stderr: 'ERROR: LOADTEST_ALREADY_SEEDED\n' };
  },
});
assert.equal(again.exitCode, 0);
assert.match(againOut.read(), /already seeded; nothing changed/);

const missing = runSeed({
  argv: ['--apply', '--expect-ref', 'stagingprojectref'],
  env: goodEnv,
  stdout: capture(),
  stderr: capture(),
  spawn() {
    return { error: Object.assign(new Error('spawn psql ENOENT'), { code: 'ENOENT' }), status: null, stdout: '', stderr: '' };
  },
});
assert.equal(missing.exitCode, 1);

assert.throws(() => parseArgs(['--profile', 's3']), /profile must be s1 or s2/);
assert.throws(() => parseArgs(['--wat']), /unknown argument/);
assert.deepEqual(parseArgs([]), {
  dryRun: true,
  apply: false,
  profile: 's1',
  batch: 's1',
  expectRef: '',
  preset: '',
  companies: undefined,
  users: undefined,
  activityPerCompany: undefined,
});
assert.deepEqual(parseArgs(['--profile', 's2']), {
  dryRun: true,
  apply: false,
  profile: 's2',
  batch: 's2',
  expectRef: '',
  preset: '',
  companies: undefined,
  users: undefined,
  activityPerCompany: undefined,
});
assert.equal(parseArgs(['--preset', 'small']).preset, 'small');
assert.equal(parseArgs(['--companies', '40', '--users', '80', '--activity-per-company', '7']).companies, 40);
assert.throws(() => parseArgs(['--preset', 'huge']), /preset must be small/);
assert.throws(() => parseArgs(['--companies', '0']), /positive integer/);
assert.throws(() => parseArgs(['--users', 'nope']), /positive integer/);
assert.throws(() => assertBatchId(''), /batch id/);
assert.throws(() => parseArgs(['--batch', 'S1']), /batch id/);
assert.throws(() => parseArgs(['--batch', 'has space']), /batch id/);
assert.throws(() => assertBatchId(PRODUCTION_PROJECT_REF), /production project ref/);
assert.equal(assertBatchId('s1'), 's1');
assert.throws(() => parseTeardownArgs(['--nope']), /unknown argument/);

const tear = runTeardown({
  argv: ['--dry-run'],
  env: {},
  stdout: capture(),
  stderr: capture(),
  spawn() {
    throw new Error('spawned');
  },
});
assert.equal(tear.exitCode, 0);

const pkg = readFileSync('package.json', 'utf8');
assert.equal(pkg.includes('scripts/loadtest'), false);
assert.equal(pkg.includes('seed.mjs'), false);
assert.equal(pkg.includes('k6'), false);
for (const file of walk('.github/workflows')) {
  const text = readFileSync(file, 'utf8');
  assert.equal(text.includes('seed.mjs'), false, file);
  assert.equal(text.includes('seed-teardown.mjs'), false, file);
  assert.equal(text.includes('k6'), false, file);
}

const emailRe = /@([a-z0-9.-]+\.[a-z]{2,})/gi;
for (const file of walk('scripts/loadtest')) {
  const text = readFileSync(file, 'utf8');
  assert.equal(text.includes(bannedNumber), false, file);
  assert.equal(text.toLowerCase().includes(bannedName), false, file);
  assert.equal(text.toLowerCase().includes(bannedClaim), false, file);
  const withoutUrls = text.replace(/[a-z][a-z0-9+.-]*:\/\/[^\s'"]+/gi, '');
  const domains = [...withoutUrls.matchAll(emailRe)].map((match) => match[1].toLowerCase());
  assert.ok(domains.includes('loadtest.invalid') || !text.includes('@loadtest.invalid'), file);
  for (const domain of domains) {
    assert.equal(domain, 'loadtest.invalid', `${file} @${domain}`);
  }
}

function listen(): Promise<{ server: net.Server; port: number; hits: () => number }> {
  return new Promise((resolve, reject) => {
    let n = 0;
    const server = net.createServer((socket) => {
      n += 1;
      socket.destroy();
    });
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('no port'));
        return;
      }
      resolve({ server, port: address.port, hits: () => n });
    });
  });
}

async function refusesWithoutConnecting() {
  const listener = await listen();
  const url = `postgres://loadtest:pw-fixture@127.0.0.1:${listener.port}/${PRODUCTION_PROJECT_REF}`;
  const childEnv = { ...process.env };
  delete childEnv.CI;
  delete childEnv.VERCEL;
  const child = spawn(process.execPath, ['scripts/loadtest/seed.mjs', '--apply', '--expect-ref', PRODUCTION_PROJECT_REF, '--profile', 's1'], {
    env: {
      ...childEnv,
      SEED_TARGET_PROJECT_REF: PRODUCTION_PROJECT_REF,
      LOADTEST_EXPECT_PROJECT_REF: PRODUCTION_PROJECT_REF,
      SEED_DATABASE_URL: url,
      LOADTEST_ALLOWED_HOSTS: '127.0.0.1',
      DATABASE_URL: url,
    },
  });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    stdout += chunk;
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });
  const code = await new Promise<number>((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('seed process hung'));
    }, 15000);
    child.once('exit', (status) => {
      clearTimeout(timer);
      resolve(status ?? 1);
    });
  });
  await new Promise((resolve) => listener.server.close(resolve));
  assert.equal(code, 1);
  assert.equal(listener.hits(), 0);
  assert.match(stderr, /Refusing to seed/);
  assert.equal(stderr.includes('psql is not on PATH'), false);
  assert.equal(stdout.includes('pw-fixture'), false);
  assert.equal(stderr.includes('pw-fixture'), false);
  assert.equal(stdout.includes(PRODUCTION_PROJECT_REF), false);
}

refusesWithoutConnecting()
  .then(() => {
    console.log('seed.test.ts ok');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
