-- Bank middleware: connections, sync runs, match rules, provider fields on transactions.
-- Safe to re-run. Requires sa_add_column / sa_create_index helpers.

-- ── Connections (BankLink / FNB / future aggregators) ─────────────────────────
CREATE TABLE IF NOT EXISTS public.bank_connections (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  bank_account_id bigint, -- optional link to SA bank_accounts after mapping
  provider text NOT NULL DEFAULT 'banklink', -- banklink | fnb | sandbox
  external_connection_id text, -- provider connection / account id
  external_account_id text,
  status text NOT NULL DEFAULT 'pending', -- pending | active | error | revoked | expired
  bank_name text,
  account_name text,
  account_mask text, -- last 4
  currency text DEFAULT 'ZAR',
  consent_expires_at timestamptz,
  last_sync_at timestamptz,
  last_error text,
  link_session_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

SELECT public.sa_add_column('bank_connections', 'profile_id', 'bigint');
SELECT public.sa_add_column('bank_connections', 'bank_account_id', 'bigint');
SELECT public.sa_add_column('bank_connections', 'provider', 'text', '''banklink''');
SELECT public.sa_add_column('bank_connections', 'external_connection_id', 'text');
SELECT public.sa_add_column('bank_connections', 'external_account_id', 'text');
SELECT public.sa_add_column('bank_connections', 'status', 'text', '''pending''');
SELECT public.sa_add_column('bank_connections', 'bank_name', 'text');
SELECT public.sa_add_column('bank_connections', 'account_name', 'text');
SELECT public.sa_add_column('bank_connections', 'account_mask', 'text');
SELECT public.sa_add_column('bank_connections', 'currency', 'text', '''ZAR''');
SELECT public.sa_add_column('bank_connections', 'consent_expires_at', 'timestamptz');
SELECT public.sa_add_column('bank_connections', 'last_sync_at', 'timestamptz');
SELECT public.sa_add_column('bank_connections', 'last_error', 'text');
SELECT public.sa_add_column('bank_connections', 'link_session_id', 'text');
SELECT public.sa_add_column('bank_connections', 'metadata', 'jsonb', '''{}''::jsonb');
SELECT public.sa_add_column('bank_connections', 'created_by', 'text');
SELECT public.sa_add_column('bank_connections', 'updated_at', 'timestamptz', 'now()');

SELECT public.sa_create_index('idx_bank_conn_profile', 'bank_connections', 'profile_id');
SELECT public.sa_create_index('idx_bank_conn_status', 'bank_connections', 'profile_id, status');
SELECT public.sa_create_index('idx_bank_conn_external', 'bank_connections', 'provider, external_connection_id');
SELECT public.sa_create_index('idx_bank_conn_session', 'bank_connections', 'link_session_id');

-- ── Sync runs (Pulse / manual) ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bank_sync_runs (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL,
  connection_id bigint,
  bank_account_id bigint,
  provider text NOT NULL DEFAULT 'banklink',
  trigger text DEFAULT 'manual', -- manual | webhook | cron | import
  status text NOT NULL DEFAULT 'running', -- running | success | partial | error
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  fetched integer DEFAULT 0,
  inserted integer DEFAULT 0,
  duplicates integer DEFAULT 0,
  errors integer DEFAULT 0,
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb
);

SELECT public.sa_add_column('bank_sync_runs', 'profile_id', 'bigint');
SELECT public.sa_add_column('bank_sync_runs', 'connection_id', 'bigint');
SELECT public.sa_add_column('bank_sync_runs', 'bank_account_id', 'bigint');
SELECT public.sa_add_column('bank_sync_runs', 'provider', 'text', '''banklink''');
SELECT public.sa_add_column('bank_sync_runs', 'trigger', 'text', '''manual''');
SELECT public.sa_add_column('bank_sync_runs', 'status', 'text', '''running''');
SELECT public.sa_add_column('bank_sync_runs', 'started_at', 'timestamptz', 'now()');
SELECT public.sa_add_column('bank_sync_runs', 'finished_at', 'timestamptz');
SELECT public.sa_add_column('bank_sync_runs', 'fetched', 'integer', '0');
SELECT public.sa_add_column('bank_sync_runs', 'inserted', 'integer', '0');
SELECT public.sa_add_column('bank_sync_runs', 'duplicates', 'integer', '0');
SELECT public.sa_add_column('bank_sync_runs', 'errors', 'integer', '0');
SELECT public.sa_add_column('bank_sync_runs', 'error_message', 'text');
SELECT public.sa_add_column('bank_sync_runs', 'metadata', 'jsonb', '''{}''::jsonb');

SELECT public.sa_create_index('idx_bank_sync_profile', 'bank_sync_runs', 'profile_id');
SELECT public.sa_create_index('idx_bank_sync_conn', 'bank_sync_runs', 'connection_id');

-- ── Match rules (simple pattern → GL / action) ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bank_match_rules (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  priority integer NOT NULL DEFAULT 100,
  name text NOT NULL,
  match_type text NOT NULL DEFAULT 'description_contains', -- description_contains | reference_equals | amount_equals
  pattern text NOT NULL,
  target_type text NOT NULL DEFAULT 'gl_account', -- gl_account | exclude | counterparty
  target_id bigint,
  target_value text,
  is_active boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

SELECT public.sa_add_column('bank_match_rules', 'profile_id', 'bigint');
SELECT public.sa_add_column('bank_match_rules', 'priority', 'integer', '100');
SELECT public.sa_add_column('bank_match_rules', 'name', 'text');
SELECT public.sa_add_column('bank_match_rules', 'match_type', 'text', '''description_contains''');
SELECT public.sa_add_column('bank_match_rules', 'pattern', 'text');
SELECT public.sa_add_column('bank_match_rules', 'target_type', 'text', '''gl_account''');
SELECT public.sa_add_column('bank_match_rules', 'target_id', 'bigint');
SELECT public.sa_add_column('bank_match_rules', 'target_value', 'text');
SELECT public.sa_add_column('bank_match_rules', 'is_active', 'boolean', 'true');
SELECT public.sa_add_column('bank_match_rules', 'metadata', 'jsonb', '''{}''::jsonb');

SELECT public.sa_create_index('idx_bank_rules_profile', 'bank_match_rules', 'profile_id');

-- ── Transaction provider fields ───────────────────────────────────────────────
SELECT public.sa_add_column('bank_transactions', 'provider', 'text'); -- banklink | csv | pdf | sandbox
SELECT public.sa_add_column('bank_transactions', 'provider_txn_id', 'text');
SELECT public.sa_add_column('bank_transactions', 'bank_connection_id', 'bigint');
SELECT public.sa_add_column('bank_transactions', 'bank_provider', 'text'); -- legacy alias
SELECT public.sa_add_column('bank_transactions', 'sync_run_id', 'bigint');

-- Unique-ish lookup for live feeds (not strict UNIQUE — UUID legacy tables vary)
SELECT public.sa_create_index(
  'idx_bank_txn_provider_id',
  'bank_transactions',
  'profile_id, provider, provider_txn_id'
);
SELECT public.sa_create_index(
  'idx_bank_txn_connection',
  'bank_transactions',
  'bank_connection_id'
);

-- Link bank_accounts to feed source
SELECT public.sa_add_column('bank_accounts', 'connection_id', 'bigint');
SELECT public.sa_add_column('bank_accounts', 'feed_provider', 'text');
SELECT public.sa_add_column('bank_accounts', 'last_sync_at', 'timestamptz');
