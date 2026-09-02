-- SaaS harden: re-lock tenant tables, unique keys, hot-path indexes,
-- atomic document numbers, secure module RPCs.
-- Safe to re-run in the Supabase SQL editor.
-- After 20260820_ensure_system_schema.sql (module stores), paste THIS file.
-- SELECT sa_ensure_system_schema() returns
--   {"ok":true,"module_store_rows":N,"tables_locked":N,...}

SET statement_timeout = 0;

CREATE TABLE IF NOT EXISTS public.company_module_stores (
  company_id integer NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  module text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  public_token text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, module)
);

CREATE TABLE IF NOT EXISTS public.company_workspace (
  company_id integer PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  chrome jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── Lock helper (same contract as 20260714; needed if that file was skipped) ─

CREATE OR REPLACE FUNCTION public.sa_lock_table(p_table text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pol record;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = p_table AND table_type = 'BASE TABLE'
  ) THEN
    RETURN;
  END IF;

  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', p_table);
  BEGIN
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', p_table);
  EXCEPTION WHEN others THEN
    NULL;
  END;

  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = p_table
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, p_table);
  END LOOP;

  EXECUTE format(
    'CREATE POLICY %I ON public.%I FOR ALL TO anon USING (false) WITH CHECK (false)',
    'sa_deny_anon', p_table
  );
  EXECUTE format(
    'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (false) WITH CHECK (false)',
    'sa_deny_authenticated', p_table
  );

  BEGIN
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', p_table);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', p_table);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM authenticated', p_table);
  EXCEPTION WHEN others THEN
    NULL;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.sa_try_index(p_sql text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  EXECUTE p_sql;
  RETURN 'ok';
EXCEPTION WHEN others THEN
  RETURN SQLERRM;
END;
$$;

CREATE OR REPLACE FUNCTION public.sa_restore_geo_public_read()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['continents', 'countries', 'provinces']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t AND table_type = 'BASE TABLE'
    ) THEN
      CONTINUE;
    END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    BEGIN
      EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXCEPTION WHEN others THEN
      NULL;
    END;
    EXECUTE format('DROP POLICY IF EXISTS sa_deny_anon ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS sa_deny_authenticated ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_public_select', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO anon, authenticated USING (true)',
      t || '_public_select', t
    );
    EXECUTE format(
      'CREATE POLICY sa_deny_anon ON public.%I FOR INSERT TO anon WITH CHECK (false)',
      t
    );
    EXECUTE format(
      'CREATE POLICY sa_deny_authenticated ON public.%I FOR INSERT TO authenticated WITH CHECK (false)',
      t
    );
    BEGIN
      EXECUTE format('GRANT SELECT ON TABLE public.%I TO anon, authenticated', t);
    EXCEPTION WHEN others THEN
      NULL;
    END;
  END LOOP;
END;
$$;

-- ── Secure module RPCs (win over 20260820_module_store_indexes_only) ─────────

CREATE OR REPLACE FUNCTION public.sa_assert_advisor_module(p_module text)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF p_module IS NULL OR p_module NOT IN (
    'fitgraph',
    'physiograph',
    'medicalgraph',
    'psychiatrygraph',
    'dentalgraph',
    'hiregraph',
    'retailgraph',
    'fieldgraph',
    'quarrygraph'
  ) THEN
    RAISE EXCEPTION 'unknown advisor module';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.sa_module_index_patch(
  p_module text,
  p_indexes jsonb
) RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT jsonb_object_agg(e.key, e.value)
      FROM jsonb_each(COALESCE(p_indexes, '{}'::jsonb)) AS e
      WHERE e.key LIKE p_module || '\_%' ESCAPE '\'
        AND (
          e.key LIKE '%\_token' ESCAPE '\'
          OR e.key LIKE '%\_tokens' ESCAPE '\'
        )
    ),
    '{}'::jsonb
  );
$$;

CREATE OR REPLACE FUNCTION public.sa_merge_profile_metadata(
  p_company_id integer,
  p_patch jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_company_id IS NULL OR p_company_id <= 0 THEN
    RAISE EXCEPTION 'company id required';
  END IF;
  UPDATE public.profiles
  SET
    metadata = COALESCE(metadata, '{}'::jsonb) || COALESCE(p_patch, '{}'::jsonb),
    updated_at = now()
  WHERE id = p_company_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sa_get_profile_metadata_keys(
  p_company_id integer,
  p_keys text[]
) RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT jsonb_object_agg(k, p.metadata -> k)
      FROM unnest(COALESCE(p_keys, ARRAY[]::text[])) AS k
    ),
    '{}'::jsonb
  )
  FROM public.profiles p
  WHERE p.id = p_company_id;
$$;

CREATE OR REPLACE FUNCTION public.sa_get_company_chrome(p_company_id integer)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ws jsonb;
  profile_chrome jsonb;
  keys text[] := ARRAY[
    'enabled_modules',
    'user_sidebar_orders',
    'os_entity_type',
    'os_sector',
    'os_industry',
    'os_industries',
    'os_business_type_id',
    'os_business_type_ids',
    'industry_packs',
    'industry_modules',
    'setup_status',
    'setup_path'
  ];
BEGIN
  profile_chrome := public.sa_get_profile_metadata_keys(p_company_id, keys);
  SELECT chrome INTO ws
  FROM public.company_workspace
  WHERE company_id = p_company_id;
  RETURN COALESCE(profile_chrome, '{}'::jsonb) || COALESCE(ws, '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.sa_put_company_chrome(
  p_company_id integer,
  p_chrome jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.company_workspace (company_id, chrome, updated_at)
  VALUES (p_company_id, COALESCE(p_chrome, '{}'::jsonb), now())
  ON CONFLICT (company_id) DO UPDATE
    SET
      chrome = COALESCE(public.company_workspace.chrome, '{}'::jsonb)
        || COALESCE(EXCLUDED.chrome, '{}'::jsonb),
      updated_at = now();
  PERFORM public.sa_merge_profile_metadata(p_company_id, COALESCE(p_chrome, '{}'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION public.sa_get_module_store(
  p_company_id integer,
  p_module text
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row_data jsonb;
BEGIN
  PERFORM public.sa_assert_advisor_module(p_module);
  IF p_company_id IS NULL OR p_company_id <= 0 THEN
    RAISE EXCEPTION 'company id required';
  END IF;
  SELECT data INTO row_data
  FROM public.company_module_stores
  WHERE company_id = p_company_id AND module = p_module;
  IF row_data IS NOT NULL THEN
    RETURN jsonb_build_object(p_module, row_data);
  END IF;
  RETURN public.sa_get_profile_metadata_keys(p_company_id, ARRAY[p_module]);
END;
$$;

CREATE OR REPLACE FUNCTION public.sa_module_store_is_tombstone(p_row jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_row IS NULL OR jsonb_typeof(p_row) <> 'object' THEN
    RETURN false;
  END IF;
  RETURN COALESCE((p_row ->> '_deleted')::boolean, false)
    OR COALESCE((p_row ->> 'deleted')::boolean, false)
    OR COALESCE((p_row ->> 'is_deleted')::boolean, false)
    OR (
      p_row ? 'deleted_at'
      AND NULLIF(trim(COALESCE(p_row ->> 'deleted_at', '')), '') IS NOT NULL
    );
EXCEPTION WHEN others THEN
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.sa_module_store_array_has_id_object(p_value jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  item jsonb;
BEGIN
  IF p_value IS NULL OR jsonb_typeof(p_value) <> 'array' THEN
    RETURN false;
  END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_value)
  LOOP
    IF jsonb_typeof(item) = 'object' AND item ? 'id'
       AND NULLIF(trim(COALESCE(item ->> 'id', '')), '') IS NOT NULL THEN
      RETURN true;
    END IF;
  END LOOP;
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.sa_module_store_merge_id_array(
  p_existing jsonb,
  p_incoming jsonb,
  p_removed_ids jsonb DEFAULT '[]'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  merged jsonb := '[]'::jsonb;
  existing_arr jsonb := CASE
    WHEN p_existing IS NOT NULL AND jsonb_typeof(p_existing) = 'array' THEN p_existing
    ELSE '[]'::jsonb
  END;
  incoming_arr jsonb := CASE
    WHEN p_incoming IS NOT NULL AND jsonb_typeof(p_incoming) = 'array' THEN p_incoming
    ELSE '[]'::jsonb
  END;
  removed_arr jsonb := CASE
    WHEN p_removed_ids IS NOT NULL AND jsonb_typeof(p_removed_ids) = 'array' THEN p_removed_ids
    ELSE '[]'::jsonb
  END;
  incoming_ids text[] := ARRAY[]::text[];
  removed_ids text[] := ARRAY[]::text[];
  tombstone_ids text[] := ARRAY[]::text[];
  item jsonb;
  item_id text;
BEGIN
  FOR item_id IN SELECT value FROM jsonb_array_elements_text(removed_arr)
  LOOP
    IF NULLIF(trim(COALESCE(item_id, '')), '') IS NOT NULL THEN
      removed_ids := array_append(removed_ids, trim(item_id));
    END IF;
  END LOOP;

  FOR item IN SELECT value FROM jsonb_array_elements(incoming_arr)
  LOOP
    IF jsonb_typeof(item) = 'object' AND item ? 'id'
       AND NULLIF(trim(COALESCE(item ->> 'id', '')), '') IS NOT NULL THEN
      item_id := trim(item ->> 'id');
      incoming_ids := array_append(incoming_ids, item_id);
      IF public.sa_module_store_is_tombstone(item) THEN
        tombstone_ids := array_append(tombstone_ids, item_id);
      ELSE
        merged := merged || jsonb_build_array(item);
      END IF;
    ELSE
      merged := merged || jsonb_build_array(item);
    END IF;
  END LOOP;

  FOR item IN SELECT value FROM jsonb_array_elements(existing_arr)
  LOOP
    IF jsonb_typeof(item) = 'object' AND item ? 'id'
       AND NULLIF(trim(COALESCE(item ->> 'id', '')), '') IS NOT NULL THEN
      item_id := trim(item ->> 'id');
      IF item_id = ANY(incoming_ids)
         OR item_id = ANY(removed_ids)
         OR item_id = ANY(tombstone_ids) THEN
        CONTINUE;
      END IF;
      merged := merged || jsonb_build_array(item);
    ELSE
      merged := merged || jsonb_build_array(item);
    END IF;
  END LOOP;

  RETURN merged;
END;
$$;

CREATE OR REPLACE FUNCTION public.sa_merge_module_store_data(
  p_existing jsonb,
  p_incoming jsonb
) RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  existing_data jsonb := COALESCE(p_existing, '{}'::jsonb);
  incoming_data jsonb := COALESCE(p_incoming, '{}'::jsonb);
  merged jsonb := existing_data || incoming_data;
  removed_map jsonb := COALESCE(incoming_data -> 'removed_ids', '{}'::jsonb);
  key text;
  incoming_value jsonb;
  existing_value jsonb;
  removed_ids jsonb;
BEGIN
  IF jsonb_typeof(existing_data) <> 'object' THEN
    existing_data := '{}'::jsonb;
  END IF;
  IF jsonb_typeof(incoming_data) <> 'object' THEN
    incoming_data := '{}'::jsonb;
  END IF;
  merged := existing_data || incoming_data;

  FOR key IN SELECT jsonb_object_keys(incoming_data)
  LOOP
    incoming_value := incoming_data -> key;
    existing_value := existing_data -> key;
    IF jsonb_typeof(incoming_value) = 'array'
       AND (
         key IN (
           'goals',
           'clients',
           'bookings',
           'sessions',
           'coaches',
           'programmes',
           'programme_logs',
           'visit_notes',
           'treatment_plans',
           'class_feedback',
           'check_ins',
           'membership_plans',
           'pt_packs',
           'subscriptions',
           'movements'
         )
         OR public.sa_module_store_array_has_id_object(incoming_value)
         OR public.sa_module_store_array_has_id_object(existing_value)
       ) THEN
      removed_ids := CASE
        WHEN jsonb_typeof(removed_map) = 'object'
          THEN COALESCE(removed_map -> key, '[]'::jsonb)
        ELSE '[]'::jsonb
      END;
      merged := jsonb_set(
        merged,
        ARRAY[key],
        public.sa_module_store_merge_id_array(
          existing_value,
          incoming_value,
          removed_ids
        ),
        true
      );
    END IF;
  END LOOP;

  RETURN merged;
END;
$$;

DROP FUNCTION IF EXISTS public.sa_put_module_store(integer, text, jsonb, jsonb, text);

CREATE OR REPLACE FUNCTION public.sa_put_module_store(
  p_company_id integer,
  p_module text,
  p_data jsonb,
  p_indexes jsonb DEFAULT '{}'::jsonb,
  p_public_token text DEFAULT NULL,
  p_if_updated_at timestamptz DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  idx jsonb;
  incoming_data jsonb;
  incoming_token text;
  existing_data jsonb;
  existing_updated_at timestamptz;
  existing_public_token text;
BEGIN
  PERFORM public.sa_assert_advisor_module(p_module);
  IF p_company_id IS NULL OR p_company_id <= 0 THEN
    RAISE EXCEPTION 'company id required';
  END IF;
  PERFORM pg_advisory_xact_lock(p_company_id, hashtext(p_module));

  idx := public.sa_module_index_patch(p_module, p_indexes);
  incoming_data := COALESCE(p_data, '{}'::jsonb);
  IF jsonb_typeof(incoming_data) <> 'object' THEN
    incoming_data := '{}'::jsonb;
  END IF;
  incoming_token := NULLIF(trim(COALESCE(p_public_token, '')), '');

  SELECT data, updated_at, public_token
  INTO existing_data, existing_updated_at, existing_public_token
  FROM public.company_module_stores
  WHERE company_id = p_company_id AND module = p_module
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.company_module_stores (
      company_id, module, data, public_token, updated_at
    )
    VALUES (
      p_company_id,
      p_module,
      incoming_data,
      incoming_token,
      now()
    );
  ELSE
    IF p_if_updated_at IS NOT NULL
       AND existing_updated_at IS NOT NULL
       AND existing_updated_at > p_if_updated_at THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'stale_module_store',
        DETAIL = existing_updated_at::text,
        HINT = 'Refresh and retry with the latest store snapshot';
    END IF;

    UPDATE public.company_module_stores
    SET
      data = public.sa_merge_module_store_data(existing_data, incoming_data),
      public_token = COALESCE(incoming_token, existing_public_token),
      updated_at = now()
    WHERE company_id = p_company_id AND module = p_module;
  END IF;

  IF idx <> '{}'::jsonb THEN
    PERFORM public.sa_merge_profile_metadata(p_company_id, idx);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.sa_find_company_by_token_index(
  p_index_key text,
  p_token text
) RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cid integer;
  tok text;
BEGIN
  tok := NULLIF(trim(COALESCE(p_token, '')), '');
  IF tok IS NULL OR length(tok) < 8 THEN
    RETURN NULL;
  END IF;
  IF p_index_key IS NULL OR p_index_key NOT IN (
    'fitgraph_public_token',
    'fitgraph_coach_tokens',
    'fitgraph_client_tokens',
    'physiograph_patient_tokens',
    'physiograph_staff_tokens',
    'medicalgraph_patient_tokens',
    'medicalgraph_staff_tokens',
    'psychiatrygraph_patient_tokens',
    'psychiatrygraph_staff_tokens',
    'dentalgraph_patient_tokens',
    'dentalgraph_staff_tokens',
    'hiregraph_customer_tokens',
    'hiregraph_public_token',
    'retailgraph_public_token'
  ) THEN
    RAISE EXCEPTION 'unknown token index';
  END IF;

  IF p_index_key LIKE '%_public_token' THEN
    SELECT s.company_id INTO cid
    FROM public.company_module_stores s
    WHERE s.public_token = tok
    LIMIT 1;
    IF cid IS NOT NULL THEN
      RETURN cid;
    END IF;
  END IF;

  IF p_index_key LIKE '%_tokens' THEN
    SELECT p.id INTO cid
    FROM public.profiles p
    WHERE p.metadata -> p_index_key ? tok
    LIMIT 1;
  ELSE
    SELECT p.id INTO cid
    FROM public.profiles p
    WHERE p.metadata ->> p_index_key = tok
    LIMIT 1;
  END IF;
  RETURN cid;
END;
$$;

-- ── Atomic invoice / journal numbers (two posters cannot share a number) ─────

CREATE OR REPLACE FUNCTION public.sa_next_document_number(
  p_company_id integer,
  p_kind text
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n int;
  prefix text;
BEGIN
  IF p_company_id IS NULL OR p_company_id <= 0 THEN
    RAISE EXCEPTION 'company id required';
  END IF;
  IF p_kind IS NULL OR p_kind NOT IN ('ar', 'ap', 'journal') THEN
    RAISE EXCEPTION 'unknown document kind';
  END IF;

  BEGIN
    INSERT INTO public.accounting_settings (profile_id)
    VALUES (p_company_id)
    ON CONFLICT (profile_id) DO NOTHING;
  EXCEPTION WHEN unique_violation THEN
    NULL;
  WHEN others THEN
    NULL;
  END;

  IF p_kind = 'ar' THEN
    UPDATE public.accounting_settings
    SET
      next_ar_number = COALESCE(next_ar_number, 1001) + 1,
      updated_at = now()
    WHERE profile_id = p_company_id
    RETURNING next_ar_number - 1, COALESCE(NULLIF(trim(invoice_prefix_ar), ''), 'INV')
    INTO n, prefix;
  ELSIF p_kind = 'ap' THEN
    UPDATE public.accounting_settings
    SET
      next_ap_number = COALESCE(next_ap_number, 1001) + 1,
      updated_at = now()
    WHERE profile_id = p_company_id
    RETURNING next_ap_number - 1, COALESCE(NULLIF(trim(invoice_prefix_ap), ''), 'BILL')
    INTO n, prefix;
  ELSE
    UPDATE public.accounting_settings
    SET
      next_journal_number = COALESCE(next_journal_number, 1) + 1,
      updated_at = now()
    WHERE profile_id = p_company_id
    RETURNING next_journal_number - 1, COALESCE(NULLIF(trim(journal_prefix), ''), 'JE')
    INTO n, prefix;
  END IF;

  IF n IS NULL THEN
    RAISE EXCEPTION 'accounting_settings row missing';
  END IF;
  RETURN prefix || '-' || lpad(n::text, 5, '0');
END;
$$;

-- ── Journal line FK (orphan lines cannot outlive the header) ─────────────────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'journal_lines'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'journal_entries'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'journal_lines_journal_entry_id_fkey'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.journal_lines jl
      WHERE jl.journal_entry_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.journal_entries je WHERE je.id = jl.journal_entry_id
        )
    ) THEN
      ALTER TABLE public.journal_lines
        ADD CONSTRAINT journal_lines_journal_entry_id_fkey
        FOREIGN KEY (journal_entry_id)
        REFERENCES public.journal_entries(id)
        ON DELETE CASCADE;
    END IF;
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'journal_lines FK skip: %', SQLERRM;
END $$;

-- ── Ensure: stores + lock + uniques + hot indexes ────────────────────────────

CREATE OR REPLACE FUNCTION public.sa_ensure_system_schema()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n_stores integer := 0;
  n_locked integer := 0;
  n_unique_ok integer := 0;
  n_unique_skip integer := 0;
  n_idx integer := 0;
  r record;
  idx_result text;
  statements text[];
  stmt text;
BEGIN
  -- Module store rows (never overwrite a live gym/clinic row)
  BEGIN
    INSERT INTO public.company_module_stores (company_id, module, data, public_token, updated_at)
    SELECT
      p.id,
      m.module,
      COALESCE(p.metadata -> m.module, '{}'::jsonb),
      NULLIF(trim(COALESCE(p.metadata ->> (m.module || '_public_token'), '')), ''),
      now()
    FROM public.profiles p
    CROSS JOIN (
      VALUES
        ('fitgraph'),
        ('physiograph'),
        ('medicalgraph'),
        ('psychiatrygraph'),
        ('dentalgraph'),
        ('hiregraph'),
        ('retailgraph'),
        ('fieldgraph'),
        ('quarrygraph')
    ) AS m(module)
    WHERE p.metadata ? m.module
      AND jsonb_typeof(p.metadata -> m.module) = 'object'
    ON CONFLICT (company_id, module) DO NOTHING;
  EXCEPTION WHEN others THEN
    NULL;
  END;

  BEGIN
    SELECT count(*) INTO n_stores FROM public.company_module_stores;
  EXCEPTION WHEN others THEN
    n_stores := 0;
  END;

  -- Re-lock every public table (drops USING true / authenticated-open policies)
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT LIKE 'pg_%'
    ORDER BY tablename
  LOOP
    PERFORM public.sa_lock_table(r.tablename);
    n_locked := n_locked + 1;
  END LOOP;
  PERFORM public.sa_restore_geo_public_read();

  BEGIN
    GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
  EXCEPTION WHEN others THEN
    NULL;
  END;

  -- Unique keys: skip if live duplicates would fail the index
  statements := ARRAY[
    'CREATE UNIQUE INDEX IF NOT EXISTS uq_coa_profile_code ON public.chart_of_accounts (profile_id, code)',
    'CREATE UNIQUE INDEX IF NOT EXISTS uq_tax_rates_profile_code ON public.tax_rates (profile_id, code)',
    'CREATE UNIQUE INDEX IF NOT EXISTS uq_acc_entities_profile_code ON public.accounting_entities (profile_id, code)',
    'CREATE UNIQUE INDEX IF NOT EXISTS uq_je_profile_entry_number ON public.journal_entries (profile_id, entry_number) WHERE entry_number IS NOT NULL AND length(trim(entry_number)) > 0',
    'CREATE UNIQUE INDEX IF NOT EXISTS uq_bank_txn_account_external ON public.bank_transactions (profile_id, bank_account_id, external_id) WHERE external_id IS NOT NULL AND length(trim(external_id)) > 0',
    'CREATE UNIQUE INDEX IF NOT EXISTS uq_bank_txn_account_provider_id ON public.bank_transactions (profile_id, bank_account_id, provider_txn_id) WHERE provider_txn_id IS NOT NULL AND length(trim(provider_txn_id)) > 0',
    'CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_invoices_profile_number ON public.customer_invoices (profile_id, invoice_number) WHERE invoice_number IS NOT NULL AND length(trim(invoice_number)) > 0',
    'CREATE UNIQUE INDEX IF NOT EXISTS uq_business_users_profile_user ON public.business_users (profile_id, user_id) WHERE user_id IS NOT NULL AND length(trim(user_id)) > 0',
    'CREATE UNIQUE INDEX IF NOT EXISTS uq_business_users_invite_token ON public.business_users (invite_token) WHERE invite_token IS NOT NULL AND length(trim(invite_token)) > 0',
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_company_module_stores_public_token_uid ON public.company_module_stores (public_token) WHERE public_token IS NOT NULL'
  ];
  FOREACH stmt IN ARRAY statements
  LOOP
    idx_result := public.sa_try_index(stmt);
    IF idx_result = 'ok' THEN
      n_unique_ok := n_unique_ok + 1;
    ELSE
      n_unique_skip := n_unique_skip + 1;
    END IF;
  END LOOP;

  -- Hot-path indexes (tenant + status / date)
  statements := ARRAY[
    'CREATE INDEX IF NOT EXISTS idx_je_profile_status_date ON public.journal_entries (profile_id, status, entry_date)',
    'CREATE INDEX IF NOT EXISTS idx_jl_entry ON public.journal_lines (journal_entry_id)',
    'CREATE INDEX IF NOT EXISTS idx_jl_profile ON public.journal_lines (profile_id)',
    'CREATE INDEX IF NOT EXISTS idx_bank_txn_alloc ON public.bank_transactions (profile_id, allocation_status)',
    'CREATE INDEX IF NOT EXISTS idx_bank_txn_status ON public.bank_transactions (profile_id, status)',
    'CREATE INDEX IF NOT EXISTS idx_customer_invoices_profile_status ON public.customer_invoices (profile_id, status)',
    'CREATE INDEX IF NOT EXISTS idx_customer_invoices_profile_customer_status ON public.customer_invoices (profile_id, customer_id, status)',
    'CREATE INDEX IF NOT EXISTS idx_customer_invoices_profile_due ON public.customer_invoices (profile_id, due_date)',
    'CREATE INDEX IF NOT EXISTS idx_opportunities_profile_stage ON public.opportunities (profile_id, stage)',
    'CREATE INDEX IF NOT EXISTS idx_opportunities_profile_expected_close ON public.opportunities (profile_id, expected_close_date)',
    'CREATE INDEX IF NOT EXISTS idx_opportunities_profile_actual_close ON public.opportunities (profile_id, actual_close_date)',
    'CREATE INDEX IF NOT EXISTS idx_leads_profile_status ON public.leads (profile_id, status)',
    'CREATE INDEX IF NOT EXISTS idx_crm_activities_profile ON public.crm_activities (profile_id)',
    'CREATE INDEX IF NOT EXISTS idx_business_users_company_user_active ON public.business_users (profile_id, user_id) WHERE status = ''active''',
    'CREATE INDEX IF NOT EXISTS idx_profiles_fitgraph_public_token ON public.profiles ((metadata->>''fitgraph_public_token'')) WHERE metadata ? ''fitgraph_public_token''',
    'CREATE INDEX IF NOT EXISTS idx_profiles_hiregraph_public_token ON public.profiles ((metadata->>''hiregraph_public_token'')) WHERE metadata ? ''hiregraph_public_token''',
    'CREATE INDEX IF NOT EXISTS idx_profiles_retailgraph_public_token ON public.profiles ((metadata->>''retailgraph_public_token'')) WHERE metadata ? ''retailgraph_public_token''',
    'CREATE INDEX IF NOT EXISTS idx_profiles_fitgraph_coach_tokens ON public.profiles USING gin ((metadata -> ''fitgraph_coach_tokens'')) WHERE metadata ? ''fitgraph_coach_tokens''',
    'CREATE INDEX IF NOT EXISTS idx_profiles_fitgraph_client_tokens ON public.profiles USING gin ((metadata -> ''fitgraph_client_tokens'')) WHERE metadata ? ''fitgraph_client_tokens''',
    'CREATE INDEX IF NOT EXISTS idx_profiles_physiograph_patient_tokens ON public.profiles USING gin ((metadata -> ''physiograph_patient_tokens'')) WHERE metadata ? ''physiograph_patient_tokens''',
    'CREATE INDEX IF NOT EXISTS idx_profiles_medicalgraph_patient_tokens ON public.profiles USING gin ((metadata -> ''medicalgraph_patient_tokens'')) WHERE metadata ? ''medicalgraph_patient_tokens'''
  ];
  FOREACH stmt IN ARRAY statements
  LOOP
    idx_result := public.sa_try_index(stmt);
    IF idx_result = 'ok' THEN
      n_idx := n_idx + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'module_store_rows', n_stores,
    'tables_locked', n_locked,
    'unique_indexes_ok', n_unique_ok,
    'unique_indexes_skipped', n_unique_skip,
    'hot_indexes_ok', n_idx
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sa_lock_table(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sa_try_index(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sa_restore_geo_public_read() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sa_assert_advisor_module(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sa_module_index_patch(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sa_get_module_store(integer, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sa_put_module_store(integer, text, jsonb, jsonb, text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sa_find_company_by_token_index(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sa_next_document_number(integer, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sa_ensure_system_schema() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sa_merge_profile_metadata(integer, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sa_get_profile_metadata_keys(integer, text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sa_get_company_chrome(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sa_put_company_chrome(integer, jsonb) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.sa_lock_table(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.sa_try_index(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.sa_restore_geo_public_read() TO service_role;
GRANT EXECUTE ON FUNCTION public.sa_assert_advisor_module(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.sa_module_index_patch(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.sa_get_module_store(integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.sa_put_module_store(integer, text, jsonb, jsonb, text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.sa_find_company_by_token_index(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.sa_next_document_number(integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.sa_ensure_system_schema() TO service_role;
GRANT EXECUTE ON FUNCTION public.sa_merge_profile_metadata(integer, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.sa_get_profile_metadata_keys(integer, text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.sa_get_company_chrome(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.sa_put_company_chrome(integer, jsonb) TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;

SELECT public.sa_ensure_system_schema();

NOTIFY pgrst, 'reload schema';
