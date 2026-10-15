/**
 * RecoverAdvisor® book database contract (Brief B).
 * Applies 20261018 then 20261021 twice against throw-away Postgres.
 * Not a live database.
 *
 * Run:
 *   RECOVER_PORTAL_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/recovergraph \
 *     npx --yes tsx lib/recovery/brief116-db.test.ts
 */
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { resolve } from 'node:path';

const url = process.env.RECOVER_PORTAL_DATABASE_URL;
if (!url) throw new Error('RECOVER_PORTAL_DATABASE_URL is required');

const migrationA = resolve('supabase/migrations/20261018_recovergraph_a.sql');
const migrationB = resolve('supabase/migrations/20261021_recovergraph_b.sql');

function psql(statement: string): string {
  return execFileSync('psql', [url!, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-t', '-A'], {
    encoding: 'utf8',
    input: statement,
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
}

function apply(path: string) {
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
  assert.fail(`expected Postgres to reject: ${statement.slice(0, 140)}`);
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

const sha = (ch: string) => ch.repeat(64).slice(0, 64);

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
  `);
  apply(migrationA);
  apply(migrationB);
  apply(migrationB);

  const tables = psql(`
    SELECT c.relname FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname LIKE 'recover\\_%' ESCAPE '\\'
    ORDER BY 1;
  `).split('\n').filter(Boolean);
  assert.ok(tables.includes('recover_debtors'));
  assert.ok(tables.includes('recover_accounts'));
  assert.ok(tables.includes('recover_account_events'));
  assert.ok(tables.includes('recover_erase_guard'));

  const forced = Number(psql(`
    SELECT count(*) FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname LIKE 'recover\\_%' ESCAPE '\\'
      AND c.relrowsecurity AND c.relforcerowsecurity;
  `));
  assert.equal(forced, tables.length);

  for (const table of tables) {
    if (table === 'recover_erase_guard') continue;
    for (const policy of ['sa_deny_anon', 'sa_deny_authenticated']) {
      assert.equal(
        psql(`
          SELECT count(*) FROM pg_policy pol
          JOIN pg_class c ON c.oid = pol.polrelid
          WHERE c.relname = '${table}' AND pol.polname = '${policy}';
        `),
        '1',
        `${table} ${policy}`
      );
    }
  }

  const fnLeak = psql(`
    SELECT p.proname || ':' || r.rol
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    CROSS JOIN (VALUES ('public'), ('anon'), ('authenticated'), ('recover_portal')) AS r(rol)
    WHERE n.nspname = 'public' AND p.proname LIKE 'recover\\_%' ESCAPE '\\'
      AND has_function_privilege(r.rol, p.oid, 'EXECUTE')
    LIMIT 5;
  `);
  assert.equal(fnLeak, '');

  const tableLeak = psql(`
    SELECT c.relname || ':' || r.rol || ':' || priv.p
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN (VALUES ('public'), ('anon'), ('authenticated'), ('recover_portal')) AS r(rol)
    CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) AS priv(p)
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname LIKE 'recover\\_%' ESCAPE '\\'
      AND has_table_privilege(r.rol, c.oid, priv.p)
    LIMIT 5;
  `);
  assert.equal(tableLeak, '');

  const seqLeak = psql(`
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN (VALUES ('public'), ('anon'), ('authenticated'), ('recover_portal')) AS r(rol)
    WHERE n.nspname = 'public' AND c.relkind = 'S' AND c.relname LIKE 'recover\\_%' ESCAPE '\\'
      AND (
        has_sequence_privilege(r.rol, c.oid, 'USAGE')
        OR has_sequence_privilege(r.rol, c.oid, 'SELECT')
        OR has_sequence_privilege(r.rol, c.oid, 'UPDATE')
      )
    LIMIT 5;
  `);
  assert.equal(seqLeak, '');

  const truncateLeak = psql(`
    SELECT c.relname FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname LIKE 'recover\\_%' ESCAPE '\\'
      AND has_table_privilege('service_role', c.oid, 'TRUNCATE')
    LIMIT 5;
  `);
  assert.equal(truncateLeak, '');

  for (const sig of [
    'public.recover_erase_company(bigint)',
    'public.recover_open_erase_token()',
    'public.recover_write_audit(bigint, text, text, text, jsonb)',
    'public.recover_write_event(bigint, uuid, text, text, jsonb, text)',
  ]) {
    assert.equal(psql(`SELECT has_function_privilege('service_role', '${sig}', 'EXECUTE');`), 'f', sig);
  }
  assert.equal(
    psql(`SELECT has_function_privilege('service_role', 'public.recover_book_commit(bigint, text, text, text, jsonb)', 'EXECUTE');`),
    't'
  );

  for (const role of ['anon', 'authenticated', 'recover_portal']) {
    fails(`BEGIN; SET LOCAL ROLE ${role}; SELECT 1 FROM public.recover_debtors; ROLLBACK;`, /permission denied/i);
  }
  fails(`TRUNCATE public.recover_account_events;`, /append-only/);

  const plaintext = psql(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name LIKE 'recover\\_%' ESCAPE '\\'
      AND column_name ~ '^(id_number|passport)$'
    ORDER BY 1;
  `);
  assert.equal(plaintext, '');
  assert.equal(
    psql(`SELECT count(*) FROM information_schema.columns WHERE table_name = 'recover_debtors' AND column_name = 'id_number_enc';`),
    '1'
  );

  psql(`
    INSERT INTO public.profiles (id) VALUES (1), (2), (3);
    INSERT INTO public.customers (id, profile_id) VALUES (10, 1), (11, 2);
    SELECT public.recover_desk_commit(1, 'owner', 'init_workspace', 'w', '{"display_name":"Desk","operator_type":"agency"}'::jsonb);
    SELECT public.recover_desk_commit(2, 'owner', 'init_workspace', 'w', '{"display_name":"Other","operator_type":"agency"}'::jsonb);
    SELECT public.recover_desk_commit(3, 'owner', 'init_workspace', 'w', '{"display_name":"Erase","operator_type":"in_house"}'::jsonb);
  `);

  fails(
    `SELECT public.recover_book_commit(1, 'a', 'nope', 't', '{}'::jsonb);`,
    /unsupported|22023/
  );
  fails(
    `SELECT public.recover_book_commit(1, 'a', 'creditor.upsert', 't', '{"company_id":9,"name":"Z"}'::jsonb);`,
    /company_id_refused|22023/
  );

  const creditor = JSON.parse(psql(`
    SELECT public.recover_book_commit(1, 'owner', 'creditor.upsert', 't',
      '{"name":"North Creditor","reg_no":"2020/1","customer_id":"10"}'::jsonb);
  `)) as { id: string };
  fails(
    `SELECT public.recover_book_commit(1, 'owner', 'creditor.upsert', 't', jsonb_build_object('id','${creditor.id}','name','North Creditor','expected_updated_at','2000-01-01T00:00:00Z'));`,
    /40001|conflict/
  );
  assert.equal(
    psql(`SELECT name FROM public.recover_creditors WHERE id = '${creditor.id}';`),
    'North Creditor'
  );
  assert.equal(psql(`SELECT customer_id FROM public.recover_creditors WHERE id = '${creditor.id}';`), '10');
  fails(
    `SELECT public.recover_book_commit(1, 'owner', 'creditor.upsert', 't', '{"name":"Other Co","customer_id":"11"}'::jsonb);`,
    /customer_company|23503/
  );
  psql(`SELECT public.recover_set_assignment_block(1, 'owner', false);`);
  assert.equal(psql(`SELECT block_unregistered_assignment FROM public.recover_workspaces WHERE company_id = 1;`), 'f');
  assert.equal(
    psql(`SELECT count(*) FROM public.recover_audit_log WHERE action = 'workspace.assignment_block' AND company_id = 1;`),
    '1'
  );
  psql(`SELECT public.recover_set_assignment_block(1, 'owner', true);`);

  fails(
    `SELECT public.recover_book_commit(1, 'owner', 'mandate.upsert', 't', jsonb_build_object(
      'creditor_id','${creditor.id}','product_type','trade','nca_regulated',false,'status','active'
    ));`,
    /check|23514|agreement/
  );

  const mandate = JSON.parse(psql(`
    SELECT public.recover_book_commit(1, 'owner', 'mandate.upsert', 't', jsonb_build_object(
      'creditor_id','${creditor.id}','product_type','nca_credit','nca_regulated',true,'status','active',
      'agreement_reference','AGR-1','signed_on','2026-01-15',
      'commission_model', jsonb_build_object('kind','pct_of_recovered')
    ));
  `)) as { id: string };

  const otherCreditor = JSON.parse(psql(`
    SELECT public.recover_book_commit(2, 'owner', 'creditor.upsert', 't', '{"name":"Other Creditor"}'::jsonb);
  `)) as { id: string };
  const otherMandate = JSON.parse(psql(`
    SELECT public.recover_book_commit(2, 'owner', 'mandate.upsert', 't', jsonb_build_object(
      'creditor_id','${otherCreditor.id}','product_type','trade','nca_regulated',false,'status','active',
      'agreement_reference','AGR-2','signed_on','2026-02-01'
    ));
  `)) as { id: string };

  psql(`SELECT public.recover_desk_commit(1, 'owner', 'set_real_data_enabled', 'w', '{"enabled":true}'::jsonb);`);

  fails(
    `SELECT public.recover_import_commit(1, 'owner', jsonb_build_object(
      'creditor_id','${creditor.id}','mandate_id','${otherMandate.id}','source','csv','file_name','x.csv',
      'file_sha256','${sha('a')}','is_demo', false
    ), jsonb_build_array(jsonb_build_object('creditor_account_ref','Z','display_name','Z','principal_cents',1,'original_cents',1)));`,
    /mandate|22023/
  );

  const bad = `SELECT public.recover_import_commit(1, 'owner', jsonb_build_object(
    'creditor_id','${creditor.id}','mandate_id','${mandate.id}','source','csv','file_name','bad.csv',
    'file_sha256','${sha('b')}','is_demo', false
  ), jsonb_build_array(
    jsonb_build_object('creditor_account_ref','GOOD','display_name','Good','principal_cents',10,'original_cents',10),
    jsonb_build_object('creditor_account_ref','BAD','display_name','Bad','principal_cents',-1,'original_cents',1)
  ));`;
  fails(bad, /row_invalid|22023|invalid/);
  assert.equal(
    psql(`SELECT count(*) FROM public.recover_batches WHERE file_sha256 = '${sha('b')}';`),
    '0'
  );
  assert.equal(psql(`SELECT count(*) FROM public.recover_accounts WHERE company_id = 1;`), '0');

  const imported = JSON.parse(psql(`
    SELECT public.recover_import_commit(1, 'owner', jsonb_build_object(
      'creditor_id','${creditor.id}','mandate_id','${mandate.id}','source','csv','file_name','book.csv',
      'file_sha256','${sha('c')}','is_demo', false
    ), jsonb_build_array(
      jsonb_build_object('row_number',2,'creditor_account_ref','ACC-1','display_name','Ada','principal_cents',1000,'interest_cents',100,'fees_cents',50,'costs_cents',25,'original_cents',1175),
      jsonb_build_object('row_number',3,'creditor_account_ref','ACC-1','display_name','Dup','principal_cents',5,'original_cents',5),
      jsonb_build_object('row_number',4,'creditor_account_ref','ACC-2','display_name','Bea','principal_cents',2000,'original_cents',2000,'id_hash','abc','id_last4','0000')
    ));
  `)) as { code: string; created: number; skipped: number };
  assert.equal(imported.code, 'imported');
  assert.equal(imported.created, 2);
  assert.equal(imported.skipped, 1);
  assert.equal(
    psql(`SELECT balance_cents FROM public.recover_accounts WHERE creditor_account_ref = 'ACC-1';`),
    '1175'
  );

  const again = JSON.parse(psql(`
    SELECT public.recover_import_commit(1, 'owner', jsonb_build_object(
      'creditor_id','${creditor.id}','mandate_id','${mandate.id}','source','csv','file_name','book.csv',
      'file_sha256','${sha('c')}','is_demo', false
    ), jsonb_build_array(jsonb_build_object('creditor_account_ref','ACC-9','display_name','No','principal_cents',1,'original_cents',1)));
  `)) as { code: string };
  assert.equal(again.code, 'already_imported');
  assert.equal(psql(`SELECT count(*) FROM public.recover_accounts WHERE creditor_account_ref = 'ACC-9';`), '0');

  fails(
    `SELECT public.recover_import_commit(1, 'owner', jsonb_build_object(
      'creditor_id','${creditor.id}','mandate_id','${mandate.id}','source','csv','file_name','cap.csv',
      'file_sha256','${sha('d')}','is_demo', false
    ), (SELECT jsonb_agg(jsonb_build_object('creditor_account_ref','R'||g,'display_name','N','principal_cents',1,'original_cents',1)) FROM generate_series(1,2001) g));`,
    /row_cap|22023/
  );

  const [left, right] = await Promise.all([
    psqlAsync(`
      SELECT public.recover_import_commit(1, 'owner', jsonb_build_object(
        'creditor_id','${creditor.id}','mandate_id','${mandate.id}','source','csv','file_name','race.csv',
        'file_sha256','${sha('e')}','is_demo', false
      ), jsonb_build_array(jsonb_build_object('creditor_account_ref','RACE-1','display_name','Race','principal_cents',3,'original_cents',3)));
    `),
    psqlAsync(`
      SELECT public.recover_import_commit(1, 'owner', jsonb_build_object(
        'creditor_id','${creditor.id}','mandate_id','${mandate.id}','source','csv','file_name','race.csv',
        'file_sha256','${sha('e')}','is_demo', false
      ), jsonb_build_array(jsonb_build_object('creditor_account_ref','RACE-1','display_name','Race','principal_cents',3,'original_cents',3)));
    `),
  ]);
  const codes = [left, right].map((raw) => (JSON.parse(raw) as { code: string }).code).sort();
  assert.deepEqual(codes, ['already_imported', 'imported']);
  assert.equal(psql(`SELECT count(*) FROM public.recover_accounts WHERE creditor_account_ref = 'RACE-1';`), '1');

  const batchOther = JSON.parse(psql(`
    SELECT public.recover_import_commit(1, 'owner', jsonb_build_object(
      'creditor_id','${creditor.id}','mandate_id','${mandate.id}','source','csv','file_name','two.csv',
      'file_sha256','${sha('f')}','is_demo', false
    ), jsonb_build_array(
      jsonb_build_object('creditor_account_ref','ACC-3','display_name','Bea','principal_cents',9,'original_cents',9,'id_hash','abc','id_last4','0000')
    ));
  `)) as { batch_id: string };
  const sharedDebtor = psql(`SELECT count(DISTINCT debtor_id) FROM public.recover_accounts WHERE creditor_account_ref IN ('ACC-2','ACC-3');`);
  assert.equal(sharedDebtor, '1');
  const rolled = JSON.parse(psql(`
    SELECT public.recover_rollback_batch(1, 'owner', '${batchOther.batch_id}'::uuid);
  `)) as { code: string };
  assert.equal(rolled.code, 'rolled_back');
  assert.equal(psql(`SELECT count(*) FROM public.recover_accounts WHERE creditor_account_ref = 'ACC-3';`), '0');
  assert.equal(psql(`SELECT count(*) FROM public.recover_accounts WHERE creditor_account_ref = 'ACC-2';`), '1');
  assert.equal(psql(`SELECT status FROM public.recover_batches WHERE id = '${batchOther.batch_id}';`), 'rolled_back');

  const noted = psql(`SELECT id FROM public.recover_accounts WHERE creditor_account_ref = 'ACC-2';`);
  psql(`SELECT public.recover_book_commit(1, 'owner', 'account.add_note', 't', jsonb_build_object('id','${noted}','note_text','Kept'));`);
  const batchNoted = psql(`SELECT batch_id FROM public.recover_accounts WHERE id = '${noted}';`);
  const refused = JSON.parse(psql(`SELECT public.recover_rollback_batch(1, 'owner', '${batchNoted}'::uuid);`)) as { code: string };
  assert.equal(refused.code, 'rollback_refused');
  assert.equal(psql(`SELECT count(*) FROM public.recover_account_events WHERE account_id = '${noted}';`), '2');
  fails(
    `UPDATE public.recover_account_events SET payload = '{"x":1}'::jsonb WHERE account_id = '${noted}';`,
    /append-only/
  );
  fails(
    `BEGIN; SET LOCAL ROLE service_role; DELETE FROM public.recover_account_events WHERE account_id = '${noted}'; ROLLBACK;`,
    /append-only/
  );

  const auditForNote = psql(`SELECT count(*) FROM public.recover_audit_log WHERE action = 'account.add_note' AND target = '${noted}';`);
  assert.equal(auditForNote, '1');
  assert.equal(
    psql(`SELECT position('Kept' in payload::text) = 0 FROM public.recover_audit_log WHERE action = 'account.add_note' AND target = '${noted}';`),
    't'
  );

  psql(`
    SELECT public.recover_desk_commit(1, 'owner', 'upsert_staff', 's', '{"email":"a@book.example","role":"collector","cfdc_registration_no":"DEMO-1"}'::jsonb);
    SELECT public.recover_desk_commit(1, 'owner', 'upsert_staff', 's', '{"email":"b@book.example","role":"collector","cfdc_registration_no":""}'::jsonb);
    SELECT public.recover_desk_commit(1, 'owner', 'upsert_staff', 's', '{"email":"c@book.example","role":"collector","cfdc_registration_no":"DEMO-3"}'::jsonb);
  `);
  const staffA = psql(`SELECT id FROM public.recover_staff WHERE email = 'a@book.example';`);
  const staffB = psql(`SELECT id FROM public.recover_staff WHERE email = 'b@book.example';`);
  const staffC = psql(`SELECT id FROM public.recover_staff WHERE email = 'c@book.example';`);
  const team = psql(`INSERT INTO public.recover_teams (company_id, name) VALUES (1, 'Floor') RETURNING id;`);
  psql(`UPDATE public.recover_staff SET team_id = '${team}' WHERE id = '${staffA}';`);
  psql(`
    UPDATE public.recover_accounts SET assigned_to = '${staffA}' WHERE creditor_account_ref = 'ACC-1';
    UPDATE public.recover_accounts SET team_id = '${team}', assigned_to = NULL WHERE creditor_account_ref = 'ACC-2';
  `);
  // direct update of assignment does not go through the function; agent read still scopes
  const seenA = psql(`SELECT creditor_account_ref FROM public.recover_accounts_for_agent(1, '${staffA}', 50, NULL, NULL) ORDER BY 1;`)
    .split('\n').filter(Boolean).sort();
  const seenB = psql(`SELECT COALESCE(string_agg(creditor_account_ref, ','), '') FROM public.recover_accounts_for_agent(1, '${staffB}', 50, NULL, NULL);`);
  assert.deepEqual(seenA, ['ACC-1', 'ACC-2']);
  assert.equal(seenB, '');

  fails(
    `SELECT public.recover_book_commit(1, 'owner', 'account.assign', 't', jsonb_build_object('id','${noted}','staff_id','${staffB}'));`,
    /registration_missing|23514/
  );
  psql(`SELECT public.recover_set_staff_expiry(1, 'owner', '${staffC}', '2000-01-01');`);
  assert.equal(psql(`SELECT registration_expires_on FROM public.recover_staff WHERE id = '${staffC}';`), '2000-01-01');
  assert.equal(
    psql(`SELECT count(*) FROM public.recover_audit_log WHERE action = 'staff.registration_expiry' AND target = '${staffC}';`),
    '1'
  );
  assert.equal(
    psql(`SELECT position('@' in payload::text) = 0 FROM public.recover_audit_log WHERE action = 'staff.registration_expiry' AND target = '${staffC}';`),
    't'
  );
  const assignIds = psql(`
    SELECT json_agg(id) FROM public.recover_accounts
    WHERE company_id = 1 AND creditor_account_ref IN ('ACC-1', 'ACC-2');
  `);
  const bulk = JSON.parse(psql(`
    SELECT public.recover_bulk_assign(1, 'owner', '${assignIds}'::jsonb, '${staffA}', NULL, '2026-06-01');
  `)) as { ok: boolean; count: number };
  assert.equal(bulk.ok, true);
  assert.equal(bulk.count, 2);
  assert.equal(
    psql(`SELECT count(*) FROM public.recover_accounts WHERE company_id = 1 AND creditor_account_ref IN ('ACC-1', 'ACC-2') AND assigned_to = '${staffA}';`),
    '2'
  );
  fails(
    `SELECT public.recover_bulk_assign(1, 'owner', '[]'::jsonb, '${staffA}', NULL, NULL);`,
    /cap|22023/
  );
  fails(
    `SELECT public.recover_book_commit(1, 'owner', 'account.assign', 't', jsonb_build_object('id','${noted}','staff_id','${staffC}','as_of','2026-06-01'));`,
    /registration_expired|23514/
  );

  const numbers = await Promise.all(
    [1, 2, 3, 4, 5, 6].map(() => psqlAsync(`SELECT public.recover_next_number(1, 'account');`))
  );
  assert.equal(new Set(numbers).size, numbers.length);

  const ada = psql(`SELECT id FROM public.recover_debtors WHERE company_id = 1 AND display_name = 'Ada';`);
  const bea = psql(`SELECT id FROM public.recover_debtors WHERE company_id = 1 AND display_name = 'Bea';`);
  psql(`
    INSERT INTO public.recover_contact_points (company_id, debtor_id, kind, value, source)
    VALUES (1, '${ada}', 'phone', '0100000001', 'import');
  `);
  assert.equal(
    psql(`SELECT value FROM public.recover_contact_points WHERE company_id = 1 AND debtor_id = '${ada}';`),
    '0100000001'
  );
  psql(`
    INSERT INTO public.recover_contact_points (company_id, debtor_id, kind, value, source)
    VALUES (1, '${bea}', 'phone', '0100000001', 'manual');
  `);
  assert.equal(psql(`SELECT count(*) FROM public.recover_contact_points WHERE company_id = 2;`), '0');
  const merged = JSON.parse(psql(`
    SELECT public.recover_book_commit(1, 'owner', 'debtor.merge', 't', jsonb_build_object('source_id','${ada}','target_id','${bea}'));
  `)) as { ok: boolean; id: string };
  assert.equal(merged.ok, true);
  assert.equal(merged.id, bea);
  assert.equal(psql(`SELECT status FROM public.recover_debtors WHERE id = '${ada}';`), 'merged');
  assert.equal(psql(`SELECT debtor_id FROM public.recover_accounts WHERE creditor_account_ref = 'ACC-1';`), bea);
  assert.equal(psql(`SELECT debtor_id FROM public.recover_contact_points WHERE value = '0100000001';`), bea);
  assert.equal(
    psql(`SELECT count(*) FROM public.recover_contact_points WHERE company_id = 1 AND debtor_id = '${bea}' AND value = '0100000001';`),
    '1'
  );
  assert.equal(
    psql(`SELECT count(*) FROM public.recover_account_events e JOIN public.recover_accounts a ON a.id = e.account_id WHERE e.type = 'merge' AND a.creditor_account_ref = 'ACC-1';`),
    '1'
  );
  assert.equal(
    psql(`SELECT count(*) FROM public.recover_account_events e JOIN public.recover_accounts a ON a.id = e.account_id WHERE e.type = 'merge' AND a.creditor_account_ref = 'ACC-2';`),
    '0'
  );
  assert.equal(
    psql(`SELECT count(*) FROM public.recover_audit_log WHERE action = 'debtor.merge' AND target = '${bea}';`),
    '1'
  );
  fails(
    `SELECT public.recover_book_commit(1, 'owner', 'debtor.merge', 't', jsonb_build_object('source_id','${bea}','target_id','${bea}'));`,
    /merge|22023/
  );
  const acc1 = psql(`SELECT id FROM public.recover_accounts WHERE creditor_account_ref = 'ACC-1';`);
  const assigned = JSON.parse(psql(`
    SELECT public.recover_book_commit(1, 'owner', 'account.assign', 't', jsonb_build_object('id','${acc1}','staff_id','${staffA}'));
  `)) as { ok: boolean };
  assert.equal(assigned.ok, true);
  assert.equal(psql(`SELECT assigned_to FROM public.recover_accounts WHERE id = '${acc1}';`), staffA);

  psql(`SELECT public.recover_desk_commit(1, 'owner', 'upsert_staff', 's', '{"email":"fin@book.example","role":"finance_view"}'::jsonb);`);
  const staffFin = psql(`SELECT id FROM public.recover_staff WHERE email = 'fin@book.example';`);
  fails(
    `SELECT public.recover_book_commit(1, 'owner', 'account.assign', 't', jsonb_build_object('id','${acc1}','staff_id','${staffFin}'));`,
    /collector|22023/
  );
  psql(`SELECT public.recover_book_commit(1, 'owner', 'account.reveal_id', 't', jsonb_build_object('id','${acc1}','reason','Checking the file'));`);
  assert.equal(
    psql(`SELECT payload->>'reason' FROM public.recover_account_events WHERE account_id = '${acc1}' AND type = 'view_sensitive';`),
    'Checking the file'
  );
  assert.equal(
    psql(`SELECT position('Checking' in payload::text) = 0 FROM public.recover_audit_log WHERE action = 'account.reveal_id' AND target = '${acc1}';`),
    't'
  );
  fails(
    `SELECT public.recover_book_commit(1, 'owner', 'account.adjust', 't', jsonb_build_object('id','${acc1}','adjustment_cents',100));`,
    /reason|22023/
  );
  psql(`SELECT public.recover_book_commit(1, 'owner', 'account.adjust', 't', jsonb_build_object('id','${acc1}','adjustment_cents',100,'reason','Fee correction'));`);
  assert.equal(
    psql(`SELECT payload->>'reason' FROM public.recover_account_events WHERE account_id = '${acc1}' AND type = 'adjust';`),
    'Fee correction'
  );
  assert.equal(psql(`SELECT adjustment_cents FROM public.recover_accounts WHERE id = '${acc1}';`), '100');
  assert.equal(
    psql(`SELECT position('Fee correction' in payload::text) = 0 FROM public.recover_audit_log WHERE action = 'account.adjust' AND target = '${acc1}';`),
    't'
  );
  psql(`UPDATE public.recover_staff SET user_id = 'agent-a' WHERE id = '${staffA}';`);
  psql(`UPDATE public.recover_staff SET user_id = 'agent-b' WHERE id = '${staffB}';`);
  fails(
    `SELECT public.recover_book_commit(1, 'agent-b', 'account.add_note', 't', jsonb_build_object('id','${acc1}','note_text','Not mine'));`,
    /note_scope|22023/
  );
  psql(`SELECT public.recover_book_commit(1, 'agent-a', 'account.add_note', 't', jsonb_build_object('id','${acc1}','note_text','Mine'));`);
  assert.equal(
    psql(`SELECT count(*) FROM public.recover_account_events WHERE account_id = '${acc1}' AND type = 'note' AND note_text = 'Mine';`),
    '1'
  );
  const acc2 = psql(`SELECT id FROM public.recover_accounts WHERE creditor_account_ref = 'ACC-2';`);
  psql(`UPDATE public.recover_accounts SET assigned_to = NULL, team_id = (SELECT team_id FROM public.recover_staff WHERE id = '${staffA}') WHERE id = '${acc2}';`);
  psql(`SELECT public.recover_book_commit(1, 'agent-a', 'account.add_note', 't', jsonb_build_object('id','${acc2}','note_text','Team note'));`);
  fails(
    `SELECT public.recover_book_commit(1, 'agent-b', 'account.add_note', 't', jsonb_build_object('id','${acc2}','note_text','Still not mine'));`,
    /note_scope|22023/
  );
  psql(`SELECT public.recover_book_commit(1, 'owner', 'account.add_note', 't', jsonb_build_object('id','${acc1}','note_text','Owner still can'));`);

  fails(
    `SELECT public.recover_book_commit(1, 'owner', 'mandate.upsert', 't', jsonb_build_object(
      'id','${mandate.id}','creditor_id','${creditor.id}','product_type','trade','status','active'
    ));`,
    /mandate_locked|22023/
  );
  fails(
    `SELECT public.recover_book_commit(1, 'owner', 'mandate.upsert', 't', jsonb_build_object(
      'id','${mandate.id}','creditor_id','${creditor.id}','nca_regulated',false,'status','active'
    ));`,
    /mandate_locked|22023/
  );
  const keptMandate = JSON.parse(psql(`
    SELECT public.recover_book_commit(1, 'owner', 'mandate.upsert', 't', jsonb_build_object(
      'id','${mandate.id}','creditor_id','${creditor.id}'
    ));
  `)) as { ok: boolean };
  assert.equal(keptMandate.ok, true);
  assert.equal(psql(`SELECT status FROM public.recover_mandates WHERE id = '${mandate.id}';`), 'active');
  assert.equal(psql(`SELECT product_type FROM public.recover_mandates WHERE id = '${mandate.id}';`), 'nca_credit');

  const manual = JSON.parse(psql(`
    SELECT public.recover_book_commit(1, 'owner', 'debtor.upsert', 't', '{"display_name":"Manual Person","kind":"person"}'::jsonb);
  `)) as { id: string };
  const unrelated = JSON.parse(psql(`
    SELECT public.recover_import_commit(1, 'owner', jsonb_build_object(
      'creditor_id','${creditor.id}','mandate_id','${mandate.id}','source','csv','file_name','cara.csv',
      'file_sha256','${sha('4')}','is_demo', false
    ), jsonb_build_array(
      jsonb_build_object('creditor_account_ref','CARA-1','display_name','Cara','principal_cents',8,'original_cents',8)
    ));
  `)) as { code: string; batch_id: string };
  assert.equal(unrelated.code, 'imported');
  const cara = psql(`SELECT id FROM public.recover_debtors WHERE company_id = 1 AND display_name = 'Cara';`);
  const rolledCara = JSON.parse(psql(`
    SELECT public.recover_rollback_batch(1, 'owner', '${unrelated.batch_id}'::uuid);
  `)) as { code: string };
  assert.equal(rolledCara.code, 'rolled_back');
  assert.equal(psql(`SELECT count(*) FROM public.recover_debtors WHERE id = '${cara}';`), '0');
  assert.equal(psql(`SELECT count(*) FROM public.recover_debtors WHERE id = '${manual.id}';`), '1');
  assert.equal(psql(`SELECT count(*) FROM public.recover_debtors WHERE id = '${ada}';`), '1');
  assert.equal(psql(`SELECT merged_into_id FROM public.recover_debtors WHERE id = '${ada}';`), bea);
  assert.equal(psql(`SELECT count(*) FROM public.recover_debtors WHERE id = '${bea}';`), '1');

  const pageImport = JSON.parse(psql(`
    SELECT public.recover_import_commit(1, 'owner', jsonb_build_object(
      'creditor_id','${creditor.id}','mandate_id','${mandate.id}','source','csv','file_name','page.csv',
      'file_sha256','${sha('5')}','is_demo', false
    ), (
      SELECT jsonb_agg(jsonb_build_object(
        'creditor_account_ref', 'PAGE-' || lpad(g::text, 3, '0'),
        'display_name', 'Page ' || g,
        'principal_cents', 1,
        'original_cents', 1
      ))
      FROM generate_series(1, 60) g
    ));
  `)) as { code: string; created: number };
  assert.equal(pageImport.code, 'imported');
  assert.equal(pageImport.created, 60);
  const pageIds = psql(`SELECT json_agg(id) FROM public.recover_accounts WHERE company_id = 1 AND creditor_account_ref LIKE 'PAGE-%';`);
  const pageAssign = JSON.parse(psql(`
    SELECT public.recover_bulk_assign(1, 'owner', '${pageIds}'::jsonb, '${staffA}', NULL, '2026-06-01');
  `)) as { ok: boolean; count: number };
  assert.equal(pageAssign.ok, true);
  assert.equal(pageAssign.count, 60);
  const firstPage = psql(`
    SELECT count(*) FROM public.recover_accounts_for_agent(1, '${staffA}', 50, NULL, NULL, NULL, 'PAGE-');
  `);
  assert.equal(firstPage, '50');
  const cursor = psql(`
    SELECT id::text || '|' || placed_at::text
    FROM public.recover_accounts_for_agent(1, '${staffA}', 50, NULL, NULL, NULL, 'PAGE-')
    ORDER BY placed_at ASC, id ASC
    LIMIT 1;
  `);
  const [cursorId, cursorAt] = cursor.split('|');
  assert.equal(
    psql(`
      SELECT count(*) FROM public.recover_accounts_for_agent(
        1, '${staffA}', 50, '${cursorAt}'::timestamptz, NULL, NULL, 'PAGE-'
      );
    `),
    '0'
  );
  assert.equal(
    psql(`
      SELECT count(*) FROM public.recover_accounts_for_agent(
        1, '${staffA}', 50, '${cursorAt}'::timestamptz, NULL, '${cursorId}'::uuid, 'PAGE-'
      );
    `),
    '10'
  );
  const beyond = psql(`
    SELECT id FROM public.recover_accounts
    WHERE company_id = 1 AND creditor_account_ref LIKE 'PAGE-%'
    ORDER BY placed_at ASC, id ASC
    LIMIT 1;
  `);
  assert.equal(
    psql(`SELECT count(*) FROM public.recover_accounts_for_agent(1, '${staffB}', 50, NULL, NULL, NULL, NULL, '${beyond}'::uuid);`),
    '0'
  );
  assert.equal(
    psql(`SELECT count(*) FROM public.recover_accounts_for_agent(1, '${staffA}', 50, NULL, NULL, NULL, NULL, '${beyond}'::uuid);`),
    '1'
  );
  assert.equal(
    psql(`
      SELECT creditor_account_ref FROM public.recover_accounts_for_agent(1, '${staffA}', 50, NULL, NULL, NULL, NULL, '${beyond}'::uuid);
    `),
    psql(`SELECT creditor_account_ref FROM public.recover_accounts WHERE id = '${beyond}';`)
  );

  // demo lifecycle on company 2, which has no real accounts
  psql(`SELECT public.recover_desk_commit(2, 'owner', 'set_real_data_enabled', 'w', '{"enabled":true}'::jsonb);`);
  fails(
    `SELECT public.recover_load_demo_book(2, 'owner', '{"creditors":[],"mandates":[],"batches":[]}'::jsonb);`,
    /demo_refused|23514/
  );
  psql(`SELECT public.recover_desk_commit(2, 'owner', 'set_real_data_enabled', 'w', '{"enabled":false}'::jsonb);`);
  const demo = JSON.parse(psql(`
    SELECT public.recover_load_demo_book(2, 'owner', jsonb_build_object(
      'creditors', jsonb_build_array(jsonb_build_object('key','c1','name','Sample Credit','remittance_terms','monthly')),
      'mandates', jsonb_build_array(jsonb_build_object(
        'key','m1','creditor_key','c1','product_type','trade','nca_regulated',false,
        'agreement_reference','DEMO-AGR','signed_on','2026-03-01',
        'commission_model', jsonb_build_object('kind','flat_per_account')
      )),
      'batches', jsonb_build_array(jsonb_build_object(
        'creditor_key','c1','mandate_key','m1','file_name','demo.csv','file_sha256','${sha('9')}',
        'rows', jsonb_build_array(
          jsonb_build_object('creditor_account_ref','D-1','display_name','Demo Person','principal_cents',400,'original_cents',400)
        )
      ))
    ));
  `)) as { code: string };
  assert.equal(demo.code, 'loaded');
  assert.equal(psql(`SELECT is_demo FROM public.recover_accounts WHERE company_id = 2;`), 't');
  psql(`
    SELECT public.recover_book_commit(2, 'owner', 'debtor.upsert', 't', '{"display_name":"Real Person","kind":"person","is_demo":false}'::jsonb);
  `);
  // real debtor insert is blocked by SQL import path, but book_commit debtor.upsert does not check real_data.
  // Seed a real account by turning the flag on after clearing is tested below.
  const realDebtor = psql(`SELECT id FROM public.recover_debtors WHERE company_id = 2 AND is_demo = false;`);
  fails(
    `SELECT public.recover_desk_commit(2, 'owner', 'set_real_data_enabled', 'w', '{"enabled":true}'::jsonb);`,
    /Clear the demo book first/
  );
  psql(`SELECT public.recover_clear_demo(2, 'owner');`);
  assert.equal(psql(`SELECT count(*) FROM public.recover_accounts WHERE company_id = 2 AND is_demo;`), '0');
  assert.equal(psql(`SELECT count(*) FROM public.recover_debtors WHERE id = '${realDebtor}';`), '1');
  psql(`SELECT public.recover_desk_commit(2, 'owner', 'set_real_data_enabled', 'w', '{"enabled":true}'::jsonb);`);
  assert.equal(psql(`SELECT real_data_enabled FROM public.recover_workspaces WHERE company_id = 2;`), 't');

  fails(`SELECT public.recover_erase_company(2);`, /real_data|23514/);
  psql(`SELECT public.recover_desk_commit(2, 'owner', 'set_real_data_enabled', 'w', '{"enabled":false}'::jsonb);`);

  // rows in every new table for company 3, then profile delete must not wedge
  psql(`
    INSERT INTO public.recover_debtors (company_id, kind, display_name) VALUES (3, 'person', 'Erase Person');
    INSERT INTO public.recover_creditors (company_id, name) VALUES (3, 'Erase Creditor');
    INSERT INTO public.recover_mandates (
      company_id, creditor_id, product_type, nca_regulated, processing_role, status, agreement_reference, signed_on
    )
    SELECT 3, id, 'other', false, 'operator', 'active', 'E-1', '2026-01-01'
    FROM public.recover_creditors WHERE company_id = 3;
    INSERT INTO public.recover_batches (
      company_id, creditor_id, mandate_id, source, file_name, file_sha256, status
    )
    SELECT 3, c.id, m.id, 'manual', 'erase.csv', '${sha('1')}', 'imported'
    FROM public.recover_creditors c
    JOIN public.recover_mandates m ON m.company_id = c.company_id
    WHERE c.company_id = 3;
    INSERT INTO public.recover_contact_points (company_id, debtor_id, kind, value, source)
    SELECT 3, id, 'email', 'erase@book.example', 'manual' FROM public.recover_debtors WHERE company_id = 3;
    INSERT INTO public.recover_accounts (
      company_id, ref, creditor_id, mandate_id, debtor_id, creditor_account_ref,
      product_type, nca_regulated, original_cents, principal_cents
    )
    SELECT 3, 'RC-009999', c.id, m.id, d.id, 'E-ACC', 'other', false, 10, 10
    FROM public.recover_creditors c
    JOIN public.recover_mandates m ON m.company_id = 3
    JOIN public.recover_debtors d ON d.company_id = 3
    WHERE c.company_id = 3;
    INSERT INTO public.recover_account_events (company_id, account_id, type, actor_kind, actor_id, payload)
    SELECT 3, id, 'import', 'system', 'seed', '{}'::jsonb FROM public.recover_accounts WHERE company_id = 3;
    INSERT INTO public.recover_counters (company_id, name, value) VALUES (3, 'account', 1);
    INSERT INTO public.recover_audit_log (company_id, actor_kind, actor_id, action, target)
    VALUES (3, 'system', 'seed', 'seed', 'seed');
  `);
  psql(`DELETE FROM public.profiles WHERE id = 3;`);
  assert.equal(psql(`SELECT count(*) FROM public.profiles WHERE id = 3;`), '0');
  assert.equal(
    psql(`SELECT count(*) FROM public.recover_account_events WHERE company_id = 3;`),
    '0'
  );

  psql(`SELECT public.recover_desk_commit(1, 'owner', 'set_real_data_enabled', 'w', '{"enabled":false}'::jsonb);`);
  psql(`SELECT public.recover_erase_company(1);`);
  const leftover = psql(`
    SELECT string_agg(c.relname, ',')
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'company_id' AND NOT a.attisdropped
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname LIKE 'recover\\_%' ESCAPE '\\';
  `);
  for (const table of leftover.split(',').filter(Boolean)) {
    const n = psql(`SELECT count(*) FROM public.${table} WHERE company_id = 1;`);
    assert.equal(n, '0', table);
  }

  fails(
    `INSERT INTO public.recover_accounts (
      company_id, ref, creditor_id, mandate_id, debtor_id, creditor_account_ref,
      product_type, nca_regulated, original_cents, principal_cents, adjustment_cents
    ) VALUES (2, 'RC-1', '${otherCreditor.id}', '${otherMandate.id}', '${realDebtor}', 'NEG', 'trade', false, 10, 10, -11);`,
    /check|balance/
  );

  console.log('brief116-db.test.ts ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
