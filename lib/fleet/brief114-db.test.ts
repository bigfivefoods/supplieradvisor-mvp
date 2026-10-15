/**
 * FleetAdvisor® Postgres contract.
 * Apply supabase/migrations/20261019_fleetgraph_a.sql twice after Supabase-like default privileges.
 *
 * Run:
 *   FLEET_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/fleetgraph \
 *     npx --yes tsx lib/fleet/brief114-db.test.ts
 */
import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const url = process.env.FLEET_DATABASE_URL;
if (!url) throw new Error('FLEET_DATABASE_URL is required');

const migration = resolve('supabase/migrations/20261019_fleetgraph_a.sql');

function psql(statement: string): string {
  return execFileSync('psql', [url!, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-t', '-A'], {
    encoding: 'utf8',
    input: statement,
  }).trim();
}

function psqlFile(path: string) {
  execFileSync('psql', [url!, '-X', '-v', 'ON_ERROR_STOP=1', '-f', path], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function psqlAsync(statement: string): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    execFile(
      'psql',
      [url!, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-t', '-A'],
      { encoding: 'utf8' },
      (error, stdout, stderr) => {
        if (error) reject(new Error(`${stderr || ''}\n${error.message}`));
        else resolvePromise(String(stdout).trim());
      }
    ).stdin?.end(statement);
  });
}

function fails(statement: string, pattern: RegExp) {
  try {
    psql(statement);
  } catch (error) {
    const stderr = error && typeof error === 'object' && 'stderr' in error ? String((error as { stderr?: unknown }).stderr || '') : '';
    const message = `${error instanceof Error ? error.message : String(error)}\n${stderr}`;
    assert.match(message, pattern);
    return;
  }
  assert.fail(`expected Postgres to reject: ${statement.slice(0, 120)}`);
}

async function main() {
psql(`
  DROP SCHEMA IF EXISTS public CASCADE;
  CREATE SCHEMA public;
  GRANT USAGE, CREATE ON SCHEMA public TO public;
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
  END $$;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
  CREATE TABLE public.profiles (id bigint PRIMARY KEY);
  CREATE TABLE public.customers (id bigint PRIMARY KEY, profile_id bigint);
  INSERT INTO public.profiles (id) VALUES (1);
  INSERT INTO public.customers (id, profile_id) VALUES (1, 1), (2, 99);
`);

psqlFile(migration);
psqlFile(migration);

const tables = psql(`
  SELECT c.relname
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname LIKE 'fg\\_%' ESCAPE '\\'
  ORDER BY 1;
`).split('\n').filter(Boolean);
assert.ok(tables.length >= 18, tables.join(','));

for (const table of tables) {
  const forced = psql(`
    SELECT (c.relrowsecurity AND c.relforcerowsecurity)::text
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = '${table}';
  `);
  assert.equal(forced, 'true', table);
  for (const role of ['anon', 'authenticated', 'fleet_portal']) {
    fails(`SET ROLE ${role}; SELECT count(*) FROM public.${table};`, /permission denied/i);
  }
}

const functions = psql(`
  SELECT p.oid::regprocedure::text
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname LIKE 'fg\\_%' ESCAPE '\\'
  ORDER BY 1;
`).split('\n').filter(Boolean);
assert.ok(functions.length >= 6);
for (const fn of functions) {
  for (const role of ['anon', 'authenticated', 'fleet_portal']) {
    assert.equal(psql(`SELECT has_function_privilege('${role}', '${fn}', 'EXECUTE');`), 'f', `${role} ${fn}`);
  }
  assert.equal(psql(`SELECT has_function_privilege('service_role', '${fn}', 'EXECUTE');`), 't', fn);
  assert.equal(
    psql(`
      SELECT COUNT(*)
      FROM aclexplode((SELECT proacl FROM pg_proc WHERE oid = '${fn}'::regprocedure)) acl
      WHERE acl.grantee = 0 AND acl.privilege_type = 'EXECUTE';
    `),
    '0',
    fn
  );
  const config = psql(`SELECT prosecdef::text || ' ' || COALESCE(array_to_string(proconfig, ','), '') FROM pg_proc WHERE oid = '${fn}'::regprocedure;`);
  assert.match(config, /^true /);
  assert.match(config, /search_path=""/);
}

const sequences = psql(`
  SELECT c.relname
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'S' AND c.relname LIKE 'fg\\_%' ESCAPE '\\';
`).split('\n').filter(Boolean);
assert.ok(sequences.includes('fg_portal_attempts_id_seq'));
for (const sequence of sequences) {
  for (const role of ['anon', 'authenticated']) {
    for (const privilege of ['USAGE', 'SELECT', 'UPDATE']) {
      assert.equal(psql(`SELECT has_sequence_privilege('${role}', 'public.${sequence}', '${privilege}');`), 'f', `${role} ${sequence} ${privilege}`);
    }
  }
  assert.equal(psql(`SELECT has_sequence_privilege('service_role', 'public.${sequence}', 'USAGE');`), 't');
  fails(`SET ROLE anon; SELECT nextval('public.${sequence}');`, /permission denied/i);
}

psql(`SET ROLE service_role; INSERT INTO public.fg_vehicles (company_id, reg_no) VALUES (1, 'TEST 1') RETURNING id;`);
const vehicleId = psql(`SELECT id FROM public.fg_vehicles WHERE reg_no = 'TEST 1';`);
for (const table of ['fg_audit_log', 'fg_cost_entries', 'fg_odometer_readings', 'fg_vehicle_status_events', 'fg_position_events']) {
  if (table === 'fg_audit_log') {
    psql(`INSERT INTO public.fg_audit_log (company_id, actor_kind, actor_id, action, target_kind, target_id) VALUES (1, 'staff', 'u', 'test', 'vehicle', '${vehicleId}');`);
  } else if (table === 'fg_cost_entries') {
    psql(`INSERT INTO public.fg_cost_entries (company_id, vehicle_id, category, occurred_on, amount_cents) VALUES (1, '${vehicleId}', 'fuel', '2024-06-01', 1);`);
  } else if (table === 'fg_odometer_readings') {
    psql(`INSERT INTO public.fg_odometer_readings (company_id, vehicle_id, reading_km, read_at) VALUES (1, '${vehicleId}', 10, '2024-06-01');`);
  } else if (table === 'fg_vehicle_status_events') {
    psql(`INSERT INTO public.fg_vehicle_status_events (company_id, vehicle_id, status, from_at) VALUES (1, '${vehicleId}', 'active', '2024-06-01');`);
  } else {
    psql(`INSERT INTO public.fg_position_events (company_id, vehicle_id, at, lat, lng, source) VALUES (1, '${vehicleId}', '2024-06-01', 0, 0, 'manual');`);
  }
  const id = psql(`SELECT id FROM public.${table} ORDER BY created_at DESC LIMIT 1;`);
  fails(`UPDATE public.${table} SET company_id = 1 WHERE id = '${id}';`, /fg_append_only/);
  fails(`DELETE FROM public.${table} WHERE id = '${id}';`, /fg_append_only/);
}

assert.match(psql(`SELECT public.fg_portal_call('driver', 'abc', 'ping', '{}'::jsonb)::text;`), /ping/);
const deniedA = psql(`SELECT public.fg_portal_call(NULL, NULL, 'nope', NULL)::text;`);
const deniedB = psql(`SELECT public.fg_portal_call('tracking', 'zzz', 'other', '{"a":1}'::jsonb)::text;`);
assert.equal(deniedA, deniedB);
assert.match(deniedA, /denied/);

const otpId = psql(`INSERT INTO public.fg_portal_otps (company_id, code_hash, expires_at) VALUES (1, 'hash', pg_catalog.now() + interval '1 hour') RETURNING id;`);
await Promise.all(
  Array.from({ length: 5 }, () => psqlAsync(`SELECT public.fg_portal_register_failure(1, 'email', 'otp-key', '${otpId}'::uuid);`))
);
assert.equal(psql(`SELECT failed_attempts::text || ' ' || (used_at IS NOT NULL)::text FROM public.fg_portal_otps WHERE id = '${otpId}';`), '5 true');

for (let i = 0; i < 10; i += 1) psql(`SELECT public.fg_portal_register_failure(1, 'email', 'mail-key', NULL);`);
assert.equal(psql(`SELECT public.fg_portal_is_throttled(1, 'email', 'mail-key');`), 'f');
psql(`SELECT public.fg_portal_register_failure(1, 'email', 'mail-key', NULL);`);
assert.equal(psql(`SELECT public.fg_portal_is_throttled(1, 'email', 'mail-key');`), 't');

for (let i = 0; i < 51; i += 1) psql(`SELECT public.fg_portal_register_failure(1, 'ip', 'ws-${i}', NULL);`);
assert.equal(psql(`SELECT public.fg_portal_is_throttled(1, 'ip', 'ws-0');`), 't');
assert.equal(psql(`SELECT public.fg_portal_is_throttled(NULL, 'email', 'x');`), 't');
assert.equal(psql(`SELECT public.fg_portal_is_throttled(1, ' ', 'x');`), 't');
fails(`SELECT public.fg_portal_register_failure(NULL, 'email', 'x', NULL);`, /fg_portal_register_failure_closed/);

const numbers = await Promise.all(Array.from({ length: 8 }, () => psqlAsync(`SELECT public.fg_next_number(1, 'race');`)));
assert.equal(new Set(numbers).size, 8);

psql(`INSERT INTO public.fg_cost_profiles (company_id, vehicle_id, effective_from) VALUES (1, '${vehicleId}', '2024-06-01');`);
fails(
  `INSERT INTO public.fg_cost_profiles (company_id, vehicle_id, effective_from) VALUES (1, '${vehicleId}', '2024-06-15');`,
  /fg_cost_profiles_no_overlap|exclusion|conflicting/i
);
psql(`INSERT INTO public.fg_overhead_pools (company_id, period_month, amount_cents) VALUES (1, '2024-06-01', 10);`);
fails(
  `INSERT INTO public.fg_overhead_pools (company_id, period_month, amount_cents) VALUES (1, '2024-06-01', 12);`,
  /fg_overhead_month|duplicate key/i
);

assert.equal(
  psql(`SELECT column_default FROM information_schema.columns WHERE table_name = 'fg_workspaces' AND column_name = 'real_data_enabled';`),
  'false'
);
assert.equal(
  psql(`SELECT count(*) FROM information_schema.columns WHERE table_name = 'fg_workspaces' AND column_name ILIKE '%token%';`),
  '0'
);
assert.equal(
  psql(`
    SELECT count(*) FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name LIKE 'fg\\_%' ESCAPE '\\'
      AND column_name ~* '(id_number|id_no|passport|licence_no|license_no|licence_number|license_number)';
  `),
  '0'
);

console.log('brief114-db.test.ts ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
