-- Faster sa_put_module_store with the same merge result as production.
--
-- Read-only pg_get_functiondef on 25 Oct 2026. The live id-array merge is
-- kept as installed: an incoming object with an id is existing || incoming
-- (omitted fields stay), DISTINCT ON keeps the first stored row for that id,
-- then incoming order, then stored rows whose ids were not sent. Tombstones
-- and removed_ids are dropped.
--
-- sa_merge_module_store_data still starts with existing || incoming. Only
-- id-arrays are rewritten after that. A nested object such as settings is
-- replaced by the incoming object, so a key the client removed is deleted.
-- There is no recursive merge.
--
-- An id-array is left in place only when that result would equal the live
-- merge: the incoming array equals the stored array, nothing was removed,
-- nothing is a tombstone, every element has an id, and those ids are unique.
-- Id-less elements are not skipped. The live function appends each id-less
-- stored element again, which duplicates them on every save of the same
-- array. This migration keeps that duplication.
--
-- A save whose merged jsonb and token are unchanged does not UPDATE the row,
-- so company_module_stores.updated_at stays put. The stored jsonb is the
-- same. p_if_updated_at is still accepted and not compared. That is the
-- function installed on production. 20260920 raises stale_module_store.
-- Re-enabling that check 409s the second save from a tab that still holds
-- the page-load timestamp.
--
-- 20261042 is not a calendar day. It sorts after 20261041.

CREATE OR REPLACE FUNCTION public.sa_module_store_merge_id_array(
  p_existing jsonb,
  p_incoming jsonb,
  p_removed_ids jsonb DEFAULT '[]'::jsonb
) RETURNS jsonb
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

CREATE OR REPLACE FUNCTION public.sa_merge_module_store_data(
  p_existing jsonb,
  p_incoming jsonb
) RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $function$
DECLARE
  existing_data jsonb := COALESCE(p_existing, '{}'::jsonb);
  incoming_data jsonb := COALESCE(p_incoming, '{}'::jsonb);
  merged jsonb;
  removed_map jsonb := COALESCE(incoming_data -> 'removed_ids', '{}'::jsonb);
  key text;
  incoming_value jsonb;
  existing_value jsonb;
  removed_ids jsonb;
  new_value jsonb;
  has_idless boolean;
  has_dup boolean;
  can_skip boolean;
BEGIN
  IF jsonb_typeof(existing_data) <> 'object' THEN existing_data := '{}'::jsonb; END IF;
  IF jsonb_typeof(incoming_data) <> 'object' THEN incoming_data := '{}'::jsonb; END IF;
  merged := existing_data || incoming_data;
  FOR key IN SELECT jsonb_object_keys(incoming_data) LOOP
    incoming_value := incoming_data -> key;
    existing_value := existing_data -> key;
    IF jsonb_typeof(incoming_value) = 'array' AND (
      key IN (
        'goals','clients','bookings','sessions','coaches','programmes',
        'programme_logs','visit_notes','treatment_plans','class_feedback',
        'check_ins','membership_plans','pt_packs','subscriptions','movements'
      )
      OR public.sa_module_store_array_has_id_object(incoming_value)
      OR public.sa_module_store_array_has_id_object(existing_value)
    ) THEN
      removed_ids := CASE
        WHEN jsonb_typeof(removed_map) = 'object' THEN COALESCE(removed_map -> key, '[]'::jsonb)
        ELSE '[]'::jsonb
      END;
      -- Skip the rebuild only when the live merge would return this array
      -- unchanged. Id-less elements and duplicate ids are rebuilt, because
      -- the live function appends id-less rows again and folds duplicate ids
      -- onto the first stored object.
      can_skip := false;
      IF (jsonb_typeof(removed_ids) <> 'array' OR removed_ids = '[]'::jsonb)
         AND incoming_value = existing_value
         AND NOT EXISTS (
           SELECT 1
           FROM jsonb_array_elements(incoming_value) AS item
           WHERE public.sa_module_store_is_tombstone(item)
         )
      THEN
        SELECT
          COALESCE(bool_or(NOT has_id), false),
          COALESCE(bool_or(has_id AND n > 1), false)
        INTO has_idless, has_dup
        FROM (
          SELECT has_id, count(*) AS n
          FROM (
            SELECT
              (
                jsonb_typeof(item) = 'object'
                AND item ? 'id'
                AND NULLIF(trim(COALESCE(item ->> 'id', '')), '') IS NOT NULL
              ) AS has_id,
              NULLIF(trim(COALESCE(item ->> 'id', '')), '') AS id
            FROM jsonb_array_elements(incoming_value) AS item
          ) elems
          GROUP BY has_id, id
        ) grouped;
        IF NOT FOUND THEN
          has_idless := false;
          has_dup := false;
        END IF;
        can_skip := NOT has_idless AND NOT has_dup;
      END IF;
      IF can_skip THEN
        CONTINUE;
      END IF;
      new_value := public.sa_module_store_merge_id_array(existing_value, incoming_value, removed_ids);
      IF new_value IS DISTINCT FROM (merged -> key) THEN
        merged := jsonb_set(merged, ARRAY[key], new_value, true);
      END IF;
    END IF;
  END LOOP;
  RETURN merged;
END;
$function$;

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
SET search_path TO 'public'
AS $function$
DECLARE
  idx jsonb;
  incoming_data jsonb;
  incoming_token text;
  existing_data jsonb;
  existing_updated_at timestamptz;
  existing_public_token text;
  merged jsonb;
  token_changed boolean;
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

  -- p_if_updated_at is accepted but not enforced. existing_updated_at is
  -- loaded and not compared. Fitgraph POST loads a fresh book then mutates;
  -- the calendar client keeps the page-load updated_at after lite saves, so
  -- enforcing CAS 409s the second invite on the same tab. The guard is
  -- merge-by-id plus the advisory lock.
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
    merged := public.sa_merge_module_store_data(existing_data, incoming_data);
    token_changed := incoming_token IS NOT NULL
      AND incoming_token IS DISTINCT FROM existing_public_token;
    IF merged IS DISTINCT FROM existing_data OR token_changed THEN
      UPDATE public.company_module_stores
      SET
        data = merged,
        public_token = COALESCE(incoming_token, existing_public_token),
        updated_at = now()
      WHERE company_id = p_company_id AND module = p_module;
    END IF;
  END IF;

  IF idx <> '{}'::jsonb THEN
    PERFORM public.sa_merge_profile_metadata(p_company_id, idx);
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.sa_put_module_store(integer, text, jsonb, jsonb, text, timestamptz)
  FROM PUBLIC;
DO $grants$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.sa_put_module_store(integer, text, jsonb, jsonb, text, timestamptz) FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION public.sa_put_module_store(integer, text, jsonb, jsonb, text, timestamptz) FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.sa_put_module_store(integer, text, jsonb, jsonb, text, timestamptz) TO service_role;
  END IF;
END
$grants$;

COMMENT ON FUNCTION public.sa_put_module_store(integer, text, jsonb, jsonb, text, timestamptz) IS
  'Merge a module store the way production does. An unchanged document does not move updated_at. p_if_updated_at is not enforced.';
