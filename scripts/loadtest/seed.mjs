/**
 * Staging seed. Refuses every target except a named staging project.
 * Does not read DATABASE_URL or NEXT_PUBLIC_SUPABASE_URL.
 * Run: node scripts/loadtest/seed.mjs --dry-run
 */
import { spawnSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { buildPlan, formatPlan } from './lib/distribution.mjs';
import { assertBatchId, evaluateSeedTarget, libpqEnv, readSeedEnv, targetIsSet } from './lib/guard.mjs';
import { interpretPsql, redactSecrets, renderSeedSql } from './lib/sql.mjs';

export function parseArgs(argv) {
  let dryRun = false;
  let profile = 's1';
  let batch = '';
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--profile') {
      profile = argv[i + 1];
      if (profile !== 's1' && profile !== 's2') throw new Error('profile must be s1 or s2');
      i += 1;
    } else if (arg === '--batch') {
      batch = argv[i + 1] || '';
      i += 1;
    } else {
      throw new Error(`unknown argument ${arg}`);
    }
  }
  if (!batch) batch = profile;
  assertBatchId(batch);
  return { dryRun, profile, batch };
}

function childEnv(parent, databaseUrl) {
  const env = { ...parent };
  delete env.SEED_DATABASE_URL;
  delete env.DATABASE_URL;
  delete env.NEXT_PUBLIC_SUPABASE_URL;
  return { ...env, ...libpqEnv(databaseUrl) };
}

export function runSeed({ argv = [], env = {}, spawn = spawnSync, stdout = process.stdout, stderr = process.stderr } = {}) {
  const args = parseArgs(argv);
  const plan = formatPlan(buildPlan(args.profile));
  const target = readSeedEnv(env);
  stdout.write(plan);

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

  const verdict = evaluateSeedTarget(target);
  if (!verdict.ok) {
    stderr.write(`${verdict.reason}\n`);
    return { exitCode: 1, spawned: false };
  }

  const sql = renderSeedSql(args.profile, args.batch);
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
