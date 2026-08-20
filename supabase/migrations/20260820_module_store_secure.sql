-- Tighten module RPCs after 20260820_ensure_system_schema.sql.
-- Safe to re-run. Allowlists module keys, strips non-token indexes,
-- and looks up public/member/coach tokens without scanning profiles.metadata.

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

COMMENT ON FUNCTION public.sa_put_module_store(integer, text, jsonb, jsonb, text) IS
  'Write one Advisor module row. Metadata only gets allowlisted token indexes.';
COMMENT ON FUNCTION public.sa_find_company_by_token_index(text, text) IS
  'Resolve company id from a public/member/coach token index without scanning metadata blobs.';

REVOKE ALL ON FUNCTION public.sa_assert_advisor_module(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sa_module_index_patch(text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sa_get_module_store(integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sa_put_module_store(integer, text, jsonb, jsonb, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sa_find_company_by_token_index(text, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.sa_assert_advisor_module(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.sa_module_index_patch(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.sa_get_module_store(integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.sa_put_module_store(integer, text, jsonb, jsonb, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.sa_find_company_by_token_index(text, text) TO service_role;
