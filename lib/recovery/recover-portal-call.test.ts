/**
 * Applies supabase/migrations/20261018_recovergraph_a.sql twice and checks
 * the portal skeleton. Not a live database.
 *
 * Run:
 *   RECOVER_PORTAL_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/recovergraph \
 *     npx --yes tsx lib/recovery/recover-portal-call.test.ts
 */
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const url = process.env.RECOVER_PORTAL_DATABASE_URL;
if (!url) {
  throw new Error('RECOVER_PORTAL_DATABASE_URL is required (CI Postgres service, or a local database)');
}

const migration = resolve('supabase/migrations/20261018_recovergraph_a.sql');

function psql(statement: string): string {
  return execFileSync('psql', [url!, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-t', '-A'], {
    encoding: 'utf8',
    input: statement,
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
}

function psqlAsync(statement: string): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn('psql', [url!, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-t', '-A'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolvePromise(stdout.trim());
      else reject(new Error(stderr || stdout));
    });
    child.stdin.end(statement);
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
  assert.fail(`expected Postgres to reject: ${statement.slice(0, 120)}`);
}

function call(portal: string, hash: string, op: string) {
  const raw = psql(`
    SELECT public.recover_portal_call(
      '${portal}',
      '${hash}',
      '${op}',
      '{}'::jsonb
    );
  `);
  return JSON.parse(raw) as { ok: boolean; portal?: string };
}

const HASH_A = 'aa'.repeat(32);
const HASH_B = 'bb'.repeat(32);
const denial = JSON.stringify({ ok: false });

async function main() {
  psql(`
    DROP SCHEMA IF EXISTS public CASCADE;
    CREATE SCHEMA public;
    GRANT USAGE, CREATE ON SCHEMA public TO public;
    CREATE SCHEMA IF NOT EXISTS extensions;
    CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
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
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'recover_definer') THEN
        CREATE ROLE recover_definer NOLOGIN NOBYPASSRLS CREATEROLE;
      END IF;
    END $$;
    ALTER ROLE recover_definer NOBYPASSRLS CREATEROLE;
    GRANT USAGE, CREATE ON SCHEMA public TO recover_definer;
    DO $$ BEGIN
      EXECUTE format('GRANT CREATE ON DATABASE %I TO recover_definer', current_database());
    END $$;
    GRANT USAGE ON SCHEMA extensions TO recover_definer;
    CREATE TABLE IF NOT EXISTS public.profiles (
      id bigint PRIMARY KEY
    );
    CREATE TABLE IF NOT EXISTS public.customers (
      id bigint PRIMARY KEY
    );
    GRANT ALL ON TABLE public.profiles, public.customers TO recover_definer;
  `);

  function applyMigration() {
    execFileSync('psql', [url!, '-X', '-v', 'ON_ERROR_STOP=1'], {
      encoding: 'utf8',
      input: `
        SET ROLE recover_definer;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public
          GRANT EXECUTE ON FUNCTIONS TO anon, authenticated;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public
          GRANT ALL ON TABLES TO anon, authenticated, service_role;
        \\i ${migration}
        RESET ROLE;
      `,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  }
  applyMigration();
  applyMigration();
  assert.equal(psql(`SELECT rolbypassrls FROM pg_roles WHERE rolname = 'recover_definer';`), 'f');
  assert.equal(
    psql(`SELECT pg_get_userbyid(proowner) FROM pg_proc WHERE proname = 'recover_desk_commit';`),
    'recover_definer'
  );

  const tables = [
    'recover_workspaces',
    'recover_teams',
    'recover_staff',
    'recover_creditors',
    'recover_mandates',
    'recover_audit_log',
    'recover_portal_invites',
    'recover_portal_otps',
    'recover_portal_sessions',
    'recover_portal_attempts',
  ];
  const forced = psql(`
    SELECT count(*)
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relname LIKE 'recover_%'
      AND c.relrowsecurity
      AND c.relforcerowsecurity;
  `);
  assert.equal(Number(forced), tables.length);

  const tokenColumn = psql(`
    SELECT count(*)
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'recover_workspaces'
      AND column_name ILIKE '%public_token%';
  `);
  assert.equal(Number(tokenColumn), 0);

  for (const table of tables) {
    for (const role of ['anon', 'authenticated', 'service_role', 'recover_portal']) {
      for (const privilege of ['TRUNCATE', 'REFERENCES', 'TRIGGER']) {
        assert.equal(
          psql(`SELECT has_table_privilege('${role}', 'public.${table}', '${privilege}');`),
          'f',
          `${role} ${privilege} ${table}`
        );
      }
      fails(
        `BEGIN; SET LOCAL ROLE ${role}; TRUNCATE public.${table}; ROLLBACK;`,
        /permission denied/i
      );
    }
  }
  fails(`TRUNCATE public.recover_audit_log;`, /append-only/);
  assert.equal(
    psql(`
      SELECT count(*)
      FROM pg_policy pol
      JOIN pg_class c ON c.oid = pol.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname LIKE 'recover_%'
        AND pol.polname = 'recover_table_owner';
    `),
    String(tables.length)
  );

  for (const table of tables) {
    for (const role of ['anon', 'authenticated', 'recover_portal']) {
      for (const verb of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
        const sql =
          verb === 'SELECT'
            ? `BEGIN; SET LOCAL ROLE ${role}; SELECT 1 FROM public.${table}; ROLLBACK;`
            : verb === 'DELETE'
              ? `BEGIN; SET LOCAL ROLE ${role}; DELETE FROM public.${table}; ROLLBACK;`
              : verb === 'UPDATE'
                ? `BEGIN; SET LOCAL ROLE ${role}; UPDATE public.${table} SET id = id; ROLLBACK;`
                : `BEGIN; SET LOCAL ROLE ${role}; INSERT INTO public.${table} DEFAULT VALUES; ROLLBACK;`;
        fails(sql, /permission denied/i);
      }
    }
  }

  fails(
    `BEGIN; SET LOCAL ROLE anon; SELECT public.recover_portal_call('creditor','${HASH_A}','ping','{}'::jsonb); ROLLBACK;`,
    /permission denied/i
  );
  for (const role of ['anon', 'authenticated']) {
    for (const fn of [
      `public.recover_portal_call('creditor','${HASH_A}','ping','{}'::jsonb)`,
      `public.recover_portal_register_failure(NULL, NULL, NULL, NULL)`,
      `public.recover_portal_is_throttled(NULL, NULL, NULL)`,
    ]) {
      const signature = fn.startsWith('public.recover_portal_call')
        ? 'public.recover_portal_call(text, text, text, jsonb)'
        : fn.startsWith('public.recover_portal_register_failure')
          ? 'public.recover_portal_register_failure(uuid, bigint, text, text)'
          : 'public.recover_portal_is_throttled(bigint, text, text)';
      assert.equal(
        psql(`SELECT has_function_privilege('${role}', '${signature}', 'EXECUTE');`),
        'f',
        `${role} ${signature}`
      );
      fails(`BEGIN; SET LOCAL ROLE ${role}; SELECT ${fn}; ROLLBACK;`, /permission denied/i);
    }
  }
  for (const role of ['anon', 'authenticated']) {
    assert.equal(
      psql(`SELECT has_function_privilege('${role}', 'public.recover_forbid_truncate()', 'EXECUTE');`),
      'f',
      `${role} recover_forbid_truncate`
    );
  }

  psql(`
    INSERT INTO public.profiles (id) VALUES (101), (102), (103);
    INSERT INTO public.recover_workspaces (company_id, display_name)
    VALUES (101, 'Desk A'), (102, 'Desk B');
    INSERT INTO public.recover_audit_log (company_id, actor_kind, action)
    VALUES (101, 'system', 'created');
    INSERT INTO public.recover_portal_sessions (
      company_id, token_hash, portal, expires_at
    ) VALUES
      (101, '${HASH_A}', 'creditor', now() + interval '1 day'),
      (102, '${HASH_B}', 'debtor', now() + interval '1 day'),
      (101, '${'c'.repeat(64)}', 'creditor', now() - interval '1 minute'),
      (101, '${'d'.repeat(64)}', 'attorney', now() + interval '1 day');
    UPDATE public.recover_portal_sessions
    SET revoked_at = now()
    WHERE token_hash = '${'d'.repeat(64)}';
  `);

  const workspace = psql(`
    SELECT real_data_enabled::text || ' ' || comms_flags::text
    FROM public.recover_workspaces
    WHERE company_id = 101;
  `);
  assert.match(workspace, /^false /);
  assert.match(workspace, /"email": false/);
  assert.match(workspace, /"whatsapp": false/);
  assert.match(workspace, /"sms": false/);

  fails(
    `UPDATE public.recover_audit_log SET action = 'changed' WHERE company_id = 101;`,
    /append-only/
  );
  fails(`DELETE FROM public.recover_audit_log WHERE company_id = 101;`, /append-only/);

  psql(`
    INSERT INTO public.profiles (id) VALUES (104);
    INSERT INTO public.recover_audit_log (company_id, actor_kind, action, payload)
    VALUES (104, 'system', 'kept', '{"kept":true}'::jsonb);
  `);
  fails(
    `BEGIN; SET LOCAL ROLE service_role; UPDATE public.recover_audit_log SET company_id = NULL WHERE action = 'kept'; ROLLBACK;`,
    /append-only/
  );
  assert.equal(
    psql(`SELECT company_id FROM public.recover_audit_log WHERE action = 'kept';`),
    '104'
  );
  psql(`DELETE FROM public.profiles WHERE id = 104;`);
  assert.equal(
    psql(`SELECT company_id IS NULL FROM public.recover_audit_log WHERE action = 'kept';`),
    't'
  );
  fails(
    `UPDATE public.recover_audit_log SET action = 'changed' WHERE action = 'kept';`,
    /append-only/
  );
  fails(`DELETE FROM public.recover_audit_log WHERE action = 'kept';`, /append-only/);

  psql(`
    SELECT public.recover_desk_commit(
      101,
      'user-1',
      'update_workspace',
      'recover_workspaces',
      '{"display_name":"Renamed","trust_mode":"direct"}'::jsonb
    );
  `);
  assert.equal(
    psql(`SELECT display_name || ' ' || trust_mode FROM public.recover_workspaces WHERE company_id = 101;`),
    'Renamed direct'
  );
  assert.match(
    psql(`SELECT payload::text FROM public.recover_audit_log WHERE company_id = 101 AND action = 'update_workspace';`),
    /display_name/
  );
  assert.match(
    psql(`SELECT payload::text FROM public.recover_audit_log WHERE company_id = 101 AND action = 'update_workspace';`),
    /trust_mode/
  );
  fails(
    `SELECT public.recover_desk_commit(103, 'user-1', 'update_workspace', 'recover_workspaces', '{"display_name":"Nope"}'::jsonb);`,
    /missing_workspace/
  );
  psql(`
    SELECT public.recover_desk_commit(
      103, 'user-1', 'init_workspace', 'recover_workspaces',
      '{"display_name":"New desk","trust_mode":"direct","operator_type":"agency"}'::jsonb
    );
  `);
  assert.equal(
    psql(`SELECT display_name || ' ' || trust_mode FROM public.recover_workspaces WHERE company_id = 103;`),
    'New desk direct'
  );
  psql(`
    SELECT public.recover_desk_commit(
      103, 'user-1', 'init_workspace', 'recover_workspaces',
      '{"display_name":"Overwrite"}'::jsonb
    );
  `);
  assert.equal(
    psql(`SELECT display_name FROM public.recover_workspaces WHERE company_id = 103;`),
    'New desk'
  );
  assert.equal(
    psql(`SELECT count(*) FROM public.recover_audit_log WHERE company_id = 103 AND action = 'init_workspace';`),
    '1'
  );
  const otherTeam = psql(`
    INSERT INTO public.recover_teams (company_id, name)
    VALUES (102, 'Other book')
    RETURNING id;
  `);
  fails(
    `SELECT public.recover_desk_commit(
      101, 'user-1', 'upsert_staff', 'agent@example.com',
      '{"email":"agent@example.com","role":"collector","team_id":"${otherTeam}"}'::jsonb
    );`,
    /team_company_mismatch|foreign key|23503/i
  );
  const ownTeam = psql(`
    INSERT INTO public.recover_teams (company_id, name)
    VALUES (101, 'Own book')
    RETURNING id;
  `);
  psql(`
    SELECT public.recover_desk_commit(
      101, 'user-1', 'upsert_staff', 'agent@example.com',
      '{"email":"agent@example.com","role":"collector","team_id":"${ownTeam}","monthly_target_cents":null}'::jsonb
    );
  `);
  assert.equal(
    psql(`SELECT role || ' ' || status || ' ' || team_id FROM public.recover_staff WHERE company_id = 101 AND lower(email) = 'agent@example.com';`),
    `collector active ${ownTeam}`
  );
  const staffId = psql(`SELECT id FROM public.recover_staff WHERE company_id = 101 AND lower(email) = 'agent@example.com';`);
  const upsertPayload = psql(
    `SELECT payload::text FROM public.recover_audit_log WHERE company_id = 101 AND action = 'upsert_staff';`
  );
  assert.match(upsertPayload, new RegExp(staffId));
  assert.doesNotMatch(upsertPayload, /agent@example.com/);
  assert.doesNotMatch(upsertPayload, /@/);
  const upsertTarget = psql(
    `SELECT target FROM public.recover_audit_log WHERE company_id = 101 AND action = 'upsert_staff';`
  );
  assert.equal(upsertTarget, staffId);
  assert.doesNotMatch(upsertTarget, /agent@example.com/);
  assert.doesNotMatch(upsertTarget, /@/);
  psql(`
    SELECT public.recover_desk_commit(
      101, 'user-1', 'deactivate_staff', '${staffId}',
      '{"id":"${staffId}","status":"inactive","email":"agent@example.com"}'::jsonb
    );
  `);
  assert.equal(
    psql(`SELECT status FROM public.recover_staff WHERE id = '${staffId}';`),
    'inactive'
  );
  const deactivatePayload = psql(
    `SELECT payload::text FROM public.recover_audit_log WHERE company_id = 101 AND action = 'deactivate_staff';`
  );
  assert.match(deactivatePayload, new RegExp(staffId));
  assert.doesNotMatch(deactivatePayload, /inactive/);
  assert.doesNotMatch(deactivatePayload, /agent@example.com/);
  assert.doesNotMatch(deactivatePayload, /@/);
  const deactivateTarget = psql(
    `SELECT target FROM public.recover_audit_log WHERE company_id = 101 AND action = 'deactivate_staff';`
  );
  assert.equal(deactivateTarget, staffId);
  assert.doesNotMatch(deactivateTarget, /agent@example.com/);
  assert.doesNotMatch(deactivateTarget, /@/);
  assert.equal(
    psql(`
      SELECT count(*) FROM public.recover_audit_log
      WHERE action IN ('upsert_staff', 'deactivate_staff')
        AND target LIKE '%@%';
    `),
    '0'
  );
  assert.equal(
    psql(`SELECT count(*) FROM public.recover_audit_log WHERE company_id = 103 AND action = 'update_workspace';`),
    '0'
  );

  fails(
    `INSERT INTO public.recover_workspaces (company_id, programme_types)
     VALUES (103, ARRAY['unknown']::text[]);`,
    /recover_workspaces_programme_check|check constraint/i
  );

  const ping = call('creditor', HASH_A, 'ping');
  assert.deepEqual(ping, { ok: true, portal: 'creditor' });
  assert.equal(JSON.stringify(ping).includes('101'), false);
  assert.equal(JSON.stringify(ping).includes(HASH_B), false);

  const unknownOp = call('creditor', HASH_A, 'home');
  const expired = call('creditor', 'c'.repeat(64), 'ping');
  const revoked = call('attorney', 'd'.repeat(64), 'ping');
  const unknownSession = call('creditor', 'ee'.repeat(32), 'ping');
  const wrongPortal = call('debtor', HASH_A, 'ping');
  for (const body of [unknownOp, expired, revoked, unknownSession, wrongPortal]) {
    assert.equal(JSON.stringify(body), denial);
  }
  const other = call('debtor', HASH_B, 'ping');
  assert.deepEqual(other, { ok: true, portal: 'debtor' });
  assert.equal(JSON.stringify(other).includes('101'), false);

  const code = 'ab'.repeat(32);
  const invite = psql(`
    INSERT INTO public.recover_portal_invites (
      company_id, portal, email, token_hash, expires_at
    ) VALUES (
      101, 'debtor', 'person@example.com', '${code}', now() + interval '1 day'
    ) RETURNING id;
  `);
  psql(`
    INSERT INTO public.recover_portal_otps (
      company_id, invite_id, code_hash, expires_at
    ) VALUES (
      101, '${invite}', '${code}', now() + interval '1 day'
    );
  `);

  for (let i = 0; i < 5; i += 1) {
    const ok = psql(
      `SELECT public.recover_portal_register_failure('${invite}', 101, '${code}', NULL);`
    );
    assert.equal(ok, 't');
  }
  const burned = psql(`
    SELECT failed_attempts::text || ' ' || (used_at IS NOT NULL)::text
    FROM public.recover_portal_otps
    WHERE invite_id = '${invite}';
  `);
  assert.equal(burned, '5 true');
  const still = psql(`
    SELECT (
      used_at IS NULL
      AND public.recover_verify_code_ct(code_hash, '${code}')
    )::text
    FROM public.recover_portal_otps
    WHERE invite_id = '${invite}';
  `);
  assert.equal(still, 'false');

  assert.equal(psql(`SELECT public.recover_verify_code_ct('${code}', '${code}');`), 't');
  assert.equal(psql(`SELECT public.recover_verify_code_ct('${code}', '${'cd'.repeat(32)}');`), 'f');
  assert.equal(psql(`SELECT public.recover_verify_code_ct('${code}', 'abcd');`), 'f');
  assert.equal(psql(`SELECT public.recover_verify_code_ct('zz', 'zz');`), 'f');

  assert.equal(
    psql(`SELECT public.recover_portal_is_throttled(NULL, 'debtor', '${code}');`),
    't'
  );
  assert.equal(
    psql(`SELECT public.recover_portal_is_throttled(101, 'nope', '${code}');`),
    't'
  );
  assert.equal(
    psql(`SELECT public.recover_portal_is_throttled(101, 'debtor', '   ');`),
    't'
  );

  const emailHash = '11'.repeat(32);
  psql(`DELETE FROM public.recover_portal_attempts WHERE company_id = 101;`);
  psql(`
    INSERT INTO public.recover_portal_attempts (company_id, portal, scope, key_hash)
    SELECT 101, 'debtor', 'email', '${emailHash}'
    FROM generate_series(1, 10);
  `);
  assert.equal(
    psql(`SELECT public.recover_portal_is_throttled(101, 'debtor', '${emailHash}');`),
    'f'
  );
  psql(`
    INSERT INTO public.recover_portal_attempts (company_id, portal, scope, key_hash)
    VALUES (101, 'debtor', 'email', '${emailHash}');
  `);
  assert.equal(
    psql(`SELECT public.recover_portal_is_throttled(101, 'debtor', '${emailHash}');`),
    't'
  );

  psql(`DELETE FROM public.recover_portal_attempts WHERE company_id = 101 AND scope = 'book';`);
  psql(`
    INSERT INTO public.recover_portal_attempts (company_id, portal, scope, key_hash)
    SELECT 101, 'debtor', 'book', '22'
    FROM generate_series(1, 50);
  `);
  assert.equal(
    psql(`SELECT public.recover_portal_is_throttled(101, 'debtor', '33');`),
    'f'
  );
  psql(`
    INSERT INTO public.recover_portal_attempts (company_id, portal, scope, key_hash)
    VALUES (101, 'debtor', 'book', '22');
  `);
  assert.equal(
    psql(`SELECT public.recover_portal_is_throttled(101, 'debtor', '33');`),
    't'
  );

  const raceInvite = psql(`
    INSERT INTO public.recover_portal_invites (
      company_id, portal, email, token_hash, expires_at
    ) VALUES (
      102, 'creditor', 'race@example.com', '${'99'.repeat(32)}', now() + interval '1 day'
    ) RETURNING id;
  `);
  psql(`
    INSERT INTO public.recover_portal_otps (
      company_id, invite_id, code_hash, expires_at
    ) VALUES (
      102, '${raceInvite}', '${'99'.repeat(32)}', now() + interval '1 day'
    );
  `);
  await Promise.all(
    Array.from({ length: 4 }, () =>
      psqlAsync(
        `SELECT public.recover_portal_register_failure('${raceInvite}', 102, '${'99'.repeat(32)}', NULL);`
      )
    )
  );
  const raced = psql(`
    SELECT failed_attempts FROM public.recover_portal_otps WHERE invite_id = '${raceInvite}';
  `);
  assert.equal(Number(raced), 4);
  assert.equal(
    psql(`SELECT count(*) FROM public.recover_portal_attempts WHERE scope = 'ip';`),
    '0'
  );
  psql(`
    INSERT INTO public.recover_portal_attempts (company_id, portal, scope, key_hash, at)
    VALUES (101, 'debtor', 'email', 'old', now() - interval '2 days');
  `);
  assert.equal(psql(`SELECT public.recover_portal_prune_attempts();`) !== '', true);
  assert.equal(
    psql(`SELECT count(*) FROM public.recover_portal_attempts WHERE key_hash = 'old';`),
    '0'
  );

  psql(`
    BEGIN;
    SET LOCAL ROLE service_role;
    SELECT public.recover_desk_commit(
      101, 'user-1', 'update_workspace', 'recover_workspaces',
      '{"display_name":"Owned without bypass"}'::jsonb
    );
    COMMIT;
  `);
  assert.equal(
    psql(`SELECT display_name FROM public.recover_workspaces WHERE company_id = 101;`),
    'Owned without bypass'
  );

  const rollback = readFileSync(migration, 'utf8')
    .split('-- ROLLBACK_START')[1]
    .split('-- ROLLBACK_END')[0]
    .split('\n')
    .map((line) => line.replace(/^\s*--\s?/, '').trim())
    .filter((line) => line.length > 0)
    .join('\n');
  psql(rollback);
  assert.equal(
    psql(`SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname LIKE 'recover_%' AND c.relkind = 'r';`),
    '0'
  );

  console.log('recover-portal-call.test.ts ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
