/**
 * Staging seed. Refuses every target except a named staging project.
 * Does not read DATABASE_URL or NEXT_PUBLIC_SUPABASE_URL.
 * Run: node scripts/loadtest/seed.mjs
 * A write needs --apply and --expect-ref. The default is a dry run.
 */
import { spawnSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { buildPlan, formatPlan } from './lib/distribution.mjs';
import { assertBatchId, automationRefusal, evaluateSeedTarget, libpqEnv, readSeedEnv, targetIsSet } from './lib/guard.mjs';
import { interpretPsql, redactSecrets, renderSeedSql } from './lib/sql.mjs';

function readFlag(argv, i, flag) {
  const raw = argv[i + 1];
  if (raw == null || raw === '' || String(raw).startsWith('--')) {
    throw new Error(`${flag} requires a value`);
  }
  return raw;
}

function readCount(raw, flag) {
  if (!/^[1-9]\d*$/.test(String(raw))) throw new Error(`${flag} must be a positive integer`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) throw new Error(`${flag} must be a positive integer`);
  return value;
}

export function parseArgs(argv) {
  let apply = false;
  let dryRunFlag = false;
  let profile = 's1';
  let batch = '';
  let expectRef = '';
  let preset = '';
  let companies;
  let users;
  let activityPerCompany;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      dryRunFlag = true;
    } else if (arg === '--apply') {
      apply = true;
    } else if (arg === '--expect-ref') {
      expectRef = readFlag(argv, i, arg);
      i += 1;
    } else if (arg === '--profile') {
      profile = readFlag(argv, i, arg);
      if (profile !== 's1' && profile !== 's2') throw new Error('profile must be s1 or s2');
      i += 1;
    } else if (arg === '--batch') {
      batch = readFlag(argv, i, arg);
      i += 1;
    } else if (arg === '--preset') {
      preset = readFlag(argv, i, arg);
      if (preset !== 'small') throw new Error('preset must be small');
      i += 1;
    } else if (arg === '--companies') {
      companies = readCount(readFlag(argv, i, arg), arg);
      i += 1;
    } else if (arg === '--users') {
      users = readCount(readFlag(argv, i, arg), arg);
      i += 1;
    } else if (arg === '--activity-per-company') {
      activityPerCompany = readCount(readFlag(argv, i, arg), arg);
      i += 1;
    } else {
      throw new Error(`unknown argument ${arg}`);
    }
  }
  if (!batch) batch = profile;
  assertBatchId(batch);
  const dryRun = dryRunFlag || !apply;
  return {
    dryRun,
    apply: apply && !dryRunFlag,
    profile,
    batch,
    expectRef,
    preset,
    companies,
    users,
    activityPerCompany,
  };
}

function sizeFromArgs(args) {
  return {
    preset: args.preset,
    companies: args.companies,
    users: args.users,
    activityPerCompany: args.activityPerCompany,
  };
}

function childEnv(parent, databaseUrl) {
  const env = { ...parent };
  delete env.SEED_DATABASE_URL;
  delete env.DATABASE_URL;
  delete env.NEXT_PUBLIC_SUPABASE_URL;
  return { ...env, ...libpqEnv(databaseUrl) };
}

export function runSeed({ argv = [], env = {}, spawn = spawnSync, stdout = process.stdout, stderr = process.stderr } = {}) {
  const blocked = automationRefusal(env);
  if (blocked) {
    stderr.write(`${blocked}\n`);
    return { exitCode: 1, spawned: false };
  }
  const args = parseArgs(argv);
  const size = sizeFromArgs(args);
  const plan = formatPlan(buildPlan(args.profile, size));
  const target = readSeedEnv(env);
  stdout.write(plan);

  if (args.apply && !String(args.expectRef || '').trim()) {
    stderr.write('Refusing to seed: --apply requires --expect-ref\n');
    return { exitCode: 1, spawned: false };
  }

  if (args.dryRun) {
    if (targetIsSet(target)) {
      const verdict = evaluateSeedTarget(target);
      if (!verdict.ok) {
        stderr.write(`${verdict.reason}\n`);
        return { exitCode: 1, spawned: false };
      }
    }
    return { exitCode: 0, spawned: false };
  }

  const verdict = evaluateSeedTarget({ ...target, cliExpectRef: args.expectRef });
  if (!verdict.ok) {
    stderr.write(`${verdict.reason}\n`);
    return { exitCode: 1, spawned: false };
  }

  const sql = renderSeedSql(args.profile, args.batch, size);
  if (sql.includes('statement_timeout')) {
    stderr.write('Refusing to seed: generated SQL must not change server timeouts\n');
    return { exitCode: 1, spawned: false };
  }

  const result = spawn('psql', ['-X', '-v', 'ON_ERROR_STOP=1', '-f', '-'], {
    input: sql,
    encoding: 'utf8',
    env: childEnv(env, target.databaseUrl),
  });

  if (result.error && result.error.code === 'ENOENT') {
    stderr.write('psql is not on PATH; nothing was seeded\n');
    return { exitCode: 1, spawned: true };
  }
  if (result.error) {
    stderr.write('psql failed to start; nothing was seeded\n');
    return { exitCode: 1, spawned: true };
  }

  const interpreted = interpretPsql(result.stderr, result.status);
  if (interpreted.alreadySeeded) {
    stdout.write('already seeded; nothing changed\n');
    return { exitCode: 0, spawned: true, alreadySeeded: true };
  }

  const out = redactSecrets(result.stdout, target.databaseUrl);
  const err = redactSecrets(result.stderr, target.databaseUrl);
  if (out) stdout.write(out.endsWith('\n') ? out : `${out}\n`);
  if (err) stderr.write(err.endsWith('\n') ? err : `${err}\n`);
  return { exitCode: interpreted.exitCode, spawned: true, alreadySeeded: false };
}

function invokedDirectly() {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(realpathSync(entry)).href;
  } catch {
    return false;
  }
}

if (invokedDirectly()) {
  try {
    const result = runSeed({ argv: process.argv.slice(2), env: process.env });
    process.exit(result.exitCode);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : 'seed failed'}\n`);
    process.exit(1);
  }
}
