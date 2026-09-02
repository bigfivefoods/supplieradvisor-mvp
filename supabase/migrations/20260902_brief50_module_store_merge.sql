-- Brief 50 — merge module-store writes and reject stale saves.

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

REVOKE ALL ON FUNCTION public.sa_put_module_store(integer, text, jsonb, jsonb, text, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sa_put_module_store(integer, text, jsonb, jsonb, text, timestamptz)
  TO service_role;
