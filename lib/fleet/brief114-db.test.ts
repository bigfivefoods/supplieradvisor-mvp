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
import { emptyFleetBook } from './empty-book';
import { fleetDiff, stopRowsConflict } from './fleetgraph-db';
import { applyFleetOp, type OpContext } from './ops';
import type { FleetBook } from './types';

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

fails(`DELETE FROM public.profiles WHERE id = 1;`, /fg_append_only/);
fails(`TRUNCATE public.fg_audit_log;`, /fg_append_only/);
fails(`SET ROLE service_role; TRUNCATE public.fg_audit_log;`, /permission denied/i);
fails(
  `BEGIN; SELECT set_config('fg.erasing', 'on', true); UPDATE public.fg_audit_log SET action = 'nope' WHERE company_id = 1; COMMIT;`,
  /fg_append_only/
);

psql(`INSERT INTO public.profiles (id) VALUES (88002);`);
const eraseVehicle = psql(`INSERT INTO public.fg_vehicles (company_id, reg_no) VALUES (88002, 'ERASE 1') RETURNING id;`);
psql(`INSERT INTO public.fg_cost_entries (company_id, vehicle_id, category, occurred_on, amount_cents) VALUES (88002, '${eraseVehicle}', 'toll', '2024-06-01', 5);`);
psql(`INSERT INTO public.fg_audit_log (company_id, actor_kind, actor_id, action, target_kind, target_id) VALUES (88002, 'staff', 'u', 'keep', 'vehicle', '${eraseVehicle}');`);
psql(`SELECT public.fg_erase_company(88002);`);
assert.equal(psql(`SELECT count(*) FROM public.profiles WHERE id = 88002;`), '1');
assert.equal(psql(`SELECT count(*) FROM public.fg_vehicles WHERE company_id = 88002;`), '0');
assert.equal(psql(`SELECT count(*) FROM public.fg_cost_entries WHERE company_id = 88002;`), '0');
assert.equal(psql(`SELECT count(*) FROM public.fg_audit_log WHERE company_id = 88002;`), '0');
fails(`BEGIN; SELECT set_config('fg.erasing', 'on', true); DELETE FROM public.fg_audit_log WHERE company_id = 1; COMMIT;`, /fg_append_only/);
fails(`BEGIN; SET ROLE service_role; SELECT set_config('fg.erase_token', 'forged-token-that-is-long-enough-for-the-check', true); DELETE FROM public.fg_audit_log WHERE company_id = 1; COMMIT;`, /fg_append_only/);
fails(`SET ROLE service_role; UPDATE public.fg_erase_guard SET token = 'forged';`, /permission denied/i);
fails(`SET ROLE service_role; ALTER TABLE public.fg_audit_log DISABLE TRIGGER USER;`, /permission denied|must be owner/i);
psql(`INSERT INTO public.profiles (id) VALUES (88004);`);
const otherVehicle = psql(`INSERT INTO public.fg_vehicles (company_id, reg_no) VALUES (1, 'STAY 1') RETURNING id;`);
psql(`INSERT INTO public.fg_audit_log (company_id, actor_kind, actor_id, action, target_kind, target_id) VALUES (88004, 'staff', 'u', 'hold', 'vehicle', '${otherVehicle}');`);
const heldErase = psqlAsync(`BEGIN; SELECT public.fg_erase_company(88004); SELECT pg_sleep(2); COMMIT;`);
await new Promise((resolvePromise) => setTimeout(resolvePromise, 300));
const during = await psqlAsync(`SET statement_timeout = '1500ms'; INSERT INTO public.fg_audit_log (company_id, actor_kind, actor_id, action, target_kind, target_id) VALUES (1, 'staff', 'other', 'during-erase', 'vehicle', '${otherVehicle}') RETURNING action;`);
assert.equal(during, 'during-erase');
await heldErase;
fails(`SELECT public.fg_erase_company(NULL);`, /fg_erase_closed/);

psql(`INSERT INTO public.profiles (id) VALUES (88003);`);
fails(
  `INSERT INTO public.fg_odometer_readings (company_id, vehicle_id, reading_km, read_at) VALUES (88003, '${vehicleId}', 1, '2024-06-02');`,
  /fg_odometer_company_vehicle|violates foreign key/i
);

const tokenVehicle = vehicleId;
void tokenVehicle;
psql(`INSERT INTO public.fg_portal_invites (company_id, portal, token_hash, token_hint, expires_at) VALUES (1, 'driver', 'hash-one', 'abcd', pg_catalog.now() + interval '1 day');`);
fails(
  `INSERT INTO public.fg_portal_invites (company_id, portal, token_hash, token_hint, expires_at) VALUES (1, 'driver', 'hash-one', 'abcd', pg_catalog.now() + interval '1 day');`,
  /fg_portal_invites_token_hash_key|duplicate key/i
);

const reversible = psql(`INSERT INTO public.fg_cost_entries (company_id, vehicle_id, category, occurred_on, amount_cents) VALUES (1, '${vehicleId}', 'toll', '2024-06-03', 9) RETURNING id;`);
const reversal = psql(`INSERT INTO public.fg_cost_entries (company_id, vehicle_id, category, occurred_on, amount_cents, reverses_id) VALUES (1, '${vehicleId}', 'toll', '2024-06-03', -9, '${reversible}') RETURNING id;`);
fails(
  `INSERT INTO public.fg_cost_entries (company_id, vehicle_id, category, occurred_on, amount_cents, reverses_id) VALUES (1, '${vehicleId}', 'toll', '2024-06-03', -9, '${reversible}');`,
  /fg_cost_entries_one_reversal|duplicate key/i
);
fails(
  `INSERT INTO public.fg_cost_entries (company_id, vehicle_id, category, occurred_on, amount_cents, reverses_id) VALUES (1, '${vehicleId}', 'toll', '2024-06-03', 9, '${reversal}');`,
  /fg_reverse_closed/
);

psql(`
  INSERT INTO public.fg_cost_entries (company_id, vehicle_id, category, occurred_on, amount_cents)
  SELECT 1, '${vehicleId}', 'toll', '2024-06-04', g
  FROM generate_series(1, 1001) AS g;
`);
assert.equal(Number(psql(`SELECT count(*) FROM public.fg_cost_entries WHERE company_id = 1 AND occurred_on = '2024-06-04';`)) > 1000, true);

const atomicReg = 'ATOMIC 1';
fails(
  `SELECT public.fg_commit_diff(1, jsonb_build_object(
    'company_id', 1,
    'upserts', jsonb_build_object('fg_vehicles', jsonb_build_array(jsonb_build_object(
      'id', gen_random_uuid(),
      'company_id', 1,
      'reg_no', '${atomicReg}',
      'kind', 'van',
      'ownership', 'owned',
      'status', 'active',
      'updated_at', pg_catalog.now()
    ))),
    'inserts', jsonb_build_object('fg_audit_log', jsonb_build_array(jsonb_build_object(
      'id', gen_random_uuid(),
      'company_id', 1,
      'actor_kind', 'nope',
      'actor_id', 'u',
      'action', 'bad',
      'target_kind', 'vehicle',
      'target_id', 'x',
      'at', pg_catalog.now()
    )))
  ));`,
  /fg_audit_actor|check constraint/i
);
assert.equal(psql(`SELECT count(*) FROM public.fg_vehicles WHERE reg_no = '${atomicReg}';`), '0');

const goodId = psql(`SELECT gen_random_uuid();`);
const auditId = psql(`SELECT gen_random_uuid();`);
psql(`SELECT public.fg_commit_diff(1, jsonb_build_object(
  'company_id', 1,
  'upserts', jsonb_build_object('fg_vehicles', jsonb_build_array(jsonb_build_object(
    'id', '${goodId}',
    'company_id', 1,
    'reg_no', 'ATOMIC OK',
    'kind', 'van',
    'ownership', 'owned',
    'status', 'active',
    'updated_at', '2024-07-02T00:00:00Z'
  ))),
  'inserts', jsonb_build_object('fg_audit_log', jsonb_build_array(jsonb_build_object(
    'id', '${auditId}',
    'company_id', 1,
    'actor_kind', 'staff',
    'actor_id', 'u',
    'action', 'vehicle.upsert',
    'target_kind', 'vehicle',
    'target_id', '${goodId}',
    'at', '2024-07-02T00:00:00Z'
  )))
));`);
assert.equal(psql(`SELECT count(*) FROM public.fg_vehicles WHERE id = '${goodId}';`), '1');
assert.equal(psql(`SELECT count(*) FROM public.fg_audit_log WHERE id = '${auditId}';`), '1');

psql(`UPDATE public.fg_vehicles SET archived_at = pg_catalog.now() WHERE id = '${goodId}';`);
psql(`INSERT INTO public.fg_vehicles (company_id, reg_no) VALUES (1, 'ATOMIC OK');`);
assert.equal(psql(`SELECT count(*) FROM public.fg_vehicles WHERE company_id = 1 AND lower(reg_no) = 'atomic ok' AND archived_at IS NULL;`), '1');
fails(`INSERT INTO public.fg_vehicles (company_id, reg_no) VALUES (1, 'atomic ok');`, /fg_vehicles_reg_unique|duplicate key/i);

const jobId = psql(`SELECT gen_random_uuid();`);
const stopA = psql(`SELECT gen_random_uuid();`);
const stopB = psql(`SELECT gen_random_uuid();`);
const stopC = psql(`SELECT gen_random_uuid();`);
psql(`INSERT INTO public.fg_jobs (id, company_id, reference, status, updated_at) VALUES ('${jobId}', 1, 'JOB-STOP', 'draft', '2024-07-02T00:00:00Z');`);
psql(`INSERT INTO public.fg_job_stops (id, company_id, job_id, seq, kind, place_name, updated_at) VALUES
  ('${stopA}', 1, '${jobId}', 1, 'pickup', 'A', '2024-07-02T00:00:00Z'),
  ('${stopB}', 1, '${jobId}', 2, 'delivery', 'B', '2024-07-02T00:00:00Z');`);
psql(`SELECT public.fg_commit_diff(1, jsonb_build_object(
  'company_id', 1,
  'delete_stop_ids', jsonb_build_array('${stopB}'),
  'upserts', jsonb_build_object('fg_job_stops', jsonb_build_array(
    jsonb_build_object('id', '${stopA}', 'company_id', 1, 'job_id', '${jobId}', 'seq', 2, 'kind', 'delivery', 'place_name', 'A', 'updated_at', '2024-07-03T00:00:00Z', 'previous_updated_at', '2024-07-02T00:00:00Z'),
    jsonb_build_object('id', '${stopC}', 'company_id', 1, 'job_id', '${jobId}', 'seq', 1, 'kind', 'pickup', 'place_name', 'C', 'updated_at', '2024-07-03T00:00:00Z')
  ))
));`);
assert.equal(psql(`SELECT seq::text || ':' || place_name FROM public.fg_job_stops WHERE job_id = '${jobId}' ORDER BY seq;`), '1:C\n2:A');
psql(`SELECT public.fg_commit_diff(1, jsonb_build_object(
  'company_id', 1,
  'upserts', jsonb_build_object('fg_job_stops', jsonb_build_array(
    jsonb_build_object('id', '${stopC}', 'company_id', 1, 'job_id', '${jobId}', 'seq', 2, 'kind', 'delivery', 'place_name', 'C', 'updated_at', '2024-07-04T00:00:00Z', 'previous_updated_at', '2024-07-03T00:00:00Z'),
    jsonb_build_object('id', '${stopA}', 'company_id', 1, 'job_id', '${jobId}', 'seq', 1, 'kind', 'pickup', 'place_name', 'A', 'updated_at', '2024-07-04T00:00:00Z', 'previous_updated_at', '2024-07-03T00:00:00Z')
  ))
));`);
assert.equal(psql(`SELECT place_name FROM public.fg_job_stops WHERE job_id = '${jobId}' ORDER BY seq;`), 'A\nC');
assert.match(psql(`SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'fg_jobs_company_vehicle';`), /ON DELETE SET NULL \(vehicle_id\)/);
assert.match(psql(`SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'fg_jobs_company_driver';`), /ON DELETE SET NULL \(driver_id\)/);
const linkVehicle = psql(`INSERT INTO public.fg_vehicles (company_id, reg_no) VALUES (1, 'LINK 1') RETURNING id;`);
psql(`UPDATE public.fg_jobs SET vehicle_id = '${linkVehicle}' WHERE id = '${jobId}';`);
psql(`DELETE FROM public.fg_vehicles WHERE id = '${linkVehicle}';`);
assert.equal(psql(`SELECT company_id::text || ':' || COALESCE(vehicle_id::text, 'null') FROM public.fg_jobs WHERE id = '${jobId}';`), '1:null');

fails(
  `INSERT INTO public.fg_jobs (company_id, reference, customer_id) VALUES (1, 'CROSS', 2);`,
  /fg_jobs_company_customer|foreign key/i
);
fails(
  `INSERT INTO public.fg_job_stops (company_id, job_id, seq, kind) VALUES (88002, '${jobId}', 1, 'via');`,
  /fg_job_stops_company_job|foreign key/i
);
fails(
  `INSERT INTO public.fg_cost_entries (company_id, vehicle_id, category, occurred_on, amount_cents, reverses_id) VALUES (1, '${vehicleId}', 'toll', '2024-06-05', -1, gen_random_uuid());`,
  /fg_cost_entries_reverses|foreign key/i
);

const stopRow = psql(`SELECT job_id::text || '|' || company_id::text FROM public.fg_job_stops WHERE id = '${stopA}';`).split('|');
assert.equal(stopRowsConflict([{ id: stopA, job_id: stopRow[0], company_id: Number(stopRow[1]) }], 1, stopRow[0]), false);
assert.equal(stopRowsConflict([{ id: stopA, job_id: stopRow[0], company_id: Number(stopRow[1]) }], 1, jobId === stopRow[0] ? '00000000-0000-4000-8000-000000000099' : jobId), true);
assert.equal(stopRowsConflict([{ id: stopA, job_id: stopRow[0], company_id: Number(stopRow[1]) }], 2, stopRow[0]), true);

const profileCtx: OpContext = {
  role: 'owner',
  actorId: 'db-profile',
  now: '2024-07-02T01:00:00.000Z',
  companyId: 1,
  enforceRealData: false,
};
function commitBook(before: FleetBook, after: FleetBook) {
  const json = JSON.stringify(fleetDiff(before, after));
  if (json.includes('$diff$')) throw new Error('diff quote');
  psql(`SELECT public.fg_commit_diff(${after.workspace.company_id}, $diff$${json}$diff$::jsonb);`);
}
let profileBook = emptyFleetBook(1, profileCtx.now);
const profileVehicle = applyFleetOp(profileBook, { op: 'vehicle.upsert', payload: { reg_no: 'REPLACE 1', kind: 'rigid', ownership: 'owned' } }, profileCtx);
assert.equal(profileVehicle.ok, true);
if (!profileVehicle.ok) throw new Error('profile vehicle');
commitBook(profileBook, profileVehicle.book);
profileBook = profileVehicle.book;
const profileVehicleId = profileBook.vehicles[0]?.id;
if (!profileVehicleId) throw new Error('profile vehicle id');
const auditsBefore = Number(psql(`SELECT count(*) FROM public.fg_audit_log WHERE company_id = 1 AND action = 'cost_profile.set';`));
const firstProfile = applyFleetOp(profileBook, { op: 'cost_profile.set', payload: { vehicle_id: profileVehicleId, effective_from: '2024-06-01', finance_monthly_cents: 100 } }, profileCtx);
assert.equal(firstProfile.ok, true);
if (!firstProfile.ok) throw new Error('first profile');
commitBook(profileBook, firstProfile.book);
const secondProfile = applyFleetOp(firstProfile.book, { op: 'cost_profile.set', payload: { vehicle_id: profileVehicleId, effective_from: '2024-06-01', finance_monthly_cents: 80 } }, profileCtx);
assert.equal(secondProfile.ok, true);
if (!secondProfile.ok) throw new Error('second profile');
commitBook(firstProfile.book, secondProfile.book);
const thirdProfile = applyFleetOp(secondProfile.book, { op: 'cost_profile.set', payload: { vehicle_id: profileVehicleId, effective_from: '2024-08-01', finance_monthly_cents: 40 } }, profileCtx);
assert.equal(thirdProfile.ok, true);
if (!thirdProfile.ok) throw new Error('third profile');
commitBook(secondProfile.book, thirdProfile.book);
assert.equal(
  psql(`SELECT effective_from::text || '|' || COALESCE(effective_to::text, 'null') || '|' || finance_monthly_cents::text FROM public.fg_cost_profiles WHERE vehicle_id = '${profileVehicleId}' ORDER BY effective_from;`),
  '2024-06-01|2024-08-01|80\n2024-08-01|null|40'
);
assert.equal(psql(`SELECT count(*) FROM public.fg_cost_profiles WHERE vehicle_id = '${profileVehicleId}' AND effective_to IS NOT DISTINCT FROM effective_from;`), '0');
assert.equal(Number(psql(`SELECT count(*) FROM public.fg_audit_log WHERE company_id = 1 AND action = 'cost_profile.set';`)) - auditsBefore, 3);
fails(
  `INSERT INTO public.fg_cost_profiles (company_id, vehicle_id, effective_from, effective_to, finance_monthly_cents) VALUES (1, '${profileVehicleId}', '2024-09-01', '2024-09-01', 1);`,
  /fg_cost_profiles_range|check constraint/i
);
fails(
  `INSERT INTO public.fg_cost_profiles (company_id, vehicle_id, effective_from, finance_monthly_cents) VALUES (1, '${profileVehicleId}', '2024-07-01', 1);`,
  /fg_cost_profiles_no_overlap|exclusion|conflicting/i
);

console.log('brief114-db.test.ts ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
