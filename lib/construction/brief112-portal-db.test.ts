/**
 * ConstructionAdvisor® portal throttle table on Postgres.
 * Apply supabase/migrations/20261018_constructiongraph_portal_hardening.sql twice.
 *
 * Run:
 *   CONSTRUCTION_PORTAL_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/constructiongraph \
 *     npx --yes tsx lib/construction/brief112-portal-db.test.ts
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const url = process.env.CONSTRUCTION_PORTAL_DATABASE_URL;
if (!url) {
  throw new Error(
    'CONSTRUCTION_PORTAL_DATABASE_URL is required (CI Postgres service, or a local database)'
  );
}

const migration = resolve('supabase/migrations/20261018_constructiongraph_portal_hardening.sql');

function psql(statement: string): string {
  return execFileSync(
    'psql',
    [url!, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-t', '-A'],
    { encoding: 'utf8', input: statement }
  ).trim();
}

function psqlFile(path: string) {
  execFileSync('psql', [url!, '-X', '-v', 'ON_ERROR_STOP=1', '-f', path], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function fails(statement: string, pattern: RegExp) {
  try {
    psql(statement);
  } catch (error) {
    const stderr =
      error && typeof error === 'object' && 'stderr' in error
        ? String((error as { stderr?: unknown }).stderr || '')
        : '';
    const message = `${error instanceof Error ? error.message : String(error)}\n${stderr}`;
    assert.match(message, pattern);
    return;
  }
  assert.fail(`expected Postgres to reject: ${statement.slice(0, 80)}`);
}

psql(`
  DROP SCHEMA IF EXISTS public CASCADE;
  CREATE SCHEMA public;
  GRANT USAGE, CREATE ON SCHEMA public TO public;
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      CREATE ROLE anon NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      CREATE ROLE authenticated NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      CREATE ROLE service_role NOLOGIN BYPASSRLS;
    END IF;
  END $$;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
`);

psqlFile(migration);
psqlFile(migration);

const forced = psql(`
  SELECT (c.relrowsecurity AND c.relforcerowsecurity)::text
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'construction_portal_attempts';
`);
assert.equal(forced, 'true');

for (const role of ['anon', 'authenticated']) {
  for (const verb of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
    const sql =
      verb === 'SELECT'
        ? `SET ROLE ${role}; SELECT count(*) FROM public.construction_portal_attempts;`
        : verb === 'INSERT'
          ? `SET ROLE ${role}; INSERT INTO public.construction_portal_attempts (key_hash) VALUES ('x');`
          : verb === 'UPDATE'
            ? `SET ROLE ${role}; UPDATE public.construction_portal_attempts SET key_hash = 'y';`
            : `SET ROLE ${role}; DELETE FROM public.construction_portal_attempts;`;
    fails(sql, /permission denied/i);
  }
}

for (const fn of [
  'public.construction_portal_register_failure(text)',
  'public.construction_portal_is_throttled(text)',
]) {
  assert.equal(psql(`SELECT has_function_privilege('service_role', '${fn}', 'EXECUTE');`), 't', fn);
  assert.equal(psql(`SELECT has_function_privilege('anon', '${fn}', 'EXECUTE');`), 'f', fn);
  assert.equal(psql(`SELECT has_function_privilege('authenticated', '${fn}', 'EXECUTE');`), 'f', fn);
  assert.equal(
    psql(`
      SELECT COUNT(*)
      FROM aclexplode((SELECT proacl FROM pg_proc WHERE oid = '${fn}'::regprocedure)) acl
      WHERE acl.grantee = 0 AND acl.privilege_type = 'EXECUTE';
    `),
    '0',
    fn
  );
}

for (const name of ['construction_portal_register_failure', 'construction_portal_is_throttled']) {
  const config = psql(`
    SELECT prosecdef::text || ' ' || COALESCE(array_to_string(proconfig, ','), '')
    FROM pg_proc
    WHERE proname = '${name}';
  `);
  assert.match(config, /^true /);
  assert.match(config, /search_path=""/);
}

const caller = psql(`
  SET ROLE service_role;
  SELECT public.construction_portal_is_throttled('key-service');
`);
assert.equal(caller, 'f');

for (let i = 0; i < 30; i += 1) {
  psql(`SELECT public.construction_portal_register_failure('key-a');`);
}
assert.equal(psql(`SELECT public.construction_portal_is_throttled('key-a');`), 'f');
psql(`SELECT public.construction_portal_register_failure('key-a');`);
assert.equal(psql(`SELECT public.construction_portal_is_throttled('key-a');`), 't');

psql(`SELECT public.construction_portal_register_failure('key-b');`);
assert.equal(psql(`SELECT public.construction_portal_is_throttled('key-b');`), 'f');

psql(`
  INSERT INTO public.construction_portal_attempts (key_hash, at)
  SELECT 'key-old', pg_catalog.now() - interval '16 minutes'
  FROM generate_series(1, 40);
`);
assert.equal(psql(`SELECT public.construction_portal_is_throttled('key-old');`), 'f');

fails(
  `SELECT public.construction_portal_register_failure(NULL);`,
  /construction_portal_register_failure_closed|invalid_parameter_value/i
);
fails(
  `SELECT public.construction_portal_register_failure('   ');`,
  /construction_portal_register_failure_closed|invalid_parameter_value/i
);
assert.equal(psql(`SELECT public.construction_portal_is_throttled(NULL);`), 't');
assert.equal(psql(`SELECT public.construction_portal_is_throttled('');`), 't');

const sequence = 'public.construction_portal_attempts_id_seq';
for (const role of ['anon', 'authenticated']) {
  for (const privilege of ['USAGE', 'SELECT', 'UPDATE']) {
    assert.equal(
      psql(`SELECT has_sequence_privilege('${role}', '${sequence}', '${privilege}');`),
      'f',
      `${role} ${privilege}`
    );
  }
}
assert.equal(psql(`SELECT has_sequence_privilege('service_role', '${sequence}', 'USAGE');`), 't');
fails(`SET ROLE anon; SELECT nextval('${sequence}');`, /permission denied/i);
fails(`SET ROLE authenticated; SELECT setval('${sequence}', 1, false);`, /permission denied/i);

console.log('brief112-portal-db.test.ts ok');
