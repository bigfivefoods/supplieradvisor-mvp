-- Brief 52 follow-up — Fix 409 stale loop + O(n) merge-id-array.
--
-- 1. sa_module_store_merge_id_array: set-based rewrite (jsonb_agg).
--    The old plpgsql loop did `merged := merged || jsonb_build_array(item)` on
--    every row — O(n²) jsonb copy.  Live VUKA ran 4218 ms for 2246 bookings.
--    New version scans each array once and aggregates with jsonb_agg — O(n).
--    Merge semantics are identical: incoming same-id wins, tombstones dropped,
--    removed_ids / explicit tombstones honoured, existing-only ids kept.
--
-- 2. sa_put_module_store: fix stale-write comparison.
--    The ROW clock (set to now() by PostgreSQL) is always a few ms AFTER the
--    JSON-embedded updated_at (set to new Date().toISOString() in JS).
--    The old check `existing_updated_at > p_if_updated_at` compared the ROW
--    clock against the JSON stamp → always true on first calendar action → 409.
--    Fix: compare (existing_data->>'updated_at')::timestamptz when present.

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
  effective_updated_at timestamptz;
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
    IF p_if_updated_at IS NOT NULL THEN
      -- Prefer the JSON-embedded updated_at when present: the JS client stamps
      -- new Date().toISOString() inside the data *before* the SQL now() runs,
      -- so the ROW clock is always a few ms ahead of the JSON stamp.
      -- Comparing ROW clock > JSON-stamp was always true → spurious 409s.
      effective_updated_at := CASE
        WHEN existing_data ? 'updated_at'
          AND NULLIF(trim(COALESCE(existing_data->>'updated_at', '')), '') IS NOT NULL
        THEN (existing_data->>'updated_at')::timestamptz
        ELSE existing_updated_at
      END;

      IF effective_updated_at IS NOT NULL
         AND effective_updated_at > p_if_updated_at THEN
        RAISE EXCEPTION USING
          ERRCODE = 'P0001',
          MESSAGE = 'stale_module_store',
          DETAIL = effective_updated_at::text,
          HINT = 'Refresh and retry with the latest store snapshot';
      END IF;
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
