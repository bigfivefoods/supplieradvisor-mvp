-- GymAdvisor® member audit. SELECT only.
-- Set the company id in params. This file is read-only.
-- Members live in company_module_stores.data (module = fitgraph), clients[].
--
-- Reports, for that company:
--   duplicate members (email, phone digits, name + date of birth)
--   members missing key fields
--   invalid emails and phones
--   counts of private clients, class members, and both
--
-- "Private" here matches the desk rule: private_client is on AND a coach is
-- assigned, or coach_ids is non-empty. A flag with no coach is counted as a
-- mismatch, not as a private client.

WITH params AS (
  SELECT 0::bigint AS company_id
),
book AS (
  SELECT s.company_id, s.data
  FROM public.company_module_stores s
  JOIN params p ON s.company_id = p.company_id
  WHERE s.module = 'fitgraph'
),
clients AS (
  SELECT
    b.company_id,
    c->>'id' AS client_id,
    COALESCE(c->>'name', '') AS name,
    NULLIF(lower(btrim(c->>'email')), '') AS email,
    NULLIF(btrim(c->>'phone'), '') AS phone,
    regexp_replace(COALESCE(c->>'phone', ''), '\D', '', 'g') AS phone_digits,
    NULLIF(btrim(c->>'date_of_birth'), '') AS date_of_birth,
    NULLIF(lower(regexp_replace(COALESCE(c->>'name', ''), '[^a-zA-Z0-9]+', ' ', 'g')), '') AS name_key,
    COALESCE(c->>'private_client', '') = 'true' AS private_flag,
    NULLIF(c->>'coach_id', '') AS coach_id,
    CASE
      WHEN jsonb_typeof(c->'coach_ids') = 'array'
        AND jsonb_array_length(c->'coach_ids') > 0 THEN true
      ELSE false
    END AS has_coach_ids,
    NULLIF(c->>'membership_plan_id', '') AS membership_plan_id,
    CASE
      WHEN jsonb_typeof(c->'class_type_ids') = 'array'
        AND jsonb_array_length(c->'class_type_ids') > 0 THEN true
      ELSE false
    END AS has_class_types,
    COALESCE(c->>'active', 'true') <> 'false' AS active,
    NULLIF(btrim(c->>'emergency_contact'), '') AS emergency_contact,
    NULLIF(btrim(c->>'next_of_kin'), '') AS next_of_kin,
    NULLIF(btrim(c->>'id_number'), '') AS id_number
  FROM book b
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(b.data->'clients', '[]'::jsonb)) c
  WHERE COALESCE(c->>'_deleted', '') <> 'true'
    AND NULLIF(c->>'id', '') IS NOT NULL
),
classed AS (
  SELECT
    cl.*,
    (
      cl.membership_plan_id IS NOT NULL
      OR cl.has_class_types
      OR EXISTS (
        SELECT 1
        FROM book b
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(b.data->'subscriptions', '[]'::jsonb)) s
        WHERE s->>'client_id' = cl.client_id
          AND s->>'status' IN ('active', 'trialing')
      )
    ) AS on_class,
    (
      cl.has_coach_ids
      OR (cl.private_flag AND cl.coach_id IS NOT NULL)
    ) AS private_client
  FROM clients cl
)
SELECT 'duplicate_email' AS report, email AS key, count(*) AS n,
       string_agg(name || ' (' || client_id || ')', ', ' ORDER BY name) AS members
FROM classed
WHERE email IS NOT NULL AND email LIKE '%@%.%'
GROUP BY email
HAVING count(*) > 1

UNION ALL

SELECT 'duplicate_phone',
       CASE
         WHEN length(phone_digits) >= 9 THEN right(phone_digits, 9)
         ELSE phone_digits
       END,
       count(*),
       string_agg(name || ' (' || client_id || ')', ', ' ORDER BY name)
FROM classed
WHERE length(phone_digits) >= 8
GROUP BY 2
HAVING count(*) > 1

UNION ALL

SELECT 'duplicate_name_dob',
       name_key || '|' || date_of_birth,
       count(*),
       string_agg(name || ' (' || client_id || ')', ', ' ORDER BY name)
FROM classed
WHERE name_key IS NOT NULL AND date_of_birth IS NOT NULL
GROUP BY name_key, date_of_birth
HAVING count(*) > 1

UNION ALL

SELECT 'missing_key_field', client_id, 1::bigint,
       name || CASE
         WHEN email IS NULL THEN ' · email'
         ELSE ''
       END || CASE
         WHEN phone IS NULL THEN ' · phone'
         ELSE ''
       END || CASE
         WHEN id_number IS NULL AND date_of_birth IS NULL THEN ' · id/dob'
         ELSE ''
       END || CASE
         WHEN emergency_contact IS NULL AND next_of_kin IS NULL THEN ' · emergency'
         ELSE ''
       END
FROM classed
WHERE email IS NULL
   OR phone IS NULL
   OR (id_number IS NULL AND date_of_birth IS NULL)
   OR (emergency_contact IS NULL AND next_of_kin IS NULL)

UNION ALL

SELECT 'invalid_email', client_id, 1::bigint, name || ' · ' || COALESCE(email, '')
FROM classed
WHERE email IS NOT NULL AND email NOT LIKE '%_@_%._%'

UNION ALL

SELECT 'invalid_phone', client_id, 1::bigint,
       name || ' · ' || COALESCE(phone, '') || ' · ' || length(phone_digits) || ' digits'
FROM classed
WHERE phone IS NOT NULL AND (length(phone_digits) < 8 OR length(phone_digits) > 15)

UNION ALL

SELECT 'private_flag_without_coach', client_id, 1::bigint, name
FROM classed
WHERE private_flag AND NOT private_client

UNION ALL

SELECT 'count_private_client', 'private', count(*)::bigint, NULL
FROM classed
WHERE private_client AND NOT on_class

UNION ALL

SELECT 'count_class_member', 'class', count(*)::bigint, NULL
FROM classed
WHERE on_class AND NOT private_client

UNION ALL

SELECT 'count_both', 'both', count(*)::bigint, NULL
FROM classed
WHERE private_client AND on_class

UNION ALL

SELECT 'count_neither', 'neither', count(*)::bigint, NULL
FROM classed
WHERE NOT private_client AND NOT on_class

ORDER BY report, key;
