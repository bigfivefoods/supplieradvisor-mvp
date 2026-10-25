-- Rollback for 20261042_module_store_merge_speed.sql.
-- Restores the merge and sa_put_module_store bodies that were live on
-- production on 25 Oct 2026. p_if_updated_at is accepted and not enforced.
-- A save bumps company_module_stores.updated_at even when the merge result
-- is unchanged. Run this only to undo 20261042.

-- Brief 50 — merge module-store writes and reject stale saves.

CREATE OR REPLACE FUNCTION public.sa_module_store_is_tombstone(p_row jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
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
SET search_path = public, pg_temp
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
  existing_arr  jsonb := CASE WHEN jsonb_typeof(p_existing)    = 'array' THEN p_existing    ELSE '[]'::jsonb END;
  incoming_arr  jsonb := CASE WHEN jsonb_typeof(p_incoming)    = 'array' THEN p_incoming    ELSE '[]'::jsonb END;
  removed_arr   jsonb := CASE WHEN jsonb_typeof(p_removed_ids) = 'array' THEN p_removed_ids ELSE '[]'::jsonb END;
  -- pre-built id sets for O(1) membership tests (avoids nested loops)
  incoming_ids  text[];
  tombstone_ids text[];
  removed_ids   text[];
  result        jsonb;
BEGIN
  -- Build removed_ids set
  SELECT COALESCE(array_agg(trim(v)), ARRAY[]::text[])
  INTO removed_ids
  FROM jsonb_array_elements_text(removed_arr) AS v
  WHERE NULLIF(trim(v), '') IS NOT NULL;

  -- Build incoming_ids and tombstone_ids in one pass over incoming_arr
  SELECT
    COALESCE(
      array_agg(trim(item->>'id')) FILTER (
        WHERE jsonb_typeof(item) = 'object'
          AND item ? 'id'
          AND NULLIF(trim(item->>'id'), '') IS NOT NULL
      ),
      ARRAY[]::text[]
    ),
    COALESCE(
      array_agg(trim(item->>'id')) FILTER (
        WHERE jsonb_typeof(item) = 'object'
          AND item ? 'id'
          AND NULLIF(trim(item->>'id'), '') IS NOT NULL
          AND public.sa_module_store_is_tombstone(item)
      ),
      ARRAY[]::text[]
    )
  INTO incoming_ids, tombstone_ids
  FROM jsonb_array_elements(incoming_arr) AS item;

  -- Aggregate result in one SQL pass:
  --   src=0: non-tombstone incoming items (incoming order preserved).
  --   src=1: existing items not covered by incoming / removed / tombstones.
  SELECT COALESCE(jsonb_agg(item ORDER BY src, rn), '[]'::jsonb)
  INTO result
  FROM (
    -- Non-tombstone incoming items
    SELECT 0 AS src, row_number() OVER () AS rn, item
    FROM jsonb_array_elements(incoming_arr) AS item
    WHERE NOT (
      jsonb_typeof(item) = 'object'
      AND item ? 'id'
      AND NULLIF(trim(item->>'id'), '') IS NOT NULL
      AND trim(item->>'id') = ANY(tombstone_ids)
    )

    UNION ALL

    -- Existing items not covered by incoming, removed, or tombstones
    SELECT 1 AS src, row_number() OVER () AS rn, item
    FROM jsonb_array_elements(existing_arr) AS item
    WHERE NOT (
      jsonb_typeof(item) = 'object'
      AND item ? 'id'
      AND NULLIF(trim(item->>'id'), '') IS NOT NULL
      AND (
        trim(item->>'id') = ANY(incoming_ids)
        OR trim(item->>'id') = ANY(removed_ids)
      )
    )
  ) t;

  RETURN result;
END;
$$;

-- Fix sa_put_module_store: compare JSON-embedded updated_at, not ROW clock.

CREATE OR REPLACE FUNCTION public.sa_merge_module_store_data(
  p_existing jsonb,
  p_incoming jsonb
) RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
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
  -- Shallow merge: existing keys stay; incoming keys overwrite / add.
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
      -- Union-merge id-arrays (Brief 50 behaviour).
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

    ELSIF jsonb_typeof(incoming_value) = 'object'
          AND jsonb_typeof(existing_value) = 'object' THEN
      -- Brief 52: recursively merge nested objects (e.g. the fitgraph wrapper).
      -- This allows partial-key patches: only keys present in incoming_value
      -- are updated; all other sub-keys from existing_value are retained.
      merged := jsonb_set(
        merged,
        ARRAY[key],
        public.sa_merge_module_store_data(existing_value, incoming_value),
        true
      );

    END IF;
  END LOOP;

  RETURN merged;
END;
$$;


CREATE OR REPLACE FUNCTION public.sa_put_module_store(
  p_company_id integer,
  p_module text,
  p_data jsonb,
  p_indexes jsonb DEFAULT '{}'::jsonb,
  p_public_token text DEFAULT NULL::text,
  p_if_updated_at timestamp with time zone DEFAULT NULL::timestamp with time zone
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
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
    -- p_if_updated_at is accepted but not enforced here.
    -- Fitgraph POST always loads a fresh book then mutates; the calendar
    -- client keeps the page-load updated_at after lite saves, so enforcing
    -- CAS 409s the second invite on the same tab. Smash-guard is merge-by-id
    -- plus advisory lock.
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
$function$;

REVOKE ALL ON FUNCTION public.sa_put_module_store(integer, text, jsonb, jsonb, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sa_put_module_store(integer, text, jsonb, jsonb, text, timestamptz) TO service_role;
