-- Rollback for 20261042_module_store_merge_speed.sql.
--
-- These five bodies are the live production definitions captured read-only
-- with pg_get_functiondef on 25 Oct 2026. prosrc md5:
--   sa_module_store_is_tombstone          a1fa9f1006f43099033541056f37c3ba
--   sa_module_store_array_has_id_object   2e993cb3a5bfc16424bc61e70ebb4115
--   sa_module_store_merge_id_array        4b0dff0790ca5fb1a7ef0731aa45e8dd
--   sa_merge_module_store_data            1a593b9b43e244f9ab544095118a8c55
--   sa_put_module_store                   cb2bbcc9b4b097e9d724ef8933b09994
--
-- sa_put_module_store selects updated_at and updates the row on every save.
-- p_if_updated_at is accepted and not enforced. Run this only to undo 20261042.

CREATE OR REPLACE FUNCTION public.sa_module_store_is_tombstone(p_row jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF p_row IS NULL OR jsonb_typeof(p_row) <> 'object' THEN RETURN false; END IF;
  RETURN COALESCE((p_row ->> '_deleted')::boolean, false)
    OR COALESCE((p_row ->> 'deleted')::boolean, false)
    OR COALESCE((p_row ->> 'is_deleted')::boolean, false)
    OR (p_row ? 'deleted_at' AND NULLIF(trim(COALESCE(p_row ->> 'deleted_at', '')), '') IS NOT NULL);
EXCEPTION WHEN others THEN RETURN false;
END;$function$;

CREATE OR REPLACE FUNCTION public.sa_module_store_array_has_id_object(p_value jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE item jsonb;
BEGIN
  IF p_value IS NULL OR jsonb_typeof(p_value) <> 'array' THEN RETURN false; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_value) LOOP
    IF jsonb_typeof(item) = 'object' AND item ? 'id' AND NULLIF(trim(COALESCE(item ->> 'id', '')), '') IS NOT NULL THEN
      RETURN true;
    END IF;
  END LOOP;
  RETURN false;
END;$function$;

CREATE OR REPLACE FUNCTION public.sa_module_store_merge_id_array(p_existing jsonb, p_incoming jsonb, p_removed_ids jsonb DEFAULT '[]'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  WITH incoming_arr AS (
    SELECT ordinality, value AS item
    FROM jsonb_array_elements(
      CASE
        WHEN p_incoming IS NOT NULL AND jsonb_typeof(p_incoming) = 'array' THEN p_incoming
        ELSE '[]'::jsonb
      END
    ) WITH ORDINALITY
  ),
  existing_arr AS (
    SELECT ordinality, value AS item
    FROM jsonb_array_elements(
      CASE
        WHEN p_existing IS NOT NULL AND jsonb_typeof(p_existing) = 'array' THEN p_existing
        ELSE '[]'::jsonb
      END
    ) WITH ORDINALITY
  ),
  removed AS (
    SELECT trim(value) AS id
    FROM jsonb_array_elements_text(
      CASE
        WHEN p_removed_ids IS NOT NULL AND jsonb_typeof(p_removed_ids) = 'array' THEN p_removed_ids
        ELSE '[]'::jsonb
      END
    )
    WHERE NULLIF(trim(value), '') IS NOT NULL
  ),
  existing_by_id AS (
    SELECT DISTINCT ON (trim(item ->> 'id'))
      trim(item ->> 'id') AS id,
      item
    FROM existing_arr
    WHERE jsonb_typeof(item) = 'object'
      AND item ? 'id'
      AND NULLIF(trim(COALESCE(item ->> 'id', '')), '') IS NOT NULL
    ORDER BY trim(item ->> 'id'), ordinality
  ),
  incoming_ids AS (
    SELECT trim(item ->> 'id') AS id
    FROM incoming_arr
    WHERE jsonb_typeof(item) = 'object'
      AND item ? 'id'
      AND NULLIF(trim(COALESCE(item ->> 'id', '')), '') IS NOT NULL
  ),
  incoming_tombstones AS (
    SELECT trim(item ->> 'id') AS id
    FROM incoming_arr
    WHERE jsonb_typeof(item) = 'object'
      AND item ? 'id'
      AND NULLIF(trim(COALESCE(item ->> 'id', '')), '') IS NOT NULL
      AND public.sa_module_store_is_tombstone(item)
  ),
  kept_incoming AS (
    SELECT
      i.ordinality,
      CASE
        WHEN jsonb_typeof(i.item) = 'object'
          AND i.item ? 'id'
          AND NULLIF(trim(COALESCE(i.item ->> 'id', '')), '') IS NOT NULL
          AND e.item IS NOT NULL
        THEN e.item || i.item
        ELSE i.item
      END AS item,
      1 AS src
    FROM incoming_arr i
    LEFT JOIN existing_by_id e
      ON e.id = trim(i.item ->> 'id')
    WHERE NOT (
      jsonb_typeof(i.item) = 'object'
      AND i.item ? 'id'
      AND NULLIF(trim(COALESCE(i.item ->> 'id', '')), '') IS NOT NULL
      AND public.sa_module_store_is_tombstone(i.item)
    )
  ),
  kept_existing AS (
    SELECT ordinality, item, 2 AS src
    FROM existing_arr
    WHERE NOT (
      jsonb_typeof(item) = 'object'
      AND item ? 'id'
      AND NULLIF(trim(COALESCE(item ->> 'id', '')), '') IS NOT NULL
      AND (
        trim(item ->> 'id') IN (SELECT id FROM incoming_ids)
        OR trim(item ->> 'id') IN (SELECT id FROM removed)
        OR trim(item ->> 'id') IN (SELECT id FROM incoming_tombstones)
      )
    )
  )
  SELECT COALESCE(
    jsonb_agg(item ORDER BY src, ordinality),
    '[]'::jsonb
  )
  FROM (
    SELECT ordinality, item, src FROM kept_incoming
    UNION ALL
    SELECT ordinality, item, src FROM kept_existing
  ) combined;
$function$;

CREATE OR REPLACE FUNCTION public.sa_merge_module_store_data(p_existing jsonb, p_incoming jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  existing_data jsonb := COALESCE(p_existing, '{}'::jsonb);
  incoming_data jsonb := COALESCE(p_incoming, '{}'::jsonb);
  merged jsonb;
  removed_map jsonb := COALESCE(incoming_data -> 'removed_ids', '{}'::jsonb);
  key text; incoming_value jsonb; existing_value jsonb; removed_ids jsonb;
BEGIN
  IF jsonb_typeof(existing_data) <> 'object' THEN existing_data := '{}'::jsonb; END IF;
  IF jsonb_typeof(incoming_data) <> 'object' THEN incoming_data := '{}'::jsonb; END IF;
  merged := existing_data || incoming_data;
  FOR key IN SELECT jsonb_object_keys(incoming_data) LOOP
    incoming_value := incoming_data -> key;
    existing_value := existing_data -> key;
    IF jsonb_typeof(incoming_value) = 'array' AND (
      key IN ('goals','clients','bookings','sessions','coaches','programmes','programme_logs','visit_notes','treatment_plans','class_feedback','check_ins','membership_plans','pt_packs','subscriptions','movements')
      OR public.sa_module_store_array_has_id_object(incoming_value)
      OR public.sa_module_store_array_has_id_object(existing_value)
    ) THEN
      removed_ids := CASE WHEN jsonb_typeof(removed_map) = 'object' THEN COALESCE(removed_map -> key, '[]'::jsonb) ELSE '[]'::jsonb END;
      merged := jsonb_set(merged, ARRAY[key], public.sa_module_store_merge_id_array(existing_value, incoming_value, removed_ids), true);
    END IF;
  END LOOP;
  RETURN merged;
END;$function$;

CREATE OR REPLACE FUNCTION public.sa_put_module_store(p_company_id integer, p_module text, p_data jsonb, p_indexes jsonb DEFAULT '{}'::jsonb, p_public_token text DEFAULT NULL::text, p_if_updated_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
    -- plus advisory lock. Brief 52 restores CAS once the client applies
    -- updated_at from every POST.
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
