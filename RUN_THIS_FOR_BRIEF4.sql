-- Brief 4: IAS 1 COA parents + recode leftover 4400-* AR leaves to 1180-*.
-- Safe to re-run. Paste twin: RUN_THIS_FOR_BRIEF4.sql
-- Does not rewrite journal_lines.account_id (same COA row id).

SET statement_timeout = 0;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'sa_lock_table' AND pg_function_is_visible(oid)
  ) THEN
    PERFORM public.sa_lock_table('chart_of_accounts');
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'sa_lock_table chart_of_accounts skip: %', SQLERRM;
END $$;

-- Recode leftover 4400-####### AR leaves onto 1180-####### (same id).
UPDATE public.chart_of_accounts c
SET
  code = regexp_replace(c.code, '^4400-', '1180-'),
  account_type = 'asset',
  subtype = 'receivable',
  is_header = false,
  normal_balance = 'debit',
  updated_at = now()
WHERE c.code ~ '^4400-[0-9]+$'
  AND COALESCE(c.is_header, false) = false
  AND NOT EXISTS (
    SELECT 1
    FROM public.chart_of_accounts x
    WHERE x.profile_id = c.profile_id
      AND x.code = regexp_replace(c.code, '^4400-', '1180-')
      AND x.id <> c.id
  );

-- 1180 header under 1100 Current assets
UPDATE public.chart_of_accounts c
SET parent_id = p.id, is_header = true, updated_at = now()
FROM public.chart_of_accounts p
WHERE c.code = '1180'
  AND p.profile_id = c.profile_id
  AND p.code = '1100'
  AND (c.parent_id IS DISTINCT FROM p.id OR COALESCE(c.is_header, false) = false);

-- 2180 header under 2100 Current liabilities (2110 stays a posting leaf)
UPDATE public.chart_of_accounts c
SET parent_id = p.id, is_header = true, updated_at = now()
FROM public.chart_of_accounts p
WHERE c.code = '2180'
  AND p.profile_id = c.profile_id
  AND p.code = '2100'
  AND (c.parent_id IS DISTINCT FROM p.id OR COALESCE(c.is_header, false) = false);

-- 1135 ECL contra under 1100 (current)
UPDATE public.chart_of_accounts c
SET parent_id = p.id, updated_at = now()
FROM public.chart_of_accounts p
WHERE c.code = '1135'
  AND p.profile_id = c.profile_id
  AND p.code = '1100'
  AND c.parent_id IS DISTINCT FROM p.id;

-- Member leaves 1180-* under 1180
UPDATE public.chart_of_accounts c
SET parent_id = p.id, updated_at = now()
FROM public.chart_of_accounts p
WHERE c.code ~ '^1180-[0-9]+$'
  AND COALESCE(c.is_header, false) = false
  AND p.profile_id = c.profile_id
  AND p.code = '1180'
  AND c.parent_id IS DISTINCT FROM p.id;

-- Trade integer AR 1181–1999 under 1130
UPDATE public.chart_of_accounts c
SET parent_id = p.id, updated_at = now()
FROM public.chart_of_accounts p
WHERE c.code ~ '^[0-9]+$'
  AND c.code::int >= 1181
  AND c.code::int < 2000
  AND COALESCE(c.is_header, false) = false
  AND p.profile_id = c.profile_id
  AND p.code = '1130'
  AND c.parent_id IS DISTINCT FROM p.id;

-- Supplier leaves 2180-* under 2180
UPDATE public.chart_of_accounts c
SET parent_id = p.id, updated_at = now()
FROM public.chart_of_accounts p
WHERE c.code ~ '^2180-[0-9]+$'
  AND COALESCE(c.is_header, false) = false
  AND p.profile_id = c.profile_id
  AND p.code = '2180'
  AND c.parent_id IS DISTINCT FROM p.id;

-- Legacy integer AP 2181–2999 under 2180
UPDATE public.chart_of_accounts c
SET parent_id = p.id, updated_at = now()
FROM public.chart_of_accounts p
WHERE c.code ~ '^[0-9]+$'
  AND c.code::int >= 2181
  AND c.code::int < 3000
  AND COALESCE(c.is_header, false) = false
  AND p.profile_id = c.profile_id
  AND p.code = '2180'
  AND c.parent_id IS DISTINCT FROM p.id;

-- Never leave AR leaves parented under revenue 4400 / 4100
UPDATE public.chart_of_accounts c
SET parent_id = p.id, updated_at = now()
FROM public.chart_of_accounts bad
JOIN public.chart_of_accounts p
  ON p.profile_id = bad.profile_id
 AND p.code = '1180'
WHERE c.parent_id = bad.id
  AND bad.code IN ('4400', '4100')
  AND c.account_type = 'asset'
  AND COALESCE(c.is_header, false) = false
  AND c.parent_id IS DISTINCT FROM p.id;
