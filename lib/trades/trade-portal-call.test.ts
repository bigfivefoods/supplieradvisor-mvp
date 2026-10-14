/**
 * Executes supabase/migrations/20261014_tradegraph.sql on a real Postgres and
 * calls public.trade_portal_call. Customer A must not see customer B.
 *
 * Run:
 *   TRADE_PORTAL_DATABASE_URL=postgresql://USER:PASS@127.0.0.1:5432/tradegraph \
 *     npx --yes tsx lib/trades/trade-portal-call.test.ts
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const url = process.env.TRADE_PORTAL_DATABASE_URL;
if (!url) {
  throw new Error(
    'TRADE_PORTAL_DATABASE_URL is required (CI Postgres service, or a local database)'
  );
}

const migration = resolve('supabase/migrations/20261014_tradegraph.sql');
const TOKEN_A = 'token-customer-a-session-0001';
const TOKEN_B = 'token-customer-b-session-0002';

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
    assert.doesNotMatch(message, /cannot set parameter "role"/);
    return;
  }
  assert.fail(`expected Postgres to reject: ${statement.slice(0, 80)}`);
}

function home(token: string): Record<string, unknown> {
  const raw = psql(`
    SELECT public.trade_portal_call(
      '${token}',
      'home',
      '{}'::jsonb
    );
  `);
  return JSON.parse(raw) as Record<string, unknown>;
}

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
    END $$;
    CREATE TABLE IF NOT EXISTS public.profiles (
      id bigint PRIMARY KEY,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  psqlFile(migration);

  const def = psql(
    `SELECT pg_get_functiondef('public.trade_portal_call(text,text,jsonb)'::regprocedure);`
  );
  assert.doesNotMatch(def, /SET LOCAL ROLE/);
  assert.doesNotMatch(def, /RESET ROLE/);
  assert.match(def, /SECURITY DEFINER/);
  assert.match(def, /v_customer/);
  assert.match(def, /v_company/);

  const config = psql(`
    SELECT prosecdef::text || ' ' || COALESCE(array_to_string(proconfig, ','), '')
    FROM pg_proc
    WHERE proname = 'trade_portal_call';
  `);
  assert.match(config, /^true /);
  assert.match(config, /search_path=public, extensions/);

  const forced = psql(`
    SELECT count(*)
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relname LIKE 'trade_%'
      AND c.relrowsecurity
      AND c.relforcerowsecurity;
  `);
  assert.equal(Number(forced), 17);

  psql(`
    INSERT INTO public.profiles (id) VALUES (101), (102);
    INSERT INTO public.trade_workspaces (
      company_id, brand_name, trade, public_token, notify_email
    ) VALUES
      (101, 'Harbour Trades', 'electrician', 'harbour', 'desk-secret@example.com'),
      (102, 'Other Co', 'plumber', 'otherco', 'other-secret@example.com');
    INSERT INTO public.trade_customers (id, company_id, name, email) VALUES
      ('cust_a', 101, 'Thandi Nkosi', 'thandi@example.com'),
      ('cust_b', 101, 'Sipho Dlamini', 'sipho@example.com'),
      ('cust_c', 102, 'Amahle Khumalo', 'amahle@example.com');
    INSERT INTO public.trade_jobs (
      id, company_id, customer_id, number, title, status, progress_pct
    ) VALUES
      ('job_a', 101, 'cust_a', 'J-A', 'A_JOB board', 'scheduled', 10),
      ('job_a_cancel', 101, 'cust_a', 'J-A-X', 'A_CANCELLED', 'cancelled', 0),
      ('job_b', 101, 'cust_b', 'J-B', 'B_JOB geyser', 'in_progress', 40),
      ('job_c', 102, 'cust_c', 'J-C', 'C_JOB other company', 'scheduled', 0);
    INSERT INTO public.trade_job_lines (
      id, job_id, company_id, customer_id, description, qty, unit_cents
    ) VALUES
      ('line_a', 'job_a', 101, 'cust_a', 'A_LINE', 1, 1000),
      ('line_b', 'job_b', 101, 'cust_b', 'B_LINE', 1, 2000);
    INSERT INTO public.trade_job_updates (
      id, job_id, company_id, customer_id, note, progress_pct, shared
    ) VALUES
      ('upd_a_shared', 'job_a', 101, 'cust_a', 'A_SHARED_NOTE', 10, true),
      ('upd_a_private', 'job_a', 101, 'cust_a', 'A_PRIVATE_NOTE', 10, false),
      ('upd_b', 'job_b', 101, 'cust_b', 'B_SHARED_NOTE', 40, true);
    INSERT INTO public.trade_quotes (
      id, company_id, customer_id, number, status, title
    ) VALUES
      ('q_a_sent', 101, 'cust_a', 'Q-A', 'sent', 'A_SENT'),
      ('q_a_draft', 101, 'cust_a', 'Q-A-D', 'draft', 'A_DRAFT'),
      ('q_b', 101, 'cust_b', 'Q-B', 'sent', 'B_SENT');
    INSERT INTO public.trade_quote_lines (
      id, quote_id, company_id, customer_id, description, qty, unit_cents
    ) VALUES
      ('ql_a', 'q_a_sent', 101, 'cust_a', 'A_QLINE', 1, 500),
      ('ql_b', 'q_b', 101, 'cust_b', 'B_QLINE', 1, 800);
    INSERT INTO public.trade_invoices (
      id, company_id, customer_id, job_id, number, status, subtotal_cents, vat_cents, total_cents
    ) VALUES
      ('inv_a', 101, 'cust_a', 'job_a', 'INV-A', 'issued', 10000, 1500, 11500),
      ('inv_a_void', 101, 'cust_a', 'job_a', 'INV-A-VOID', 'void', 100, 15, 115),
      ('inv_b', 101, 'cust_b', 'job_b', 'INV-B', 'issued', 20000, 3000, 23000);
    INSERT INTO public.trade_payments (
      id, company_id, customer_id, invoice_id, amount_cents, method
    ) VALUES
      ('pay_a', 101, 'cust_a', 'inv_a', 2000, 'EFT'),
      ('pay_b', 101, 'cust_b', 'inv_b', 5000, 'EFT');
    INSERT INTO public.trade_job_requests (
      id, company_id, customer_id, description, status
    ) VALUES
      ('req_a', 101, 'cust_a', 'A_REQUEST existing', 'new'),
      ('req_b', 101, 'cust_b', 'B_REQUEST existing', 'new');
    INSERT INTO public.trade_customer_sessions (
      id, company_id, customer_id, token_hash, expires_at
    ) VALUES
      (
        'sess_a', 101, 'cust_a',
        encode(extensions.digest(convert_to('${TOKEN_A}', 'UTF8'), 'sha256'), 'hex'),
        now() + interval '7 days'
      ),
      (
        'sess_b', 101, 'cust_b',
        encode(extensions.digest(convert_to('${TOKEN_B}', 'UTF8'), 'sha256'), 'hex'),
        now() + interval '7 days'
      ),
      (
        'sess_expired', 101, 'cust_a',
        encode(extensions.digest(convert_to('token-customer-a-expired-0001', 'UTF8'), 'sha256'), 'hex'),
        now() - interval '1 minute'
      ),
      (
        'sess_revoked', 101, 'cust_a',
        encode(extensions.digest(convert_to('token-customer-a-revoked-0001', 'UTF8'), 'sha256'), 'hex'),
        now() + interval '7 days'
      );
    UPDATE public.trade_customer_sessions
      SET revoked_at = now()
      WHERE id = 'sess_revoked';
  `);

  const spoofed = psql(`
    SELECT public.trade_portal_call('${TOKEN_A}', 'home', '{}'::jsonb)
    FROM (
      SELECT
        set_config('trade.customer_id', 'cust_b', false),
        set_config('trade.company_id', '102', false)
    ) cfg;
  `);
  assert.doesNotMatch(spoofed, /cannot set parameter "role"/);
  const a = JSON.parse(spoofed) as {
    brand: { brand_name: string; notify_email: string };
    customer: { id: string; name: string };
    jobs: Array<{ number: string; title: string; updates: Array<{ note: string }>; lines: Array<{ description: string }> }>;
    quotes: Array<{ title: string; lines: Array<{ description: string }> }>;
    invoices: Array<{ number: string }>;
    payments: Array<{ id: string }>;
    requests: Array<{ description: string }>;
  };
  assert.equal(a.customer.id, 'cust_a');
  assert.equal(a.customer.name, 'Thandi Nkosi');
  assert.equal(a.brand.brand_name, 'Harbour Trades');
  assert.equal(a.brand.notify_email, '');
  assert.deepEqual(a.jobs.map((job) => job.number), ['J-A']);
  assert.equal(a.jobs[0]!.lines[0]!.description, 'A_LINE');
  assert.deepEqual(a.jobs[0]!.updates.map((update) => update.note), ['A_SHARED_NOTE']);
  assert.deepEqual(a.quotes.map((quote) => quote.title), ['A_SENT']);
  assert.equal(a.quotes[0]!.lines[0]!.description, 'A_QLINE');
  assert.deepEqual(a.invoices.map((invoice) => invoice.number), ['INV-A']);
  assert.deepEqual(a.payments.map((payment) => payment.id), ['pay_a']);
  assert.deepEqual(a.requests.map((request) => request.description), ['A_REQUEST existing']);
  const aText = JSON.stringify(a);
  for (const leaked of [
    'B_JOB',
    'B_LINE',
    'B_SHARED_NOTE',
    'B_SENT',
    'B_QLINE',
    'INV-B',
    'pay_b',
    'B_REQUEST',
    'Sipho',
    'C_JOB',
    'A_PRIVATE_NOTE',
    'A_DRAFT',
    'A_CANCELLED',
    'INV-A-VOID',
    'desk-secret@example.com',
    'Other Co',
  ]) {
    assert.equal(aText.includes(leaked), false, `customer A saw ${leaked}`);
  }

  const b = home(TOKEN_B);
  const bText = JSON.stringify(b);
  assert.match(bText, /B_JOB/);
  assert.match(bText, /Sipho Dlamini/);
  for (const leaked of ['A_JOB', 'A_SHARED_NOTE', 'A_SENT', 'INV-A', 'A_REQUEST', 'Thandi', 'C_JOB']) {
    assert.equal(bText.includes(leaked), false, `customer B saw ${leaked}`);
  }

  const created = JSON.parse(
    psql(`
      SELECT public.trade_portal_call(
        '${TOKEN_A}',
        'request',
        jsonb_build_object(
          'description', 'Please fix the leaking tap today',
          'customer_id', 'cust_b',
          'company_id', 102,
          'address', '1 A Street'
        )
      );
    `)
  ) as { id: string };
  const stored = psql(`
    SELECT company_id::text || ' ' || customer_id
    FROM public.trade_job_requests
    WHERE id = '${created.id}';
  `);
  assert.equal(stored, '101 cust_a');
  const bAfter = JSON.stringify(home(TOKEN_B));
  assert.equal(bAfter.includes('Please fix the leaking tap today'), false);
  assert.match(JSON.stringify(home(TOKEN_A)), /Please fix the leaking tap today/);

  psql(`
    SELECT public.trade_portal_call(
      '${TOKEN_A}',
      'push',
      jsonb_build_object(
        'endpoint', 'https://push.example/device-a',
        'p256dh', 'key-a',
        'auth', 'auth-a',
        'customer_id', 'cust_b',
        'company_id', 102
      )
    );
  `);
  assert.equal(
    psql(`
      SELECT company_id::text || ' ' || customer_id || ' ' || p256dh
      FROM public.trade_customer_push
      WHERE endpoint = 'https://push.example/device-a';
    `),
    '101 cust_a key-a'
  );

  const caller = psql(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'portal_caller') THEN
        CREATE ROLE portal_caller NOLOGIN NOSUPERUSER NOBYPASSRLS;
      END IF;
    END $$;
    GRANT EXECUTE ON FUNCTION public.trade_portal_call(text, text, jsonb) TO portal_caller;
    SET ROLE portal_caller;
    SELECT public.trade_portal_call('${TOKEN_A}', 'home', '{}'::jsonb);
  `);
  assert.match(caller, /Thandi Nkosi/);
  assert.doesNotMatch(caller, /Sipho|cannot set parameter "role"/);

  fails(`SET ROLE anon; SELECT count(*) FROM public.trade_jobs;`, /permission denied/i);
  fails(
    `SET ROLE authenticated; SELECT count(*) FROM public.trade_customers;`,
    /permission denied/i
  );
  fails(
    `SELECT public.trade_portal_call('too-short', 'home', '{}'::jsonb);`,
    /invalid_session/
  );
  fails(
    `SELECT public.trade_portal_call('token-customer-a-expired-0001', 'home', '{}'::jsonb);`,
    /invalid_session/
  );
  fails(
    `SELECT public.trade_portal_call('token-customer-a-revoked-0001', 'home', '{}'::jsonb);`,
    /invalid_session/
  );

  console.log('trade-portal-call.test.ts ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
