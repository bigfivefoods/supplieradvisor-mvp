-- Faster sa_put_module_store without changing merge results.
--
-- Production pg_stat_statements on 25 Oct 2026: 53 calls, mean 1340.5 ms,
-- about 809 KB of WAL per call. The live GymAdvisor® book is one jsonb
-- document (bookings 3,318, sessions 1,333, clients 282, plus the other
-- id-arrays). sa_merge_module_store_data copied that whole document with
-- jsonb_set once per id-array key, including empty arrays whose names are
-- in the id-array list.
--
-- The merge result is unchanged:
--   incoming id wins, incoming order first, then existing ids that were
--   not sent, tombstones and removed_ids dropped, nested objects recurse,
--   scalars overwrite.
-- An unchanged id-array is left in place instead of being rebuilt, but only
-- when that key has no removals and no tombstones. A stored tombstone is
-- still dropped. A no-op save no longer bumps company_module_stores.updated_at.
-- The row data is the same.
--
-- p_if_updated_at is still accepted and not enforced. That is the function
-- installed on production on 25 Oct 2026. 20260920_brief52_merge_speed_and_409_fix.sql
-- compares it and raises stale_module_store. Re-enabling that check 409s the
-- second save from a tab that still holds the page-load timestamp. This
-- migration keeps the live contract: advisory lock plus merge-by-id.
--
-- 20261042 is not a calendar day. It sorts after 20261041.

CREATE OR REPLACE FUNCTION public.sa_module_store_is_tombstone(p_row jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_row IS NULL OR jsonb_typeof(p_row) IS DISTINCT FROM 'object' THEN false
    ELSE
      lower(trim(COALESCE(p_row ->> '_deleted', ''))) IN ('true', 't', 'yes', 'y', 'on', '1')
      OR lower(trim(COALESCE(p_row ->> 'deleted', ''))) IN ('true', 't', 'yes', 'y', 'on', '1')
      OR lower(trim(COALESCE(p_row ->> 'is_deleted', ''))) IN ('true', 't', 'yes', 'y', 'on', '1')
      OR (
        p_row ? 'deleted_at'
        AND NULLIF(trim(COALESCE(p_row ->> 'deleted_at', '')), '') IS NOT NULL
      )
  END
$$;

CREATE OR REPLACE FUNCTION public.sa_module_store_merge_id_array(
  p_existing jsonb,
  p_incoming jsonb,
  p_removed_ids jsonb DEFAULT '[]'::jsonb
) RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  WITH incoming AS (
    SELECT
      item,
      ord::integer AS ord,
      CASE
        WHEN jsonb_typeof(item) = 'object' AND item ? 'id' THEN NULLIF(trim(item ->> 'id'), '')
      END AS id
    FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(p_incoming) = 'array' THEN p_incoming ELSE '[]'::jsonb END
    ) WITH ORDINALITY AS t(item, ord)
  ),
  marked AS (
    SELECT
      item,
      ord,
      id,
      id IS NOT NULL AND public.sa_module_store_is_tombstone(item) AS tomb
    FROM incoming
  ),
  removed AS (
    SELECT NULLIF(trim(v), '') AS id
    FROM jsonb_array_elements_text(
      CASE WHEN jsonb_typeof(p_removed_ids) = 'array' THEN p_removed_ids ELSE '[]'::jsonb END
    ) AS v
    WHERE NULLIF(trim(v), '') IS NOT NULL
  ),
  existing AS (
    SELECT
      item,
      ord::integer AS ord,
      CASE
        WHEN jsonb_typeof(item) = 'object' AND item ? 'id' THEN NULLIF(trim(item ->> 'id'), '')
      END AS id
    FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(p_existing) = 'array' THEN p_existing ELSE '[]'::jsonb END
    ) WITH ORDINALITY AS t(item, ord)
  )
  SELECT COALESCE((
    SELECT jsonb_agg(item ORDER BY src, ord)
    FROM (
      SELECT 0 AS src, ord, item
      FROM marked
      WHERE NOT tomb
      UNION ALL
      SELECT 1, e.ord, e.item
      FROM existing e
      WHERE NOT (
        e.id IS NOT NULL
        AND (
          EXISTS (SELECT 1 FROM marked i WHERE i.id = e.id)
          OR EXISTS (SELECT 1 FROM removed r WHERE r.id = e.id)
        )
      )
    ) s
  ), '[]'::jsonb);
$$;

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
  new_value jsonb;
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
      -- Unchanged array, nothing removed, no tombstone: the || copy is already
      -- the merge result. Skip the rebuild and the document-sized jsonb_set.
      IF (jsonb_typeof(removed_ids) <> 'array' OR removed_ids = '[]'::jsonb)
         AND incoming_value = existing_value
         AND NOT EXISTS (
           SELECT 1
           FROM jsonb_array_elements(incoming_value) AS item
           WHERE public.sa_module_store_is_tombstone(item)
         ) THEN
        CONTINUE;
      END IF;
      new_value := public.sa_module_store_merge_id_array(
        existing_value,
        incoming_value,
        removed_ids
      );
      IF new_value IS DISTINCT FROM (merged -> key) THEN
        merged := jsonb_set(merged, ARRAY[key], new_value, true);
      END IF;

    ELSIF jsonb_typeof(incoming_value) = 'object'
          AND jsonb_typeof(existing_value) = 'object' THEN
      new_value := public.sa_merge_module_store_data(existing_value, incoming_value);
      IF new_value IS DISTINCT FROM (merged -> key) THEN
        merged := jsonb_set(merged, ARRAY[key], new_value, true);
      END IF;
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
AS $$
DECLARE
  idx jsonb;
  incoming_data jsonb;
  incoming_token text;
  existing_data jsonb;
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

  SELECT data, public_token
  INTO existing_data, existing_public_token
  FROM public.company_module_stores
  WHERE company_id = p_company_id AND module = p_module
  FOR UPDATE;

  -- p_if_updated_at is accepted and not compared. Production's installed
  -- function works this way. Merge-by-id plus the advisory lock is the guard.
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
$$;

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
  'Merge a module store. Unchanged id-arrays are not rebuilt. A no-op leaves updated_at alone. p_if_updated_at is not enforced.';
