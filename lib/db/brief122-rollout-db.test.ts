/**
 * Brief 122 rollout SQL on scratch Postgres only.
 * Applies the four repo migrations. Refuses any non-localhost URL and the
 * production project ref. Refuses any database whose name is not
 * brief122rollout, before DROP SCHEMA.
 *
 * Run:
 *   BRIEF122_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/brief122rollout \
 *     npx --yes tsx lib/db/brief122-rollout-db.test.ts
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const url = process.env.BRIEF122_DATABASE_URL;
if (!url) throw new Error('BRIEF122_DATABASE_URL is required');

const PRODUCTION_PROJECT_REF = 'onkklullmgrdqoertngp';
const lowerUrl = url.toLowerCase();
if (lowerUrl.includes(PRODUCTION_PROJECT_REF)) {
  throw new Error('Refusing to run: production database');
}
if (lowerUrl.includes('supabase.co') || lowerUrl.includes('supabase.com')) {
  throw new Error('Refusing to run: this fixture does not connect to Supabase');
}
let host = '';
try {
  host = new URL(url).hostname;
} catch {
  throw new Error('Refusing to run: BRIEF122_DATABASE_URL is not a URL');
}
if (host !== '127.0.0.1' && host !== 'localhost' && host !== '::1') {
  throw new Error('Refusing to run: scratch database must be localhost');
}

const indexMigration = resolve('supabase/migrations/20261024_brief122_pg_trgm_and_indexes.sql');
const b7Migration = resolve('supabase/migrations/20261025_brief122_b7_drop_duplicate_indexes.sql');
const b5Migration = resolve('supabase/migrations/20261026_brief122_b5_rls_select_wrapping.sql');
const b6Migration = resolve('supabase/migrations/20261027_brief122_b6_lockdown_definer_rpcs.sql');

function commandError(error: unknown): Error {
  const stderr =
    error && typeof error === 'object' && 'stderr' in error
      ? String((error as { stderr?: unknown }).stderr || '')
      : '';
  const message = error instanceof Error ? error.message : String(error);
  return new Error(`${message}\n${stderr}`);
}

function psql(statement: string): string {
  try {
    return execFileSync('psql', [url!, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-t', '-A'], {
      encoding: 'utf8',
      input: statement,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    throw commandError(error);
  }
}

function psqlFile(path: string, singleTransaction: boolean) {
  const args = [url!, '-X', '-v', 'ON_ERROR_STOP=1'];
  if (singleTransaction) args.push('-1');
  args.push('-f', path);
  try {
    execFileSync('psql', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    throw commandError(error);
  }
}

function failsFile(path: string, pattern: RegExp) {
  try {
    psqlFile(path, true);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    assert.match(message, pattern);
    return;
  }
  assert.fail(`expected ${path} to fail`);
}

const databaseName = psql('SELECT current_database();');
if (databaseName !== 'brief122rollout') {
  throw new Error(`Refusing to run: database must be named brief122rollout (got ${databaseName})`);
}

function reset() {
  psql(`
    DROP EVENT TRIGGER IF EXISTS ensure_rls;
    DROP SCHEMA IF EXISTS public CASCADE;
    DROP SCHEMA IF EXISTS extensions CASCADE;
    CREATE SCHEMA public;
    CREATE SCHEMA extensions;
    GRANT USAGE, CREATE ON SCHEMA public TO public;
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'trade_portal') THEN CREATE ROLE trade_portal NOLOGIN; END IF;
    END $$;
  `);
}

type Cols = Map<string, string>;

function columnsFor(statement: string): Cols {
  const cols: Cols = new Map();
  const withoutWhere = statement.replace(/\sWHERE\s[\s\S]*$/, '');
  const innerMatch = withoutWhere.match(/ON public\.\w+(?: USING \w+)? \((.*)\)\s*$/);
  if (!innerMatch) throw new Error(`cannot parse columns: ${statement}`);
  const parts: string[] = [];
  let depth = 0;
  let buf = '';
  for (const ch of innerMatch[1]) {
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) {
      parts.push(buf);
      buf = '';
    } else {
      buf += ch;
    }
  }
  parts.push(buf);
  for (const part of parts) {
    const cleaned = part.replace(/\b(extensions|gin_trgm_ops|gist_trgm_ops|btree|gin|gist|DESC|ASC)\b/g, ' ');
    const ident = cleaned.match(/[a-z_][a-z0-9_]*/);
    if (!ident) continue;
    cols.set(ident[0], ident[0] === 'metadata' ? 'jsonb' : 'text');
  }
  if (cols.size === 0) throw new Error(`no columns: ${statement}`);
  return cols;
}

function indexStatements(): { name: string; table: string; sql: string; cols: Cols }[] {
  const text = readFileSync(indexMigration, 'utf8');
  const found: { name: string; table: string; sql: string; cols: Cols }[] = [];
  const re = /EXECUTE \$sql\$(CREATE INDEX IF NOT EXISTS [\s\S]*?)\$sql\$/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    const sql = match[1];
    const name = sql.match(/CREATE INDEX IF NOT EXISTS (\w+)/)?.[1];
    const table = sql.match(/ON public\.(\w+)/)?.[1];
    if (!name || !table) throw new Error(sql);
    found.push({ name, table, sql, cols: columnsFor(sql) });
  }
  assert.equal(found.length, 113);
  return found;
}

function createStubTables(indexes: ReturnType<typeof indexStatements>, skipTable: string | null) {
  const tables = new Map<string, Cols>();
  for (const index of indexes) {
    if (index.table === skipTable) continue;
    const cols = tables.get(index.table) ?? new Map();
    for (const [name, type] of index.cols) cols.set(name, type);
    tables.set(index.table, cols);
  }
  const ddl = [...tables.entries()]
    .map(([table, cols]) => {
      const body = [...cols.entries()].map(([name, type]) => `${name} ${type}`).join(', ');
      return `CREATE TABLE public.${table} (${body});`;
    })
    .join('\n');
  psql(ddl);
}

function indexCount(names: string[]): string {
  const list = names.map((name) => `'${name}'`).join(',');
  return psql(`
    SELECT count(*)::text
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'i'
      AND c.relname = ANY (ARRAY[${list}]::text[])
      AND EXISTS (
        SELECT 1 FROM pg_index i
        WHERE i.indexrelid = c.oid AND i.indisvalid AND i.indisready
      );
  `);
}

const indexes = indexStatements();
const names = indexes.map((index) => index.name);

reset();
createStubTables(indexes, 'business_catalog');
psqlFile(indexMigration, false);
assert.equal(indexCount(names), '112');
assert.equal(psql("SELECT to_regclass('public.idx_business_catalog_profile_id_sku') IS NULL"), 't');
assert.equal(
  psql(`SELECT n.nspname FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace WHERE e.extname = 'pg_trgm'`),
  'extensions',
);

psql('CREATE TABLE public.business_catalog (profile_id text, sku text);');
psqlFile(indexMigration, true);
assert.equal(indexCount(names), '113');
psqlFile(indexMigration, true);
assert.equal(indexCount(names), '113');
assert.equal(
  psql(`
    SELECT n.nspname
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
    JOIN pg_opclass oc ON oc.oid = i.indclass[0]
    JOIN pg_namespace n ON n.oid = oc.opcnamespace
    WHERE c.relname = 'idx_profiles_legal_name_trgm'
  `),
  'extensions',
);

const pairs: { table: string; drop: string; keep: string; col: string }[] = [
  { table: 'bank_transactions', drop: 'idx_bank_txn_status2', keep: 'idx_bank_txn_status', col: 'a' },
  { table: 'business_connections', drop: 'idx_bc_requester_id', keep: 'idx_business_connections_requester', col: 'a' },
  { table: 'business_connections', drop: 'idx_connections_requester', keep: 'idx_business_connections_requester', col: 'a' },
  { table: 'business_connections', drop: 'idx_bc_requestee_id', keep: 'idx_business_connections_requestee', col: 'b' },
  { table: 'business_connections', drop: 'idx_connections_requestee', keep: 'idx_business_connections_requestee', col: 'b' },
  { table: 'company_documents', drop: 'idx_company_documents_profile_id', keep: 'idx_company_documents_profile', col: 'a' },
  { table: 'container_inventory', drop: 'idx_container_inventory_profile', keep: 'idx_container_inv_profile', col: 'a' },
  { table: 'customers', drop: 'idx_customers_profile_name', keep: 'customers_profile_trading_name', col: 'a' },
  { table: 'documents', drop: 'idx_documents_profile_id', keep: 'idx_documents_profile', col: 'a' },
  { table: 'invitations', drop: 'idx_invitations_profile_id', keep: 'idx_invitations_profile', col: 'a' },
  { table: 'nsnp_isp_agency_links', drop: 'idx_isp_agency_links_agency', keep: 'idx_nsnp_isp_agency_links_agency_status', col: 'a' },
  { table: 'nsnp_recipes', drop: 'idx_nsnp_recipes_agency_active', keep: 'idx_nsnp_recipes_agency', col: 'a' },
  { table: 'projects', drop: 'idx_projects_profile_id', keep: 'idx_projects_profile', col: 'a' },
  { table: 'purchase_orders', drop: 'idx_po_supplier_legacy', keep: 'idx_po_supplier_id', col: 'a' },
  { table: 'school_nsnp_deliveries', drop: 'idx_nsnp_deliv_isp_status', keep: 'idx_nsnp_deliv_isp', col: 'a' },
  { table: 'school_nsnp_deliveries', drop: 'idx_nsnp_deliv_school_status', keep: 'idx_nsnp_deliv_school', col: 'b' },
  { table: 'srm_suppliers', drop: 'idx_srm_suppliers_profile_updated', keep: 'srm_suppliers_profile_updated_desc', col: 'a' },
];

function installPairs() {
  const tables = new Map<string, Set<string>>();
  for (const pair of pairs) {
    const cols = tables.get(pair.table) ?? new Set();
    cols.add(pair.col);
    tables.set(pair.table, cols);
  }
  const ddl = [...tables.entries()]
    .map(([table, cols]) => `CREATE TABLE public.${table} (${[...cols].map((col) => `${col} int`).join(', ')});`)
    .join('\n');
  const indexesSql = pairs
    .flatMap((pair) => [
      `CREATE INDEX IF NOT EXISTS ${pair.keep} ON public.${pair.table} (${pair.col});`,
      `CREATE INDEX IF NOT EXISTS ${pair.drop} ON public.${pair.table} (${pair.col});`,
    ])
    .join('\n');
  psql(`${ddl}\n${indexesSql}`);
}

reset();
psqlFile(b7Migration, true);
assert.equal(psql("SELECT count(*)::text FROM pg_class WHERE relkind = 'i' AND relnamespace = 'public'::regnamespace"), '0');

reset();
installPairs();
psqlFile(b7Migration, true);
for (const pair of pairs) {
  assert.equal(psql(`SELECT to_regclass('public.${pair.drop}') IS NULL`), 't', pair.drop);
  assert.equal(psql(`SELECT to_regclass('public.${pair.keep}') IS NOT NULL`), 't', pair.keep);
}
psqlFile(b7Migration, true);
for (const pair of pairs) {
  assert.equal(psql(`SELECT to_regclass('public.${pair.drop}') IS NULL`), 't', pair.drop);
}

reset();
psql(`
  CREATE TABLE public.customers (a int, b int);
  CREATE INDEX customers_profile_trading_name ON public.customers (a);
  CREATE INDEX idx_customers_profile_name ON public.customers (b);
`);
failsFile(b7Migration, /not an exact, constraint-free duplicate/);
assert.equal(psql("SELECT to_regclass('public.idx_customers_profile_name') IS NOT NULL"), 't');

reset();
psql(`
  CREATE TABLE public.purchase_orders (a int);
  CREATE INDEX idx_po_supplier_id ON public.purchase_orders (a);
  CREATE UNIQUE INDEX idx_po_supplier_legacy ON public.purchase_orders (a);
`);
failsFile(b7Migration, /not an exact, constraint-free duplicate/);
assert.equal(psql("SELECT to_regclass('public.idx_po_supplier_legacy') IS NOT NULL"), 't');

reset();
psql(`
  CREATE TABLE public.projects (a int);
  CREATE INDEX idx_projects_profile_id ON public.projects (a);
`);
failsFile(b7Migration, /kept index idx_projects_profile missing or invalid/);
assert.equal(psql("SELECT to_regclass('public.idx_projects_profile_id') IS NOT NULL"), 't');

reset();
psql(`
  CREATE TABLE public.trade_customers (id text primary key);
  CREATE TABLE public.trade_quotes (id text primary key, customer_id text, status text);
  CREATE TABLE public.trade_quote_lines (id text primary key, customer_id text, quote_id text);
  CREATE TABLE public.trade_jobs (id text primary key, customer_id text, status text);
  CREATE TABLE public.trade_job_lines (id text primary key, customer_id text);
  CREATE TABLE public.trade_job_updates (id text primary key, customer_id text, shared boolean);
  CREATE TABLE public.trade_invoices (id text primary key, customer_id text, status text);
  CREATE TABLE public.trade_payments (id text primary key, customer_id text);
  CREATE TABLE public.trade_job_requests (id text primary key, customer_id text, company_id bigint, status text);
  CREATE TABLE public.trade_customer_push (id text primary key, customer_id text, company_id bigint);
  CREATE POLICY trade_portal_customer ON public.trade_customers FOR SELECT TO trade_portal
    USING (id = current_setting('trade.customer_id', true));
  CREATE POLICY trade_portal_quotes ON public.trade_quotes FOR SELECT TO trade_portal
    USING (customer_id = current_setting('trade.customer_id', true) AND status <> 'draft');
  CREATE POLICY trade_portal_quote_lines ON public.trade_quote_lines FOR SELECT TO trade_portal
    USING (customer_id = current_setting('trade.customer_id', true) AND EXISTS (
      SELECT 1 FROM public.trade_quotes q WHERE q.id = quote_id AND q.status <> 'draft'));
  CREATE POLICY trade_portal_jobs ON public.trade_jobs FOR SELECT TO trade_portal
    USING (customer_id = current_setting('trade.customer_id', true) AND status <> 'cancelled');
  CREATE POLICY trade_portal_job_lines ON public.trade_job_lines FOR SELECT TO trade_portal
    USING (customer_id = current_setting('trade.customer_id', true));
  CREATE POLICY trade_portal_updates ON public.trade_job_updates FOR SELECT TO trade_portal
    USING (customer_id = current_setting('trade.customer_id', true) AND shared = true);
  CREATE POLICY trade_portal_invoices ON public.trade_invoices FOR SELECT TO trade_portal
    USING (customer_id = current_setting('trade.customer_id', true) AND status <> 'void');
  CREATE POLICY trade_portal_payments ON public.trade_payments FOR SELECT TO trade_portal
    USING (customer_id = current_setting('trade.customer_id', true));
  CREATE POLICY trade_portal_requests_select ON public.trade_job_requests FOR SELECT TO trade_portal
    USING (customer_id = current_setting('trade.customer_id', true));
  CREATE POLICY trade_portal_requests_insert ON public.trade_job_requests FOR INSERT TO trade_portal
    WITH CHECK (customer_id = current_setting('trade.customer_id', true)
      AND company_id = current_setting('trade.company_id', true)::bigint AND status = 'new');
  CREATE POLICY trade_portal_push_all ON public.trade_customer_push FOR ALL TO trade_portal
    USING (customer_id = current_setting('trade.customer_id', true))
    WITH CHECK (customer_id = current_setting('trade.customer_id', true)
      AND company_id = current_setting('trade.company_id', true)::bigint);
`);
psqlFile(b5Migration, true);
psqlFile(b5Migration, true);
assert.equal(
  psql(`
    SELECT count(*)::text FROM pg_policies
    WHERE schemaname = 'public' AND policyname LIKE 'trade\\_portal\\_%'
      AND (coalesce(qual, '') || coalesce(with_check, '')) LIKE '%AS current_setting%';
  `),
  '11',
);

function nsnpFunctions() {
  psql(`
    CREATE OR REPLACE FUNCTION public.sa_nsnp_agency_summary(p_agency_profile_id bigint)
    RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
    AS $$ SELECT '{}'::jsonb $$;
    CREATE OR REPLACE FUNCTION public.sa_nsnp_geo_rollup(p_agency_profile_id bigint)
    RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
    AS $$ SELECT '{}'::jsonb $$;
    CREATE OR REPLACE FUNCTION public.sa_nsnp_network_ops(p_agency_profile_id bigint, p_day date)
    RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
    AS $$ SELECT '{}'::jsonb $$;
    GRANT EXECUTE ON FUNCTION public.sa_nsnp_agency_summary(bigint) TO anon, authenticated, service_role;
    GRANT EXECUTE ON FUNCTION public.sa_nsnp_geo_rollup(bigint) TO anon, authenticated, service_role;
    GRANT EXECUTE ON FUNCTION public.sa_nsnp_network_ops(bigint, date) TO anon, authenticated, service_role;
  `);
}

reset();
nsnpFunctions();
psqlFile(b6Migration, true);
for (const signature of [
  'public.sa_nsnp_agency_summary(bigint)',
  'public.sa_nsnp_geo_rollup(bigint)',
  'public.sa_nsnp_network_ops(bigint, date)',
]) {
  assert.equal(psql(`SELECT has_function_privilege('anon', '${signature}', 'EXECUTE')`), 'f', signature);
  assert.equal(psql(`SELECT has_function_privilege('authenticated', '${signature}', 'EXECUTE')`), 'f', signature);
  assert.equal(psql(`SELECT has_function_privilege('service_role', '${signature}', 'EXECUTE')`), 't', signature);
}
psqlFile(b6Migration, true);

reset();
nsnpFunctions();
psql(`
  CREATE OR REPLACE FUNCTION public.user_has_access_to_profile(p_profile_id bigint)
  RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT true $$;
  CREATE OR REPLACE FUNCTION public.get_current_user_id()
  RETURNS bigint LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT 1::bigint $$;
  CREATE OR REPLACE FUNCTION public.rls_auto_enable()
  RETURNS event_trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN END $$;
  GRANT EXECUTE ON FUNCTION public.user_has_access_to_profile(bigint) TO anon, authenticated, service_role;
  GRANT EXECUTE ON FUNCTION public.get_current_user_id() TO anon, authenticated, service_role;
  GRANT EXECUTE ON FUNCTION public.rls_auto_enable() TO anon, authenticated, service_role;
  CREATE EVENT TRIGGER ensure_rls ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  EXECUTE FUNCTION public.rls_auto_enable();
`);
psqlFile(b6Migration, true);
assert.equal(psql("SELECT has_function_privilege('anon', 'public.user_has_access_to_profile(bigint)', 'EXECUTE')"), 'f');
assert.equal(psql("SELECT has_function_privilege('authenticated', 'public.user_has_access_to_profile(bigint)', 'EXECUTE')"), 't');
assert.equal(psql("SELECT has_function_privilege('anon', 'public.get_current_user_id()', 'EXECUTE')"), 'f');
assert.equal(psql("SELECT has_function_privilege('authenticated', 'public.get_current_user_id()', 'EXECUTE')"), 't');
assert.equal(psql("SELECT has_function_privilege('authenticated', 'public.rls_auto_enable()', 'EXECUTE')"), 'f');
assert.equal(psql("SELECT has_function_privilege('service_role', 'public.rls_auto_enable()', 'EXECUTE')"), 't');
assert.equal(psql("SELECT evtenabled FROM pg_event_trigger WHERE evtname = 'ensure_rls'"), 'O');

reset();
psql(`
  CREATE OR REPLACE FUNCTION public.rls_auto_enable()
  RETURNS event_trigger LANGUAGE plpgsql AS $$ BEGIN END $$;
  GRANT EXECUTE ON FUNCTION public.rls_auto_enable() TO anon, authenticated, service_role;
`);
failsFile(b6Migration, /ensure_rls event trigger missing or disabled/);
assert.equal(psql("SELECT has_function_privilege('authenticated', 'public.rls_auto_enable()', 'EXECUTE')"), 't');

reset();
nsnpFunctions();
psql(`CREATE VIEW public.v_b6_dep AS SELECT public.sa_nsnp_agency_summary(1) AS summary;`);
failsFile(b6Migration, /dependent policy\/trigger\/view\/function references/);
assert.equal(psql("SELECT has_function_privilege('authenticated', 'public.sa_nsnp_agency_summary(bigint)', 'EXECUTE')"), 't');

console.log('brief122-rollout-db.test.ts ok');
