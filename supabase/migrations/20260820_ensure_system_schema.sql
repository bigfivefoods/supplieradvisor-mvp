-- One-shot: create the stores the live app needs (gym/clinic modules, chrome, settle).
-- Safe to re-run in the Supabase SQL editor.
-- After this, GymAdvisor membership saves go to company_module_stores and stay put.

-- ── Advisor module stores ─────────────────────────────────

CREATE TABLE IF NOT EXISTS public.company_module_stores (
  company_id integer NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  module text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  public_token text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, module)
);

CREATE INDEX IF NOT EXISTS idx_company_module_stores_public_token
  ON public.company_module_stores (public_token)
  WHERE public_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_company_module_stores_updated
  ON public.company_module_stores (updated_at DESC);

CREATE TABLE IF NOT EXISTS public.company_workspace (
  company_id integer PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  chrome jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.company_module_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_workspace ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS company_module_stores_deny_anon ON public.company_module_stores;
CREATE POLICY company_module_stores_deny_anon ON public.company_module_stores
  FOR ALL TO anon USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS company_workspace_deny_anon ON public.company_workspace;
CREATE POLICY company_workspace_deny_anon ON public.company_workspace
  FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE INDEX IF NOT EXISTS idx_business_users_company_user_active
  ON public.business_users (profile_id, user_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_profiles_fitgraph_public_token
  ON public.profiles ((metadata->>'fitgraph_public_token'))
  WHERE metadata ? 'fitgraph_public_token';

-- ── P0 settle tables ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.customer_invoice_payments (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL,
  invoice_id bigint NOT NULL,
  customer_id bigint NULL,
  amount numeric(18,2) NOT NULL,
  currency text NOT NULL DEFAULT 'ZAR',
  paid_at timestamptz NOT NULL DEFAULT now(),
  method text NULL DEFAULT 'manual',
  reference text NULL,
  proof_url text NULL,
  notes text NULL,
  created_by text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customer_payment_claims (
  id bigserial PRIMARY KEY,
  seller_profile_id bigint NOT NULL,
  buyer_profile_id bigint NOT NULL,
  invoice_id bigint NOT NULL,
  amount numeric(18,2) NOT NULL,
  currency text NOT NULL DEFAULT 'ZAR',
  reference text NULL,
  proof_url text NULL,
  notes text NULL,
  status text NOT NULL DEFAULT 'pending',
  claimed_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz NULL,
  resolved_by text NULL,
  ledger_payment_id bigint NULL,
  created_by text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customer_invoice_installments (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL,
  invoice_id bigint NOT NULL,
  customer_id bigint NULL,
  sequence_no int NOT NULL DEFAULT 1,
  due_date date NOT NULL,
  amount numeric(18,2) NOT NULL,
  currency text NOT NULL DEFAULT 'ZAR',
  status text NOT NULL DEFAULT 'open',
  amount_paid numeric(18,2) NOT NULL DEFAULT 0,
  paid_at timestamptz NULL,
  ledger_payment_id bigint NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ar_payments_profile_paid
  ON public.customer_invoice_payments (profile_id, paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_ar_payments_invoice
  ON public.customer_invoice_payments (invoice_id, paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_claims_seller_status
  ON public.customer_payment_claims (seller_profile_id, status, claimed_at DESC);
CREATE INDEX IF NOT EXISTS idx_installments_invoice
  ON public.customer_invoice_installments (invoice_id, sequence_no);

-- ── RPCs ──────────────────────────────────────────────────

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

CREATE OR REPLACE FUNCTION public.sa_put_module_store(
  p_company_id integer,
  p_module text,
  p_data jsonb,
  p_indexes jsonb DEFAULT '{}'::jsonb,
  p_public_token text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  idx jsonb;
BEGIN
  PERFORM public.sa_assert_advisor_module(p_module);
  IF p_company_id IS NULL OR p_company_id <= 0 THEN
    RAISE EXCEPTION 'company id required';
  END IF;
  idx := public.sa_module_index_patch(p_module, p_indexes);

  INSERT INTO public.company_module_stores (
    company_id, module, data, public_token, updated_at
  )
  VALUES (
    p_company_id,
    p_module,
    COALESCE(p_data, '{}'::jsonb),
    NULLIF(trim(COALESCE(p_public_token, '')), ''),
    now()
  )
  ON CONFLICT (company_id, module) DO UPDATE
    SET
      data = EXCLUDED.data,
      public_token = EXCLUDED.public_token,
      updated_at = now();

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

-- Copy existing gym/clinic blobs into module rows once (never overwrite a live row).
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

CREATE OR REPLACE FUNCTION public.sa_ensure_system_schema()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n_stores integer;
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

  SELECT count(*) INTO n_stores FROM public.company_module_stores;
  RETURN jsonb_build_object(
    'ok', true,
    'module_store_rows', n_stores
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sa_merge_profile_metadata(integer, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sa_get_profile_metadata_keys(integer, text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sa_get_company_chrome(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sa_put_company_chrome(integer, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sa_assert_advisor_module(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sa_module_index_patch(text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sa_get_module_store(integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sa_put_module_store(integer, text, jsonb, jsonb, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sa_find_company_by_token_index(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sa_ensure_system_schema() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.sa_merge_profile_metadata(integer, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.sa_get_profile_metadata_keys(integer, text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.sa_get_company_chrome(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.sa_put_company_chrome(integer, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.sa_assert_advisor_module(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.sa_module_index_patch(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.sa_get_module_store(integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.sa_put_module_store(integer, text, jsonb, jsonb, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.sa_find_company_by_token_index(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.sa_ensure_system_schema() TO service_role;

SELECT public.sa_ensure_system_schema();
