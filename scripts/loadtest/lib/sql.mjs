import { BASE_VOLUME, resolveSeedSize, peerCount, S2_SCALE, S2_TAIL_MULTIPLIER, userCountSql, WHALE_COUNT, WHALE_MULTIPLIER } from './distribution.mjs';
import { assertBatchId } from './guard.mjs';

export const SEEDED_TABLES = [
  'profiles',
  'business_users',
  'business_connections',
  'customers',
  'products',
  'customer_invoices',
  'purchase_orders',
  'chart_of_accounts',
  'journal_entries',
  'journal_lines',
  'bank_accounts',
  'bank_transactions',
  'activity_log',
  'stock_levels',
  'company_module_stores',
];

export const REQUIRED_COLUMNS = {
  profiles: ['id', 'trading_name', 'legal_name', 'email', 'supplier_status', 'user_id', 'metadata', 'created_at'],
  business_users: ['user_id', 'profile_id', 'role', 'status', 'email', 'name', 'metadata'],
  business_connections: ['requester_profile_id', 'requestee_profile_id', 'status', 'connection_type', 'metadata'],
  customers: ['profile_id', 'trading_name', 'email', 'phone', 'status', 'metadata'],
  products: ['profile_id', 'name', 'sku', 'category', 'uom', 'status', 'metadata'],
  customer_invoices: ['profile_id', 'invoice_number', 'status', 'currency', 'total_amount', 'contact_email', 'notes'],
  purchase_orders: ['buyer_profile_id', 'metadata'],
  chart_of_accounts: ['profile_id', 'code', 'name', 'account_type', 'metadata'],
  journal_entries: ['profile_id', 'entry_number', 'entry_date', 'memo', 'status', 'metadata'],
  journal_lines: ['journal_entry_id', 'profile_id', 'account_id', 'debit', 'credit'],
  bank_accounts: ['profile_id', 'name', 'metadata'],
  bank_transactions: ['profile_id', 'bank_account_id', 'txn_date', 'amount', 'metadata'],
  activity_log: ['profile_id', 'action', 'metadata'],
  stock_levels: ['profile_id', 'qty_on_hand'],
  company_module_stores: ['company_id', 'module', 'data'],
};

export function missingColumns(present, required = REQUIRED_COLUMNS) {
  const missing = [];
  for (const [table, cols] of Object.entries(required)) {
    const have = present[table] || new Set();
    for (const col of cols) {
      if (!have.has(col)) missing.push(`${table}.${col}`);
    }
  }
  return missing;
}

function volumeCase(column, profile, size) {
  const base = BASE_VOLUME[column];
  const typical = profile === 's2' ? base * S2_SCALE : base;
  const whale = typical * WHALE_MULTIPLIER;
  const heavy = base * S2_TAIL_MULTIPLIER;
  if (column === 'activity_log' && size && size.activityPerCompany != null) {
    return String(size.activityPerCompany);
  }
  if (profile === 's2') {
    return `CASE WHEN n <= ${WHALE_COUNT} THEN ${whale} WHEN n % 20 = 0 THEN ${heavy} ELSE ${typical} END`;
  }
  return `CASE WHEN n <= ${WHALE_COUNT} THEN ${whale} ELSE ${base} END`;
}

const PROFILE_CREATED_AT = "TIMESTAMPTZ '2024-01-01 00:00:00+00'";

export function renderSeedSql(profile, batch, sizeInput = {}) {
  assertBatchId(batch);
  if (profile !== 's1' && profile !== 's2') throw new Error('profile must be s1 or s2');
  const size = resolveSeedSize(sizeInput);
  const companies = size.companies;
  const peers = peerCount(size);
  const userCase = userCountSql(size);
  const moduleCase = `3 + ((n - 1) % 4)`;
  const bytesCase = `CASE WHEN n % 50 = 0 THEN ${400 * 1024} WHEN n % 10 = 0 THEN ${50 * 1024} ELSE ${5 * 1024} END`;
  return `-- Staging seed. Generated for profile ${profile}, batch ${batch}.
-- Do not execute this file on its own. scripts/loadtest/seed.mjs is the only entry.
-- The wrapper refuses a production project before psql starts. This SQL does not.
BEGIN;

DO $guard$
DECLARE
  existing bigint;
BEGIN
  SELECT count(*) INTO existing
  FROM public.profiles
  WHERE metadata->>'loadtest' = '${batch}'
    AND metadata->>'kind' = 'company';
  IF existing = ${companies} THEN
    RAISE EXCEPTION 'LOADTEST_ALREADY_SEEDED';
  END IF;
  IF existing > 0 THEN
    RAISE EXCEPTION 'partial loadtest batch ${batch}; run seed-teardown before retrying';
  END IF;
END
$guard$;

CREATE TEMP TABLE loadtest_company (
  n integer PRIMARY KEY,
  id bigint NOT NULL,
  user_n integer NOT NULL,
  customer_n integer NOT NULL,
  product_n integer NOT NULL,
  invoice_n integer NOT NULL,
  po_n integer NOT NULL,
  journal_n integer NOT NULL,
  line_n integer NOT NULL,
  bank_n integer NOT NULL,
  activity_n integer NOT NULL,
  stock_n integer NOT NULL,
  module_n integer NOT NULL,
  module_bytes integer NOT NULL
) ON COMMIT DROP;

WITH inserted AS (
  INSERT INTO public.profiles (trading_name, legal_name, email, supplier_status, user_id, metadata, created_at)
  SELECT
    'Loadtest Company ' || n,
    'Loadtest Company ' || n || ' Legal',
    'company' || n || '@loadtest.invalid',
    'active',
    'loadtest-owner-' || n,
    jsonb_build_object(
      'loadtest', '${batch}',
      'kind', 'company',
      'ordinal', n,
      'store_slug', 'loadtest-co-' || n,
      'enabled_modules', (
        SELECT jsonb_agg('mod' || m ORDER BY m)
        FROM generate_series(1, ${moduleCase}) AS m
      )
    ),
    ${PROFILE_CREATED_AT}
  FROM generate_series(1, ${companies}) AS n
  RETURNING id, (metadata->>'ordinal')::integer AS n
)
INSERT INTO loadtest_company (n, id, user_n, customer_n, product_n, invoice_n, po_n, journal_n, line_n, bank_n, activity_n, stock_n, module_n, module_bytes)
SELECT
  n,
  id,
  ${userCase},
  ${volumeCase('customers', profile)},
  ${volumeCase('products', profile)},
  ${volumeCase('customer_invoices', profile)},
  ${volumeCase('purchase_orders', profile)},
  ${volumeCase('journal_entries', profile)},
  ${volumeCase('journal_lines', profile)},
  ${volumeCase('bank_transactions', profile)},
  ${volumeCase('activity_log', profile, size)},
  ${volumeCase('stock_levels', profile)},
  ${moduleCase},
  ${bytesCase}
FROM inserted;

INSERT INTO public.profiles (trading_name, legal_name, email, supplier_status, user_id, metadata, created_at)
SELECT
  'Loadtest Peer ' || n,
  'Loadtest Peer ' || n || ' Legal',
  'peer' || n || '@loadtest.invalid',
  'active',
  'loadtest-peer-' || n,
  jsonb_build_object('loadtest', '${batch}', 'kind', 'peer', 'ordinal', n),
  ${PROFILE_CREATED_AT}
FROM generate_series(1, ${peers}) AS n;

INSERT INTO public.business_connections (
  requester_profile_id, requestee_profile_id, status, connection_type, metadata
)
SELECT c.id, peer.id, 'active', 'partner', jsonb_build_object('loadtest', '${batch}')
FROM public.profiles AS peer
JOIN loadtest_company AS c
  ON c.n = ((peer.metadata->>'ordinal')::integer - 1) % ${companies} + 1
WHERE peer.metadata->>'loadtest' = '${batch}'
  AND peer.metadata->>'kind' = 'peer';

INSERT INTO public.business_users (user_id, profile_id, role, status, email, name, metadata)
SELECT
  'loadtest-user-' || c.n || '-' || u.i,
  c.id,
  CASE
    WHEN u.i = 1 THEN 'owner'
    ELSE (ARRAY['admin','member','viewer','finance','operations','sales','sales_contractor'])[1 + ((u.i - 2) % 7)]
  END,
  CASE WHEN numbered.rn % 20 = 0 THEN 'pending' ELSE 'active' END,
  'user' || c.n || 'x' || u.i || '@loadtest.invalid',
  'Loadtest User ' || c.n || ' ' || u.i,
  jsonb_build_object('loadtest', '${batch}')
FROM loadtest_company AS c
JOIN LATERAL generate_series(1, c.user_n) AS u(i) ON true
JOIN (
  SELECT c2.n AS company_n, u2.i AS user_i, row_number() OVER (ORDER BY c2.n, u2.i) AS rn
  FROM loadtest_company AS c2
  JOIN LATERAL generate_series(1, c2.user_n) AS u2(i) ON true
) AS numbered ON numbered.company_n = c.n AND numbered.user_i = u.i;

INSERT INTO public.customers (profile_id, trading_name, email, phone, status, metadata)
SELECT
  c.id,
  'Loadtest Customer ' || c.n || ' ' || g.i,
  'customer' || c.n || 'x' || g.i || '@loadtest.invalid',
  '+999' || lpad((c.n * 1000 + g.i)::text, 8, '0'),
  'active',
  jsonb_build_object('loadtest', '${batch}')
FROM loadtest_company AS c
JOIN LATERAL generate_series(1, c.customer_n) AS g(i) ON true;

INSERT INTO public.products (profile_id, name, sku, category, uom, status, metadata)
SELECT
  c.id,
  'Loadtest Product ' || c.n || ' ' || g.i,
  'lt-' || c.n || '-' || g.i,
  'General',
  'unit',
  'active',
  jsonb_build_object('loadtest', '${batch}')
FROM loadtest_company AS c
JOIN LATERAL generate_series(1, c.product_n) AS g(i) ON true;

INSERT INTO public.customer_invoices (
  profile_id, invoice_number, status, currency, total_amount, contact_email, notes
)
SELECT
  c.id,
  'LT-' || c.n || '-' || g.i,
  'draft',
  'ZAR',
  0,
  'invoice' || c.n || 'x' || g.i || '@loadtest.invalid',
  'loadtest:' || '${batch}'
FROM loadtest_company AS c
JOIN LATERAL generate_series(1, c.invoice_n) AS g(i) ON true;

INSERT INTO public.purchase_orders (buyer_profile_id, metadata)
SELECT c.id, jsonb_build_object('loadtest', '${batch}', 'ordinal', g.i)
FROM loadtest_company AS c
JOIN LATERAL generate_series(1, c.po_n) AS g(i) ON true;

INSERT INTO public.chart_of_accounts (profile_id, code, name, account_type, metadata)
SELECT c.id, a.code, a.name, a.kind, jsonb_build_object('loadtest', '${batch}')
FROM loadtest_company AS c
CROSS JOIN (
  VALUES
    ('1000', 'Loadtest cash', 'asset'),
    ('2000', 'Loadtest payables', 'liability'),
    ('3000', 'Loadtest equity', 'equity'),
    ('4000', 'Loadtest sales', 'income')
) AS a(code, name, kind);

INSERT INTO public.journal_entries (profile_id, entry_number, entry_date, memo, status, metadata)
SELECT
  c.id,
  'LTJ-' || c.n || '-' || g.i,
  DATE '2024-01-01',
  'loadtest',
  'draft',
  jsonb_build_object('loadtest', '${batch}', 'ordinal', g.i)
FROM loadtest_company AS c
JOIN LATERAL generate_series(1, c.journal_n) AS g(i) ON true;

INSERT INTO public.journal_lines (journal_entry_id, profile_id, account_id, debit, credit)
SELECT e.id, e.profile_id, acct.id,
  CASE g.i WHEN 1 THEN 1 WHEN 2 THEN 1 ELSE 0 END,
  CASE g.i WHEN 3 THEN 2 ELSE 0 END
FROM public.journal_entries AS e
JOIN loadtest_company AS c ON c.id = e.profile_id
JOIN LATERAL generate_series(1, 3) AS g(i) ON true
JOIN public.chart_of_accounts AS acct
  ON acct.profile_id = e.profile_id
 AND acct.metadata->>'loadtest' = '${batch}'
 AND acct.code = CASE g.i WHEN 3 THEN '4000' ELSE '1000' END
WHERE e.metadata->>'loadtest' = '${batch}';

CREATE TEMP TABLE loadtest_bank (
  profile_id bigint PRIMARY KEY,
  id bigint NOT NULL
) ON COMMIT DROP;

WITH inserted AS (
  INSERT INTO public.bank_accounts (profile_id, name, metadata)
  SELECT c.id, 'Loadtest bank', jsonb_build_object('loadtest', '${batch}')
  FROM loadtest_company AS c
  RETURNING id, profile_id
)
INSERT INTO loadtest_bank (profile_id, id)
SELECT profile_id, id FROM inserted;

INSERT INTO public.bank_transactions (profile_id, bank_account_id, txn_date, amount, metadata)
SELECT c.id, b.id, DATE '2024-01-01', 0, jsonb_build_object('loadtest', '${batch}', 'ordinal', g.i)
FROM loadtest_company AS c
JOIN loadtest_bank AS b ON b.profile_id = c.id
JOIN LATERAL generate_series(1, c.bank_n) AS g(i) ON true;

INSERT INTO public.activity_log (profile_id, action, metadata)
SELECT c.id, 'loadtest', jsonb_build_object('loadtest', '${batch}', 'ordinal', g.i)
FROM loadtest_company AS c
JOIN LATERAL generate_series(1, c.activity_n) AS g(i) ON true;

INSERT INTO public.stock_levels (profile_id, qty_on_hand)
SELECT c.id, g.i
FROM loadtest_company AS c
JOIN LATERAL generate_series(1, c.stock_n) AS g(i) ON true;

INSERT INTO public.company_module_stores (company_id, module, data)
SELECT c.id::integer, 'mod' || g.i,
  jsonb_build_object('loadtest', '${batch}', 'pad', repeat('x', c.module_bytes))
FROM loadtest_company AS c
JOIN LATERAL generate_series(1, c.module_n) AS g(i) ON true;

ANALYZE public.profiles;
ANALYZE public.business_users;
ANALYZE public.business_connections;
ANALYZE public.customers;
ANALYZE public.products;
ANALYZE public.customer_invoices;
ANALYZE public.purchase_orders;
ANALYZE public.chart_of_accounts;
ANALYZE public.journal_entries;
ANALYZE public.journal_lines;
ANALYZE public.bank_accounts;
ANALYZE public.bank_transactions;
ANALYZE public.activity_log;
ANALYZE public.stock_levels;
ANALYZE public.company_module_stores;

COMMIT;

COPY (
  SELECT c.relname AS table_name,
         pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
         pg_size_pretty(pg_relation_size(c.oid)) AS table_size,
         pg_size_pretty(pg_indexes_size(c.oid)) AS index_size
  FROM pg_class AS c
  JOIN pg_namespace AS n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relname = ANY (ARRAY[
      'profiles', 'business_users', 'business_connections', 'customers', 'products',
      'customer_invoices', 'purchase_orders', 'chart_of_accounts', 'journal_entries',
      'journal_lines', 'bank_accounts', 'bank_transactions', 'activity_log', 'stock_levels',
      'company_module_stores'
    ])
  ORDER BY c.relname
) TO STDOUT WITH (FORMAT csv, HEADER true);
`;
}

export function renderTeardownSql(batch) {
  assertBatchId(batch);
  return `-- Deletes rows for batch ${batch} only.
BEGIN;

CREATE TEMP TABLE loadtest_profile_ids ON COMMIT DROP AS
SELECT id FROM public.profiles WHERE metadata->>'loadtest' = '${batch}';

DELETE FROM public.journal_lines
WHERE profile_id IN (SELECT id FROM loadtest_profile_ids);

DELETE FROM public.journal_entries
WHERE metadata->>'loadtest' = '${batch}'
   OR profile_id IN (SELECT id FROM loadtest_profile_ids);

DELETE FROM public.bank_transactions
WHERE metadata->>'loadtest' = '${batch}'
   OR profile_id IN (SELECT id FROM loadtest_profile_ids);

DELETE FROM public.bank_accounts
WHERE metadata->>'loadtest' = '${batch}'
   OR profile_id IN (SELECT id FROM loadtest_profile_ids);

DELETE FROM public.activity_log
WHERE metadata->>'loadtest' = '${batch}'
   OR profile_id IN (SELECT id FROM loadtest_profile_ids);

DELETE FROM public.stock_levels
WHERE profile_id IN (SELECT id FROM loadtest_profile_ids);

DELETE FROM public.customer_invoices
WHERE notes = 'loadtest:${batch}'
   OR profile_id IN (SELECT id FROM loadtest_profile_ids);

DELETE FROM public.purchase_orders
WHERE metadata->>'loadtest' = '${batch}'
   OR buyer_profile_id IN (SELECT id FROM loadtest_profile_ids);

DELETE FROM public.chart_of_accounts
WHERE metadata->>'loadtest' = '${batch}'
   OR profile_id IN (SELECT id FROM loadtest_profile_ids);

DELETE FROM public.products
WHERE metadata->>'loadtest' = '${batch}'
   OR profile_id IN (SELECT id FROM loadtest_profile_ids);

DELETE FROM public.customers
WHERE metadata->>'loadtest' = '${batch}'
   OR profile_id IN (SELECT id FROM loadtest_profile_ids);

DELETE FROM public.company_module_stores
WHERE data->>'loadtest' = '${batch}'
   OR company_id IN (SELECT id FROM loadtest_profile_ids);

DELETE FROM public.business_connections
WHERE metadata->>'loadtest' = '${batch}'
   OR requester_profile_id IN (SELECT id FROM loadtest_profile_ids)
   OR requestee_profile_id IN (SELECT id FROM loadtest_profile_ids);

DELETE FROM public.business_users
WHERE metadata->>'loadtest' = '${batch}'
   OR profile_id IN (SELECT id FROM loadtest_profile_ids);

DELETE FROM public.profiles
WHERE metadata->>'loadtest' = '${batch}';

COMMIT;

SELECT 'profiles' AS table_name, count(*) AS remaining
FROM public.profiles WHERE metadata->>'loadtest' = '${batch}';
`;
}

export function interpretPsql(stderr, status) {
  const text = String(stderr || '');
  if (text.includes('LOADTEST_ALREADY_SEEDED')) {
    return { exitCode: 0, alreadySeeded: true };
  }
  if (status === 0) return { exitCode: 0, alreadySeeded: false };
  return { exitCode: 1, alreadySeeded: false };
}

/**
 * Columns a seed INSERT must name: NOT NULL, no default, not an identity,
 * not generated. `snapshot` is the pinned information_schema extract.
 */
export function notNullWithoutDefault(snapshot) {
  const out = {};
  const tables = snapshot && snapshot.tables ? snapshot.tables : {};
  for (const [table, columns] of Object.entries(tables)) {
    const need = [];
    for (const col of columns) {
      if (!col || col.nullable !== 'NO') continue;
      if (col.identity === 'YES') continue;
      if (col.generated && col.generated !== 'NEVER') continue;
      if (col.default != null && String(col.default).trim() !== '') continue;
      if (col.column) need.push(col.column);
    }
    if (need.length) out[table] = need;
  }
  return out;
}

export function omittedNotNullColumns(sql, snapshot, tables = SEEDED_TABLES) {
  const required = notNullWithoutDefault(snapshot);
  const inserts = new Map();
  const re = /INSERT INTO public\.([a-z0-9_]+)\s*\(([^)]*)\)/gi;
  for (const match of String(sql).matchAll(re)) {
    const table = match[1];
    const cols = match[2].split(',').map((part) => part.trim()).filter(Boolean);
    if (!inserts.has(table)) inserts.set(table, []);
    inserts.get(table).push(new Set(cols));
  }
  const missing = [];
  for (const table of tables) {
    const need = required[table] || [];
    const groups = inserts.get(table) || [];
    if (groups.length === 0) {
      if (need.length) missing.push(`${table}.*`);
      continue;
    }
    for (const col of need) {
      if (groups.some((have) => !have.has(col))) missing.push(`${table}.${col}`);
    }
  }
  return missing;
}

export function redactSecrets(text, databaseUrl) {
  let out = String(text || '');
  if (databaseUrl) out = out.split(databaseUrl).join('[redacted-url]');
  return out.replace(/postgres(?:ql)?:\/\/[^@\s]+@/gi, 'postgres://[redacted]@');
}
