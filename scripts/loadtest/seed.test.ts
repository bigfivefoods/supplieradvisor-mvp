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
  evaluateSeedTarget,
  libpqEnv,
  productionDenyHosts,
} from './lib/guard.mjs';
import { interpretPsql, missingColumns, redactSecrets, renderSeedSql, renderTeardownSql } from './lib/sql.mjs';
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
assert.deepEqual(
  missingColumns({
    profiles: new Set(['id', 'trading_name', 'legal_name', 'email', 'supplier_status', 'user_id', 'metadata']),
  }).some((item) => item.startsWith('profiles.')),
  false
);

const parts = libpqEnv(`${secretUrl}?sslmode=require`);
assert.equal(parts.PGHOST, 'db.staging.example.test');
assert.equal(parts.PGSSLMODE, 'require');
assert.equal(parts.PGPASSWORD, 'pw-fixture');
assert.throws(() => libpqEnv('not a url'), /SEED_DATABASE_URL is not a URL/);

const host = 'db.staging.example.test';
const goodEnv = {
  SEED_TARGET_PROJECT_REF: 'stagingprojectref',
  LOADTEST_EXPECT_PROJECT_REF: 'stagingprojectref',
  SEED_DATABASE_URL: `postgres://loadtest:pw-fixture@${host}:5432/postgres?sslmode=require`,
  LOADTEST_ALLOWED_HOSTS: host,
  DATABASE_URL: `postgres://prod:nope@db.${PRODUCTION_PROJECT_REF}.supabase.co:5432/postgres`,
  NEXT_PUBLIC_SUPABASE_URL: `https://${PRODUCTION_PROJECT_REF}.supabase.co`,
};

function refusal(env: Record<string, string>, needle: RegExp) {
  const stdout = capture();
  const stderr = capture();
  let spawned = false;
  const result = runSeed({
    argv: [],
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
    SEED_DATABASE_URL: `postgres://loadtest:pw-fixture@${denied}:5432/postgres`,
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
  argv: ['--profile', 's1', '--batch', 's1'],
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
  argv: [],
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
  argv: [],
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
assert.deepEqual(parseArgs([]), { dryRun: false, profile: 's1', batch: 's1' });
assert.deepEqual(parseArgs(['--profile', 's2']), { dryRun: false, profile: 's2', batch: 's2' });
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
  assert.equal(text.includes('scripts/loadtest'), false, file);
  assert.equal(text.includes('seed.mjs'), false, file);
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
  const child = spawn(process.execPath, ['scripts/loadtest/seed.mjs', '--profile', 's1'], {
    env: {
      ...process.env,
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
