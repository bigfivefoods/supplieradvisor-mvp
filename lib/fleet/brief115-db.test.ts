/**
 * FleetAdvisor® Brief 115 Postgres contract.
 * Apply 20261019 then 20261020 twice after Supabase-like default privileges.
 *
 * Run:
 *   FLEET_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/fleetgraph \
 *     npx --yes tsx lib/fleet/brief115-db.test.ts
 */
import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const url = process.env.FLEET_DATABASE_URL;
if (!url) throw new Error('FLEET_DATABASE_URL is required');

const migrationA = resolve('supabase/migrations/20261019_fleetgraph_a.sql');
const migrationB = resolve('supabase/migrations/20261020_fleetgraph_b.sql');

function psql(statement: string, databaseUrl = url!): string {
  return execFileSync('psql', [databaseUrl, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-t', '-A'], {
    encoding: 'utf8',
    input: statement,
  }).trim();
}

function psqlFile(path: string, databaseUrl = url!) {
  execFileSync('psql', [databaseUrl, '-X', '-v', 'ON_ERROR_STOP=1', '-f', path], {
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
  assert.fail(`expected Postgres to reject: ${statement.slice(0, 160)}`);
}

function dbUrl(name: string): string {
  return url!.replace(/\/[^/?]+(\?.*)?$/, `/${name}$1`);
}

function localImportsStayLocal(entry: string) {
  const seen = new Set<string>();
  const pending = [resolve(entry)];
  while (pending.length) {
    const file = pending.pop();
    if (!file || seen.has(file)) continue;
    seen.add(file);
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
      const spec = match[1];
      if (spec.startsWith('node:')) continue;
      if (!spec.startsWith('.')) throw new Error(`${file} imports ${spec}. The fleet Postgres job has no node_modules.`);
      const base = resolve(file, '..', spec);
      const next = [base, `${base}.ts`, `${base}.tsx`].find((candidate) => {
        try {
          readFileSync(candidate);
          return true;
        } catch {
          return false;
        }
      });
      if (next) pending.push(next);
    }
  }
}

function extensionSchema(databaseUrl = url!): string {
  return psql(
    `SELECT n.nspname FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace WHERE e.extname = 'btree_gist';`,
    databaseUrl
  );
}

function publicExtensionObjects(databaseUrl = url!): string {
  return psql(
    `
    SELECT count(*) FROM (
      SELECT p.oid
      FROM pg_proc p
      JOIN pg_depend d ON d.objid = p.oid AND d.deptype = 'e'
      JOIN pg_extension e ON e.oid = d.refobjid
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE e.extname = 'btree_gist' AND n.nspname = 'public'
      UNION ALL
      SELECT o.oid
      FROM pg_opclass o
      JOIN pg_depend d ON d.objid = o.oid AND d.deptype = 'e'
      JOIN pg_extension e ON e.oid = d.refobjid
      JOIN pg_namespace n ON n.oid = o.opcnamespace
      WHERE e.extname = 'btree_gist' AND n.nspname = 'public'
      UNION ALL
      SELECT o.oid
      FROM pg_operator o
      JOIN pg_depend d ON d.objid = o.oid AND d.deptype = 'e'
      JOIN pg_extension e ON e.oid = d.refobjid
      JOIN pg_namespace n ON n.oid = o.oprnamespace
      WHERE e.extname = 'btree_gist' AND n.nspname = 'public'
      UNION ALL
      SELECT o.oid
      FROM pg_opfamily o
      JOIN pg_depend d ON d.objid = o.oid AND d.deptype = 'e'
      JOIN pg_extension e ON e.oid = d.refobjid
      JOIN pg_namespace n ON n.oid = o.opfnamespace
      WHERE e.extname = 'btree_gist' AND n.nspname = 'public'
    ) objects;
    `,
    databaseUrl
  );
}

const stubSql = `
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
`;

async function main() {
  localImportsStayLocal('lib/fleet/brief115-db.test.ts');
  psql(`
    DROP SCHEMA IF EXISTS public CASCADE;
    CREATE SCHEMA public;
    GRANT USAGE, CREATE ON SCHEMA public TO public;
    ${stubSql}
  `);

  psqlFile(migrationA);
  psqlFile(migrationB);
  psqlFile(migrationB);

  assert.equal(extensionSchema(), 'extensions');
  assert.equal(publicExtensionObjects(), '0');

  const tables = psql(`
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname LIKE 'fg\\_%' ESCAPE '\\'
    ORDER BY 1;
  `).split('\n').filter(Boolean);
  for (const name of ['fg_reminders', 'fg_reminder_log', 'fg_trailer_links']) {
    assert.ok(tables.includes(name), name);
  }

  for (const table of tables) {
    const forced = psql(`
      SELECT (c.relrowsecurity AND c.relforcerowsecurity)::text
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = '${table}';
    `);
    assert.equal(forced, 'true', table);
    if (table !== 'fg_erase_guard') {
      const policies = psql(`
        SELECT string_agg(polname, ',' ORDER BY polname)
        FROM pg_policy p
        JOIN pg_class c ON c.oid = p.polrelid
        WHERE c.relname = '${table}';
      `);
      assert.match(policies, /sa_deny_anon/);
      assert.match(policies, /sa_deny_authenticated/);
    }
    for (const role of ['public', 'anon', 'authenticated', 'fleet_portal']) {
      for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) {
        assert.equal(
          psql(`SELECT has_table_privilege('${role}', 'public.${table}', '${privilege}');`),
          'f',
          `${role} ${table} ${privilege}`
        );
      }
    }
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
  for (const name of ['fg_claim_reminder', 'fg_commit_b', 'fg_import_commit', 'fg_trailer_link_guard']) {
    assert.ok(functions.some((fn) => fn.startsWith(`fg_${name.replace('fg_', '')}(`) || fn.includes(name)), functions.join('\n'));
  }
  assert.ok(functions.some((fn) => fn.startsWith('fg_claim_reminder')));
  assert.ok(functions.some((fn) => fn.startsWith('fg_commit_b')));
  assert.ok(functions.some((fn) => fn.startsWith('fg_import_commit')));
  for (const fn of functions) {
    for (const role of ['anon', 'authenticated', 'fleet_portal']) {
      assert.equal(psql(`SELECT has_function_privilege('${role}', '${fn}', 'EXECUTE');`), 'f', `${role} ${fn}`);
    }
    assert.equal(psql(`SELECT has_function_privilege('public', '${fn}', 'EXECUTE');`), 'f', fn);
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
  for (const sequence of sequences) {
    for (const role of ['public', 'anon', 'authenticated', 'fleet_portal']) {
      for (const privilege of ['USAGE', 'SELECT', 'UPDATE']) {
        assert.equal(
          psql(`SELECT has_sequence_privilege('${role}', 'public.${sequence}', '${privilege}');`),
          'f',
          `${role} ${sequence} ${privilege}`
        );
      }
    }
  }

  const appendOnly = psql(`
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_trigger t ON t.tgrelid = c.oid AND NOT t.tgisinternal
    JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE n.nspname = 'public' AND p.proname = 'fg_forbid_truncate'
    ORDER BY 1;
  `).split('\n').filter(Boolean);
  assert.ok(appendOnly.includes('fg_reminder_log'));
  assert.ok(appendOnly.includes('fg_audit_log'));
  for (const table of appendOnly) {
    assert.equal(psql(`SELECT has_table_privilege('service_role', 'public.${table}', 'TRUNCATE');`), 'f', table);
    assert.equal(psql(`SELECT has_table_privilege('public', 'public.${table}', 'TRUNCATE');`), 'f', table);
  }

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

  const vehicleId = psql(`INSERT INTO public.fg_vehicles (company_id, reg_no, kind) VALUES (1, 'TRUCK 1', 'rigid') RETURNING id;`);
  const trailerId = psql(`INSERT INTO public.fg_vehicles (company_id, reg_no, kind) VALUES (1, 'TRAILER 1', 'trailer') RETURNING id;`);
  const otherTrailer = psql(`INSERT INTO public.fg_vehicles (company_id, reg_no, kind) VALUES (1, 'TRAILER 2', 'trailer') RETURNING id;`);
  psql(`INSERT INTO public.fg_cost_profiles (company_id, vehicle_id, effective_from, effective_to) VALUES (1, '${vehicleId}', '2024-01-01', '2024-06-01');`);
  fails(
    `INSERT INTO public.fg_cost_profiles (company_id, vehicle_id, effective_from) VALUES (1, '${vehicleId}', '2024-03-01');`,
    /23P01|fg_cost_profiles_no_overlap|exclusion|conflicting/i
  );
  psql(`INSERT INTO public.fg_cost_profiles (company_id, vehicle_id, effective_from) VALUES (1, '${vehicleId}', '2024-06-01');`);

  psql(`INSERT INTO public.fg_trailer_links (company_id, truck_id, trailer_id, from_on, to_on) VALUES (1, '${vehicleId}', '${trailerId}', '2024-01-01', '2024-01-31');`);
  fails(
    `INSERT INTO public.fg_trailer_links (company_id, truck_id, trailer_id, from_on, to_on) VALUES (1, '${vehicleId}', '${trailerId}', '2024-01-31', '2024-02-28');`,
    /23P01|fg_trailer_links_no_overlap|exclusion|conflicting/i
  );
  psql(`INSERT INTO public.fg_trailer_links (company_id, truck_id, trailer_id, from_on, to_on) VALUES (1, '${vehicleId}', '${trailerId}', '2024-02-01', '2024-02-28');`);
  psql(`INSERT INTO public.fg_trailer_links (company_id, truck_id, trailer_id, from_on, to_on) VALUES (1, '${vehicleId}', '${otherTrailer}', '2024-01-01', '2024-03-01');`);
  fails(
    `INSERT INTO public.fg_trailer_links (company_id, truck_id, trailer_id, from_on) VALUES (1, '${trailerId}', '${otherTrailer}', '2024-04-01');`,
    /fg_trailer_kind/
  );
  psql(`INSERT INTO public.profiles (id) VALUES (2);`);
  const foreignTruck = psql(`INSERT INTO public.fg_vehicles (company_id, reg_no, kind) VALUES (2, 'OTHER 1', 'rigid') RETURNING id;`);
  fails(
    `INSERT INTO public.fg_trailer_links (company_id, truck_id, trailer_id, from_on) VALUES (1, '${foreignTruck}', '${trailerId}', '2024-05-01');`,
    /fg_trailer_company/
  );

  psql(`INSERT INTO public.fg_vehicles (company_id, reg_no, source_system, source_id) VALUES (1, 'SHIP 1', 'ship', 'same-ship');`);
  fails(
    `INSERT INTO public.fg_vehicles (company_id, reg_no, source_system, source_id) VALUES (1, 'SHIP 2', 'ship', 'same-ship');`,
    /fg_vehicles_source_unique|duplicate key/i
  );

  const ruleId = psql(`SELECT gen_random_uuid();`);
  const itemId = psql(`SELECT gen_random_uuid();`);
  const subjectId = vehicleId;
  const winners = await Promise.all(
    Array.from({ length: 8 }, () =>
      psqlAsync(
        `SELECT public.fg_claim_reminder(1, '${ruleId}', '${itemId}', 'vehicle', '${subjectId}', '2027-03-12', 7, 'email', 'member-1');`
      )
    )
  );
  assert.equal(winners.filter((value) => value === 't').length, 1);
  assert.equal(
    psql(`SELECT count(*) FROM public.fg_reminder_log WHERE item_id = '${itemId}' AND status = 'claimed' AND threshold_days = 7;`),
    '1'
  );
  assert.equal(
    psql(`SELECT public.fg_claim_reminder(1, '${ruleId}', '${itemId}', 'vehicle', '${subjectId}', '2027-04-12', 7, 'email', 'member-1');`),
    't'
  );
  fails(`SELECT public.fg_claim_reminder(NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);`, /fg_claim_closed/);
  fails(`SELECT public.fg_claim_reminder(1, '${ruleId}', '${itemId}', ' ', '${subjectId}', '2027-03-12', 7, 'email', 'member-1');`, /fg_claim_closed/);
  fails(
    `INSERT INTO public.fg_reminder_log (company_id, rule_id, item_id, subject_kind, subject_id, expires_on, threshold_days, channel, recipient_key, status) VALUES (1, '${ruleId}', '${itemId}', 'vehicle', '${subjectId}', '2027-05-01', 0, 'email', 'person@example.com', 'sent');`,
    /fg_reminder_log_recipient|check constraint/i
  );

  const claimedId = psql(`SELECT id FROM public.fg_reminder_log WHERE status = 'claimed' LIMIT 1;`);
  fails(`UPDATE public.fg_reminder_log SET status = 'sent' WHERE id = '${claimedId}';`, /fg_append_only/);
  fails(`DELETE FROM public.fg_reminder_log WHERE id = '${claimedId}';`, /fg_append_only/);
  fails(`TRUNCATE public.fg_reminder_log;`, /fg_append_only/);
  fails(`SET ROLE service_role; DELETE FROM public.fg_reminder_log WHERE id = '${claimedId}';`, /fg_append_only|permission denied/i);
  fails(`SET ROLE service_role; TRUNCATE public.fg_reminder_log;`, /permission denied/i);

  const reminderId = psql(`SELECT gen_random_uuid();`);
  psql(`SELECT public.fg_commit_b(1, jsonb_build_object(
    'company_id', 1,
    'upserts', jsonb_build_object('fg_reminders', jsonb_build_array(jsonb_build_object(
      'id', '${reminderId}',
      'company_id', 1,
      'scope_kind', 'all',
      'thresholds_days', ARRAY[30,14,7,0],
      'channels', ARRAY['email']::text[],
      'recipient_member_ids', ARRAY['member-1']::text[],
      'enabled', false,
      'updated_at', '2024-07-02T00:00:00Z'
    )))
  ));`);
  const storedAt = psql(`SELECT updated_at FROM public.fg_reminders WHERE id = '${reminderId}';`);
  fails(
    `SELECT public.fg_commit_b(1, jsonb_build_object(
      'company_id', 1,
      'upserts', jsonb_build_object('fg_reminders', jsonb_build_array(jsonb_build_object(
        'id', '${reminderId}',
        'company_id', 1,
        'scope_kind', 'all',
        'thresholds_days', ARRAY[14,7,0],
        'channels', ARRAY['email']::text[],
        'recipient_member_ids', ARRAY['member-1']::text[],
        'enabled', true,
        'updated_at', '2024-08-01T00:00:00Z',
        'previous_updated_at', '1999-01-01T00:00:00Z'
      )))
    ));`,
    /40001|fg_conflict/
  );
  assert.equal(psql(`SELECT enabled::text FROM public.fg_reminders WHERE id = '${reminderId}';`), 'false');
  psql(`SELECT public.fg_commit_b(1, jsonb_build_object(
    'company_id', 1,
    'upserts', jsonb_build_object('fg_reminders', jsonb_build_array(jsonb_build_object(
      'id', '${reminderId}',
      'company_id', 1,
      'scope_kind', 'all',
      'thresholds_days', ARRAY[14,7,0],
      'channels', ARRAY['email']::text[],
      'recipient_member_ids', ARRAY['member-1']::text[],
      'enabled', true,
      'updated_at', '2024-08-01T00:00:00Z',
      'previous_updated_at', '${storedAt}'
    )))
  ));`);
  assert.equal(psql(`SELECT enabled::text FROM public.fg_reminders WHERE id = '${reminderId}';`), 'true');

  const importVehicle = psql(`SELECT gen_random_uuid();`);
  const firstImport = psql(`SELECT public.fg_import_commit(1, jsonb_build_object(
    'kind', 'vehicles_csv',
    'source_hash', 'hash-one',
    'source_label', 'sample.csv',
    'created_by', 'owner-1',
    'row_counts', jsonb_build_object('rows', 1)
  ), jsonb_build_object(
    'company_id', 1,
    'upserts', jsonb_build_object('fg_vehicles', jsonb_build_array(jsonb_build_object(
      'id', '${importVehicle}',
      'company_id', 1,
      'reg_no', 'IMPORT 1',
      'kind', 'van',
      'ownership', 'owned',
      'status', 'active',
      'updated_at', '2024-07-02T00:00:00Z'
    )))
  ))::text;`);
  assert.match(firstImport, /already_imported.: false|already_imported": false/);
  assert.equal(psql(`SELECT count(*) FROM public.fg_vehicles WHERE id = '${importVehicle}';`), '1');
  assert.equal(psql(`SELECT count(*) FROM public.fg_audit_log WHERE action = 'import.commit' AND company_id = 1;`), '1');
  const secondImport = psql(`SELECT public.fg_import_commit(1, jsonb_build_object(
    'kind', 'vehicles_csv',
    'source_hash', 'hash-one',
    'source_label', 'sample.csv',
    'created_by', 'owner-1'
  ), jsonb_build_object(
    'company_id', 1,
    'upserts', jsonb_build_object('fg_vehicles', jsonb_build_array(jsonb_build_object(
      'id', gen_random_uuid(),
      'company_id', 1,
      'reg_no', 'IMPORT DUP',
      'kind', 'van',
      'updated_at', '2024-07-03T00:00:00Z'
    )))
  ))::text;`);
  assert.match(secondImport, /already_imported.: true|already_imported": true/);
  assert.equal(psql(`SELECT count(*) FROM public.fg_vehicles WHERE reg_no = 'IMPORT DUP';`), '0');
  assert.equal(psql(`SELECT count(*) FROM public.fg_import_runs WHERE source_hash = 'hash-one' AND status = 'committed';`), '1');

  const beforeBad = psql(`SELECT count(*) FROM public.fg_vehicles WHERE company_id = 1;`);
  const beforeRuns = psql(`SELECT count(*) FROM public.fg_import_runs WHERE company_id = 1;`);
  fails(
    `SELECT public.fg_import_commit(1, jsonb_build_object('kind', 'vehicles_csv', 'source_hash', 'hash-bad', 'created_by', 'owner-1'), jsonb_build_object(
      'company_id', 1,
      'upserts', jsonb_build_object('fg_vehicles', jsonb_build_array(jsonb_build_object(
        'id', gen_random_uuid(),
        'company_id', 1,
        'reg_no', 'BAD IMPORT',
        'kind', 'not-a-kind',
        'updated_at', '2024-07-02T00:00:00Z'
      )))
    ));`,
    /fg_vehicles_kind|check constraint/i
  );
  assert.equal(psql(`SELECT count(*) FROM public.fg_vehicles WHERE company_id = 1;`), beforeBad);
  assert.equal(psql(`SELECT count(*) FROM public.fg_import_runs WHERE company_id = 1;`), beforeRuns);
  assert.equal(psql(`SELECT count(*) FROM public.fg_vehicles WHERE reg_no = 'BAD IMPORT';`), '0');

  fails(
    `SELECT public.fg_import_commit(
      1,
      jsonb_build_object('kind', 'vehicles_csv', 'source_hash', 'hash-cap', 'created_by', 'owner-1'),
      jsonb_build_object(
        'company_id', 1,
        'upserts', jsonb_build_object(
          'fg_vehicles',
          (SELECT jsonb_agg(jsonb_build_object(
            'id', gen_random_uuid(),
            'company_id', 1,
            'reg_no', 'CAP ' || g,
            'kind', 'van',
            'updated_at', '2024-07-02T00:00:00Z'
          )) FROM generate_series(1, 501) AS g)
        )
      )
    );`,
    /fg_import_row_cap/
  );

  psql(`INSERT INTO public.profiles (id) VALUES (88015);`);
  const eraseTruck = psql(`INSERT INTO public.fg_vehicles (company_id, reg_no, kind) VALUES (88015, 'ERASE T', 'rigid') RETURNING id;`);
  const eraseTrailer = psql(`INSERT INTO public.fg_vehicles (company_id, reg_no, kind) VALUES (88015, 'ERASE R', 'trailer') RETURNING id;`);
  psql(`INSERT INTO public.fg_reminders (company_id, scope_kind, thresholds_days, channels, enabled) VALUES (88015, 'vehicle', ARRAY[7,0], ARRAY['email'], false);`);
  psql(`INSERT INTO public.fg_trailer_links (company_id, truck_id, trailer_id, from_on) VALUES (88015, '${eraseTruck}', '${eraseTrailer}', '2024-01-01');`);
  psql(`INSERT INTO public.fg_reminder_log (company_id, rule_id, item_id, subject_kind, subject_id, expires_on, threshold_days, channel, recipient_key, status) VALUES (88015, gen_random_uuid(), gen_random_uuid(), 'vehicle', '${eraseTruck}', '2027-01-01', 7, 'email', 'member-9', 'sent');`);
  psql(`INSERT INTO public.fg_audit_log (company_id, actor_kind, actor_id, action) VALUES (88015, 'staff', 'u', 'keep');`);
  psql(`INSERT INTO public.fg_import_runs (company_id, kind, status, source_hash, dry_run) VALUES (88015, 'vehicles_csv', 'dry_run', 'erase-hash', true);`);
  psql(`SELECT public.fg_erase_company(88015);`);
  const companyTables = psql(`
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname LIKE 'fg\\_%' ESCAPE '\\'
      AND EXISTS (
        SELECT 1 FROM information_schema.columns col
        WHERE col.table_schema = 'public' AND col.table_name = c.relname AND col.column_name = 'company_id'
      )
    ORDER BY 1;
  `).split('\n').filter(Boolean);
  assert.ok(companyTables.includes('fg_reminders'));
  assert.ok(companyTables.includes('fg_reminder_log'));
  assert.ok(companyTables.includes('fg_trailer_links'));
  for (const table of companyTables) {
    assert.equal(psql(`SELECT count(*) FROM public.${table} WHERE company_id = 88015;`), '0', table);
  }
  assert.equal(psql(`SELECT count(*) FROM public.profiles WHERE id = 88015;`), '1');
  psql(`DELETE FROM public.profiles WHERE id = 88015;`);
  assert.equal(psql(`SELECT count(*) FROM public.profiles WHERE id = 88015;`), '0');

  psqlFile(migrationA);
  assert.equal(extensionSchema(), 'extensions');
  assert.equal(publicExtensionObjects(), '0');
  psqlFile(migrationB);
  assert.equal(extensionSchema(), 'extensions');
  assert.equal(publicExtensionObjects(), '0');
  assert.equal(
    psql(`SELECT count(*) FROM pg_constraint WHERE conname IN ('fg_cost_profiles_no_overlap', 'fg_trailer_links_no_overlap') AND contype = 'x';`),
    '2'
  );
  fails(
    `INSERT INTO public.fg_cost_profiles (company_id, vehicle_id, effective_from) VALUES (1, '${vehicleId}', '2024-02-01');`,
    /23P01|fg_cost_profiles_no_overlap|exclusion|conflicting/i
  );

  const extUrl = dbUrl('fleetgraph_ext');
  psql(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'fleetgraph_ext' AND pid <> pg_backend_pid();`, dbUrl('postgres'));
  psql(`DROP DATABASE IF EXISTS fleetgraph_ext;`, dbUrl('postgres'));
  psql(`CREATE DATABASE fleetgraph_ext;`, dbUrl('postgres'));
  psql(`
    CREATE SCHEMA IF NOT EXISTS extensions;
    CREATE EXTENSION btree_gist WITH SCHEMA extensions;
    DROP SCHEMA IF EXISTS public CASCADE;
    CREATE SCHEMA public;
    GRANT USAGE, CREATE ON SCHEMA public TO public;
    ${stubSql}
  `, extUrl);
  psqlFile(migrationA, extUrl);
  psqlFile(migrationB, extUrl);
  assert.equal(extensionSchema(extUrl), 'extensions');
  assert.equal(publicExtensionObjects(extUrl), '0');
  const extVehicle = psql(`INSERT INTO public.fg_vehicles (company_id, reg_no, kind) VALUES (1, 'EXT 1', 'rigid') RETURNING id;`, extUrl);
  psql(`INSERT INTO public.fg_cost_profiles (company_id, vehicle_id, effective_from) VALUES (1, '${extVehicle}', '2024-01-01');`, extUrl);
  try {
    psql(`INSERT INTO public.fg_cost_profiles (company_id, vehicle_id, effective_from) VALUES (1, '${extVehicle}', '2024-02-01');`, extUrl);
    assert.fail('expected exclusion on a database where btree_gist started in extensions');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    assert.match(message, /23P01|exclusion|conflicting/i);
  }

  console.log('brief115-db.test.ts ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
