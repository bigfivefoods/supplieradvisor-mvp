/**
 * Deletes one loadtest batch from the named staging project.
 * Same refusal rules as seed.mjs. Does not read DATABASE_URL.
 * Run: node scripts/loadtest/seed-teardown.mjs --dry-run --batch s1
 */
import { spawnSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { assertBatchId, evaluateSeedTarget, libpqEnv, readSeedEnv, targetIsSet } from './lib/guard.mjs';
import { redactSecrets, renderTeardownSql, SEEDED_TABLES } from './lib/sql.mjs';

export function parseArgs(argv) {
  let dryRun = false;
  let batch = 's1';
  let batchSet = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--batch') {
      batch = argv[i + 1] || '';
      batchSet = true;
      i += 1;
    } else {
      throw new Error(`unknown argument ${arg}`);
    }
  }
  if (batchSet) assertBatchId(batch);
  else assertBatchId(batch);
  return { dryRun, batch };
}

function childEnv(parent, databaseUrl) {
  const env = { ...parent };
  delete env.SEED_DATABASE_URL;
  delete env.DATABASE_URL;
  delete env.NEXT_PUBLIC_SUPABASE_URL;
  return { ...env, ...libpqEnv(databaseUrl) };
}

export function formatTeardownPlan(batch) {
  const lines = [
    `teardown batch ${batch}`,
    'deletes marked rows only',
    ...SEEDED_TABLES.map((table) => `table ${table}`),
    'dry-run does not connect',
  ];
  return `${lines.join('\n')}\n`;
}

export function runTeardown({ argv = [], env = {}, spawn = spawnSync, stdout = process.stdout, stderr = process.stderr } = {}) {
  const args = parseArgs(argv);
  const target = readSeedEnv(env);
  stdout.write(formatTeardownPlan(args.batch));

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

  const sql = renderTeardownSql(args.batch);
  const result = spawn('psql', ['-X', '-v', 'ON_ERROR_STOP=1', '-f', '-'], {
    input: sql,
    encoding: 'utf8',
    env: childEnv(env, target.databaseUrl),
  });

  if (result.error && result.error.code === 'ENOENT') {
    stderr.write('psql is not on PATH; nothing was deleted\n');
    return { exitCode: 1, spawned: true };
  }
  if (result.error) {
    stderr.write('psql failed to start; nothing was deleted\n');
    return { exitCode: 1, spawned: true };
  }

  const out = redactSecrets(result.stdout, target.databaseUrl);
  const err = redactSecrets(result.stderr, target.databaseUrl);
  if (out) stdout.write(out.endsWith('\n') ? out : `${out}\n`);
  if (err) stderr.write(err.endsWith('\n') ? err : `${err}\n`);
  return { exitCode: result.status === 0 ? 0 : 1, spawned: true };
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
    const result = runTeardown({ argv: process.argv.slice(2), env: process.env });
    process.exit(result.exitCode);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : 'teardown failed'}\n`);
    process.exit(1);
  }
}
