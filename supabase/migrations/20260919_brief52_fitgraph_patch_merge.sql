-- Brief 52 — Fast calendar patch saves.
-- Update sa_merge_module_store_data to recursively merge nested objects
-- so that a partial { fitgraph: { sessions: [...] } } payload preserves
-- all other keys (bookings, clients, coaches, …) already on the server row.

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
