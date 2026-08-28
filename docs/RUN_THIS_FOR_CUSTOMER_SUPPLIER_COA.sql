-- Rename 1180 → Customers and 2180 → Suppliers.
-- Recode leftover integer 1181+/2181+ leaves onto 1180-0000001 / 2180-0000001
-- when the customer/supplier id is known. Same CoA row id — journals stay put.
-- Safe to re-run. Paste twin: RUN_THIS_FOR_CUSTOMER_SUPPLIER_COA.sql

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

-- 1180 header name
UPDATE public.chart_of_accounts
SET
  name = 'Customers',
  is_header = true,
  account_type = 'asset',
  subtype = 'receivable',
  normal_balance = 'debit',
  description = 'Customer AR header. Each customer is a unique leaf 1180-0000001 … (scales to thousands). Statement presentation rolls into Trade and other receivables with 1130. Not a revenue account — income posts to 4100/4200/4400.',
  updated_at = now()
WHERE code = '1180';

-- 2180 header name
UPDATE public.chart_of_accounts
SET
  name = 'Suppliers',
  is_header = true,
  account_type = 'liability',
  subtype = 'payable',
  normal_balance = 'credit',
  description = 'Supplier AP header. Each supplier is a unique leaf 2180-0000001 … (scales to thousands). Statement presentation rolls into Trade and other payables with 2110. Employed staff stay on 6100 (IAS 19).',
  updated_at = now()
WHERE code = '2180';

-- Parent 1180 under 1100, 2180 under 2100
UPDATE public.chart_of_accounts c
SET parent_id = p.id, updated_at = now()
FROM public.chart_of_accounts p
WHERE c.code = '1180'
  AND p.profile_id = c.profile_id
  AND p.code = '1100'
  AND c.parent_id IS DISTINCT FROM p.id;

UPDATE public.chart_of_accounts c
SET parent_id = p.id, updated_at = now()
FROM public.chart_of_accounts p
WHERE c.code = '2180'
  AND p.profile_id = c.profile_id
  AND p.code = '2100'
  AND c.parent_id IS DISTINCT FROM p.id;

-- Recode 1181+ integer AR leaves onto 1180-{padded customer id} when linked.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'customers'
  ) THEN
    UPDATE public.chart_of_accounts c
    SET
      code = '1180-' || lpad(cust.id::text, 7, '0'),
      account_type = 'asset',
      subtype = 'receivable',
      is_header = false,
      normal_balance = 'debit',
      parent_id = p.id,
      updated_at = now()
    FROM public.customers cust
    JOIN public.chart_of_accounts p
      ON p.profile_id = cust.profile_id
     AND p.code = '1180'
    WHERE cust.profile_id = c.profile_id
      AND COALESCE(c.is_header, false) = false
      AND c.code ~ '^[0-9]+$'
      AND c.code::int >= 1181
      AND c.code::int < 2000
      AND (
        NULLIF(cust.metadata->>'gl_account_id', '')::bigint = c.id
        OR cust.metadata->>'gl_account_code' = c.code
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.chart_of_accounts x
        WHERE x.profile_id = c.profile_id
          AND x.id <> c.id
          AND x.code = '1180-' || lpad(cust.id::text, 7, '0')
      );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'recode 1181+ skip: %', SQLERRM;
END $$;

-- Recode 2181+ integer AP leaves onto 2180-{padded supplier id} when linked.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'srm_suppliers'
  ) THEN
    UPDATE public.chart_of_accounts c
    SET
      code = '2180-' || lpad(sup.id::text, 7, '0'),
      account_type = 'liability',
      subtype = 'payable',
      is_header = false,
      normal_balance = 'credit',
      parent_id = p.id,
      updated_at = now()
    FROM public.srm_suppliers sup
    JOIN public.chart_of_accounts p
      ON p.profile_id = sup.profile_id
     AND p.code = '2180'
    WHERE sup.profile_id = c.profile_id
      AND COALESCE(c.is_header, false) = false
      AND c.code ~ '^[0-9]+$'
      AND c.code::int >= 2181
      AND c.code::int < 3000
      AND (
        NULLIF(sup.metadata->>'gl_account_id', '')::bigint = c.id
        OR sup.metadata->>'gl_account_code' = c.code
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.chart_of_accounts x
        WHERE x.profile_id = c.profile_id
          AND x.id <> c.id
          AND x.code = '2180-' || lpad(sup.id::text, 7, '0')
      );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'recode 2181+ skip: %', SQLERRM;
END $$;

-- Nest existing hyphen leaves under the headers
UPDATE public.chart_of_accounts c
SET parent_id = p.id, updated_at = now()
FROM public.chart_of_accounts p
WHERE c.code ~ '^1180-[0-9]+$'
  AND COALESCE(c.is_header, false) = false
  AND p.profile_id = c.profile_id
  AND p.code = '1180'
  AND c.parent_id IS DISTINCT FROM p.id;

UPDATE public.chart_of_accounts c
SET parent_id = p.id, updated_at = now()
FROM public.chart_of_accounts p
WHERE c.code ~ '^2180-[0-9]+$'
  AND COALESCE(c.is_header, false) = false
  AND p.profile_id = c.profile_id
  AND p.code = '2180'
  AND c.parent_id IS DISTINCT FROM p.id;
