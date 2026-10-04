-- Brief 53 — Keep coach (and client) profile photos on save.
-- Deep-merge same-id objects in sa_module_store_merge_id_array so that keys
-- omitted from an incoming row (e.g. photo_url, public_bio) are preserved from
-- the already-stored object.  Incoming keys always win; tombstones still drop
-- the row; non-id items are unchanged.  No DROP / no smash-guard removal.

CREATE OR REPLACE FUNCTION public.sa_module_store_merge_id_array(
  p_existing jsonb,
  p_incoming jsonb,
  p_removed_ids jsonb DEFAULT '[]'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  existing_arr  jsonb := CASE
    WHEN p_existing IS NOT NULL AND jsonb_typeof(p_existing) = 'array' THEN p_existing
    ELSE '[]'::jsonb
  END;
  incoming_arr  jsonb := CASE
    WHEN p_incoming IS NOT NULL AND jsonb_typeof(p_incoming) = 'array' THEN p_incoming
    ELSE '[]'::jsonb
  END;
  removed_arr   jsonb := CASE
    WHEN p_removed_ids IS NOT NULL AND jsonb_typeof(p_removed_ids) = 'array' THEN p_removed_ids
    ELSE '[]'::jsonb
  END;
  incoming_ids  text[] := ARRAY[]::text[];
  removed_ids   text[] := ARRAY[]::text[];
  tombstone_ids text[] := ARRAY[]::text[];
  result        jsonb;
BEGIN
  -- Build removed_ids set
  SELECT COALESCE(array_agg(trim(v)), ARRAY[]::text[])
  INTO removed_ids
  FROM jsonb_array_elements_text(removed_arr) AS v
  WHERE NULLIF(trim(v), '') IS NOT NULL;

  -- Build incoming_ids and tombstone_ids in one pass
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

  -- Single-pass aggregation: O(n) instead of O(n²) loop-copy.
  -- src=0 keeps incoming items first; src=1 appends existing-only items.
  -- For same-id rows: deep-merge (existing || incoming) so keys omitted from
  -- incoming (e.g. photo_url, public_bio) are preserved from the stored object.
  SELECT COALESCE(jsonb_agg(merged_item ORDER BY src, rn), '[]'::jsonb)
  INTO result
  FROM (
    SELECT 0 AS src, row_number() OVER () AS rn,
           CASE
             WHEN jsonb_typeof(item) = 'object'
               AND item ? 'id'
               AND NULLIF(trim(item->>'id'), '') IS NOT NULL
             THEN COALESCE(
               (SELECT e
                FROM jsonb_array_elements(existing_arr) AS e
                WHERE jsonb_typeof(e) = 'object'
                  AND e ? 'id'
                  AND trim(e->>'id') = trim(item->>'id')
                LIMIT 1),
               '{}'::jsonb
             ) || item
             ELSE item
           END AS merged_item
    FROM jsonb_array_elements(incoming_arr) AS item
    WHERE NOT (
      jsonb_typeof(item) = 'object'
      AND item ? 'id'
      AND NULLIF(trim(item->>'id'), '') IS NOT NULL
      AND trim(item->>'id') = ANY(tombstone_ids)
    )
    UNION ALL
    SELECT 1 AS src, row_number() OVER () AS rn, item AS merged_item
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
