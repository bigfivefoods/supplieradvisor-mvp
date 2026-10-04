-- SaaS reliability: Paystack webhook idempotency, serialize module-store
-- writes, extra token indexes. Safe to re-run after 20260821_saas_db_harden.sql.
-- Paste in the Supabase SQL editor. SELECT sa_ensure_reliability();

SET statement_timeout = 0;

CREATE TABLE IF NOT EXISTS public.paystack_webhook_events (
  reference text NOT NULL,
  event text NOT NULL,
  handled text,
  first_at timestamptz NOT NULL DEFAULT now(),
  last_at timestamptz NOT NULL DEFAULT now(),
  hits integer NOT NULL DEFAULT 1,
  PRIMARY KEY (reference, event)
);

CREATE INDEX IF NOT EXISTS idx_paystack_webhook_events_last
  ON public.paystack_webhook_events (last_at DESC);

CREATE OR REPLACE FUNCTION public.sa_claim_paystack_webhook(
  p_reference text,
  p_event text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec public.paystack_webhook_events%ROWTYPE;
  ref text;
  ev text;
BEGIN
  ref := NULLIF(trim(COALESCE(p_reference, '')), '');
  ev := NULLIF(trim(COALESCE(p_event, '')), '');
  IF ref IS NULL OR ev IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'first', true, 'hits', 0);
  END IF;

  INSERT INTO public.paystack_webhook_events (reference, event, hits, first_at, last_at)
  VALUES (ref, ev, 1, now(), now())
  ON CONFLICT (reference, event) DO UPDATE
    SET
      hits = public.paystack_webhook_events.hits + 1,
      last_at = now()
  RETURNING * INTO rec;

  RETURN jsonb_build_object(
    'ok', true,
    'first', rec.hits = 1,
    'hits', rec.hits,
    'handled', rec.handled
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sa_mark_paystack_webhook(
  p_reference text,
  p_event text,
  p_handled text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.paystack_webhook_events
  SET handled = NULLIF(trim(COALESCE(p_handled, '')), ''), last_at = now()
  WHERE reference = NULLIF(trim(COALESCE(p_reference, '')), '')
    AND event = NULLIF(trim(COALESCE(p_event, '')), '');
END;
$$;

-- Serialize gym/clinic store writes so two desk saves cannot interleave
-- on the same (company, module) row, with stale-write rejection.
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
  merged jsonb := '{}'::jsonb;
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

CREATE OR REPLACE FUNCTION public.sa_ensure_reliability()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n_idx integer := 0;
  idx_result text;
  stmt text;
  statements text[];
BEGIN
  statements := ARRAY[
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_company_module_stores_public_token_uid ON public.company_module_stores (public_token) WHERE public_token IS NOT NULL',
    'CREATE INDEX IF NOT EXISTS idx_company_module_stores_updated ON public.company_module_stores (updated_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_profiles_psychiatrygraph_patient_tokens ON public.profiles USING gin ((metadata -> ''psychiatrygraph_patient_tokens'')) WHERE metadata ? ''psychiatrygraph_patient_tokens''',
    'CREATE INDEX IF NOT EXISTS idx_profiles_dentalgraph_patient_tokens ON public.profiles USING gin ((metadata -> ''dentalgraph_patient_tokens'')) WHERE metadata ? ''dentalgraph_patient_tokens''',
    'CREATE INDEX IF NOT EXISTS idx_profiles_hiregraph_customer_tokens ON public.profiles USING gin ((metadata -> ''hiregraph_customer_tokens'')) WHERE metadata ? ''hiregraph_customer_tokens''',
    'CREATE INDEX IF NOT EXISTS idx_profiles_fitgraph_staff_tokens ON public.profiles USING gin ((metadata -> ''fitgraph_staff_tokens'')) WHERE metadata ? ''fitgraph_staff_tokens''',
    'CREATE INDEX IF NOT EXISTS idx_profiles_physiograph_staff_tokens ON public.profiles USING gin ((metadata -> ''physiograph_staff_tokens'')) WHERE metadata ? ''physiograph_staff_tokens''',
    'CREATE INDEX IF NOT EXISTS idx_profiles_medicalgraph_staff_tokens ON public.profiles USING gin ((metadata -> ''medicalgraph_staff_tokens'')) WHERE metadata ? ''medicalgraph_staff_tokens''',
    'CREATE INDEX IF NOT EXISTS idx_profiles_psychiatrygraph_staff_tokens ON public.profiles USING gin ((metadata -> ''psychiatrygraph_staff_tokens'')) WHERE metadata ? ''psychiatrygraph_staff_tokens''',
    'CREATE INDEX IF NOT EXISTS idx_profiles_dentalgraph_staff_tokens ON public.profiles USING gin ((metadata -> ''dentalgraph_staff_tokens'')) WHERE metadata ? ''dentalgraph_staff_tokens''',
    'CREATE INDEX IF NOT EXISTS idx_profiles_physiograph_public_token ON public.profiles ((metadata->>''physiograph_public_token'')) WHERE metadata ? ''physiograph_public_token''',
    'CREATE INDEX IF NOT EXISTS idx_profiles_medicalgraph_public_token ON public.profiles ((metadata->>''medicalgraph_public_token'')) WHERE metadata ? ''medicalgraph_public_token''',
    'CREATE INDEX IF NOT EXISTS idx_profiles_psychiatrygraph_public_token ON public.profiles ((metadata->>''psychiatrygraph_public_token'')) WHERE metadata ? ''psychiatrygraph_public_token''',
    'CREATE INDEX IF NOT EXISTS idx_profiles_dentalgraph_public_token ON public.profiles ((metadata->>''dentalgraph_public_token'')) WHERE metadata ? ''dentalgraph_public_token''',
    'CREATE INDEX IF NOT EXISTS idx_customers_profile_email ON public.customers (profile_id, lower(email)) WHERE email IS NOT NULL AND length(trim(email)) > 3',
    'CREATE INDEX IF NOT EXISTS idx_business_users_active_email ON public.business_users (lower(email)) WHERE status = ''active'' AND email IS NOT NULL',
    'CREATE INDEX IF NOT EXISTS idx_business_users_active_invited_email ON public.business_users (lower(invited_email)) WHERE status = ''active'' AND invited_email IS NOT NULL'
  ];
  FOREACH stmt IN ARRAY statements
  LOOP
    BEGIN
      EXECUTE stmt;
      n_idx := n_idx + 1;
    EXCEPTION WHEN others THEN
      NULL;
    END;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'sa_lock_table' AND pg_function_is_visible(oid)
  ) THEN
    PERFORM public.sa_lock_table('paystack_webhook_events');
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'trade_portals'
    ) THEN
      PERFORM public.sa_lock_table('trade_portals');
      PERFORM public.sa_lock_table('trade_portal_viewers');
    END IF;
  END IF;

  BEGIN
    GRANT ALL ON TABLE public.paystack_webhook_events TO service_role;
  EXCEPTION WHEN others THEN
    NULL;
  END;

  RETURN jsonb_build_object('ok', true, 'hot_indexes_ok', n_idx);
END;
$$;

REVOKE ALL ON FUNCTION public.sa_claim_paystack_webhook(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sa_mark_paystack_webhook(text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sa_ensure_reliability() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.paystack_webhook_events FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.sa_claim_paystack_webhook(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.sa_mark_paystack_webhook(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.sa_ensure_reliability() TO service_role;
GRANT ALL ON TABLE public.paystack_webhook_events TO service_role;

SELECT public.sa_ensure_reliability();

NOTIFY pgrst, 'reload schema';
