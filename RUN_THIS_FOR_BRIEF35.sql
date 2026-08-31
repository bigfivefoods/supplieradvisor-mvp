-- Brief 35 — finish VUKA COA: leftover integer AR 1190 / AP, retire
-- 4401+ Member — income leaves, restamp every customer onto 1180-#######.
-- Same chart_of_accounts.id when recoding AR so journal_lines stay valid.
-- Does not recode revenue 4401 onto 1180. Does not smash BFF 102.
-- Paste in the Supabase SQL editor AFTER Brief 35 is on main.
-- Do not re-run RUN_THIS_FOR_BRIEF33.sql.

CREATE OR REPLACE FUNCTION public.sa_brief35_recode_party_gl(p_profile_id integer)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  ar_header_id integer;
  ap_header_id integer;
  rev_header_id integer;
  parent_1100 integer;
  parent_2100 integer;
BEGIN
  SELECT id INTO parent_1100 FROM public.chart_of_accounts
    WHERE profile_id = p_profile_id AND code = '1100' LIMIT 1;
  SELECT id INTO parent_2100 FROM public.chart_of_accounts
    WHERE profile_id = p_profile_id AND code = '2100' LIMIT 1;

  INSERT INTO public.chart_of_accounts (
    profile_id, code, name, account_type, is_header, is_active, is_system,
    normal_balance, parent_id, currency, sort_order, description, metadata
  )
  SELECT p_profile_id, '1180', 'Customers', 'asset', true, true, false,
         'debit', parent_1100, 'ZAR', 840,
         'Customer AR header. Each customer is 1180-0000001 …',
         jsonb_build_object('party_kind', 'customer_ar_header')
  WHERE NOT EXISTS (
    SELECT 1 FROM public.chart_of_accounts
    WHERE profile_id = p_profile_id AND code = '1180'
  );

  INSERT INTO public.chart_of_accounts (
    profile_id, code, name, account_type, is_header, is_active, is_system,
    normal_balance, parent_id, currency, sort_order, description, metadata
  )
  SELECT p_profile_id, '2180', 'Suppliers', 'liability', true, true, false,
         'credit', parent_2100, 'ZAR', 850,
         'Supplier AP header. Each supplier is 2180-0000001 …',
         jsonb_build_object('party_kind', 'supplier_ap_header')
  WHERE NOT EXISTS (
    SELECT 1 FROM public.chart_of_accounts
    WHERE profile_id = p_profile_id AND code = '2180'
  );

  UPDATE public.chart_of_accounts
  SET is_header = true,
      is_active = true,
      parent_id = COALESCE(parent_id, parent_1100),
      name = 'Customers'
  WHERE profile_id = p_profile_id AND code = '1180';

  UPDATE public.chart_of_accounts
  SET is_header = true,
      is_active = true,
      parent_id = COALESCE(parent_id, parent_2100),
      name = 'Suppliers'
  WHERE profile_id = p_profile_id AND code = '2180';

  SELECT id INTO ar_header_id FROM public.chart_of_accounts
    WHERE profile_id = p_profile_id AND code = '1180' LIMIT 1;
  SELECT id INTO ap_header_id FROM public.chart_of_accounts
    WHERE profile_id = p_profile_id AND code = '2180' LIMIT 1;
  SELECT id INTO rev_header_id FROM public.chart_of_accounts
    WHERE profile_id = p_profile_id AND code = '4400' LIMIT 1;

  -- 1a. Recode leftover integer AR 1181–1999 (not 1200) when 1180-* is free.
  UPDATE public.chart_of_accounts c
  SET code = '1180-' || lpad(cust.id::text, 7, '0'),
      parent_id = ar_header_id,
      is_header = false,
      is_active = true,
      account_type = 'asset',
      subtype = 'receivable',
      normal_balance = 'debit',
      metadata = COALESCE(c.metadata, '{}'::jsonb)
        || jsonb_build_object(
          'party_kind', 'customer_ar',
          'party_ids', jsonb_build_array(cust.id),
          'ar_account_number', '1180-' || lpad(cust.id::text, 7, '0')
        )
  FROM public.customers cust
  WHERE c.profile_id = p_profile_id
    AND cust.profile_id = p_profile_id
    AND c.code ~ '^[0-9]+$'
    AND c.code::int >= 1181 AND c.code::int < 2000
    AND c.code <> '1200'
    AND COALESCE(c.is_header, false) = false
    AND (
      lower(COALESCE(c.subtype, '')) = 'receivable'
      OR c.name ~* '^AR[[:space:]]+[—-]'
    )
    AND (
      (cust.metadata->>'gl_account_id') ~ '^[0-9]+$'
        AND (cust.metadata->>'gl_account_id')::int = c.id
      OR cust.metadata->>'gl_account_code' = c.code
      OR (c.metadata->'party_ids' @> to_jsonb(cust.id))
      OR lower(trim(regexp_replace(c.name, '^AR[[:space:]]+[—-][[:space:]]*', '', 'i')))
           = lower(trim(COALESCE(cust.trading_name, cust.legal_name, '')))
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.chart_of_accounts x
      WHERE x.profile_id = p_profile_id
        AND x.id <> c.id
        AND x.code = '1180-' || lpad(cust.id::text, 7, '0')
    );

  -- 1b. Want already taken: deactivate leftover integer; stamp party onto 1180-*.
  UPDATE public.chart_of_accounts leftover
  SET is_active = false,
      parent_id = ar_header_id
  FROM public.customers cust
  WHERE leftover.profile_id = p_profile_id
    AND cust.profile_id = p_profile_id
    AND leftover.code ~ '^[0-9]+$'
    AND leftover.code::int >= 1181 AND leftover.code::int < 2000
    AND leftover.code <> '1200'
    AND COALESCE(leftover.is_header, false) = false
    AND leftover.is_active IS DISTINCT FROM false
    AND (
      lower(COALESCE(leftover.subtype, '')) = 'receivable'
      OR leftover.name ~* '^AR[[:space:]]+[—-]'
    )
    AND (
      (cust.metadata->>'gl_account_id') ~ '^[0-9]+$'
        AND (cust.metadata->>'gl_account_id')::int = leftover.id
      OR cust.metadata->>'gl_account_code' = leftover.code
      OR (leftover.metadata->'party_ids' @> to_jsonb(cust.id))
      OR lower(trim(regexp_replace(leftover.name, '^AR[[:space:]]+[—-][[:space:]]*', '', 'i')))
           = lower(trim(COALESCE(cust.trading_name, cust.legal_name, '')))
    )
    AND EXISTS (
      SELECT 1 FROM public.chart_of_accounts x
      WHERE x.profile_id = p_profile_id
        AND x.id <> leftover.id
        AND x.code = '1180-' || lpad(cust.id::text, 7, '0')
    );

  -- 1c. Unmatched leftover AR with 0 journal lines: deactivate.
  UPDATE public.chart_of_accounts leftover
  SET is_active = false,
      parent_id = COALESCE(ar_header_id, leftover.parent_id)
  WHERE leftover.profile_id = p_profile_id
    AND leftover.code ~ '^[0-9]+$'
    AND leftover.code::int >= 1181 AND leftover.code::int < 2000
    AND leftover.code <> '1200'
    AND COALESCE(leftover.is_header, false) = false
    AND leftover.is_active IS DISTINCT FROM false
    AND (
      lower(COALESCE(leftover.subtype, '')) = 'receivable'
      OR leftover.name ~* '^AR[[:space:]]+[—-]'
    )
    AND leftover.code !~ '^1180-'
    AND leftover.code ~ '^[0-9]+$'
    AND NOT EXISTS (
      SELECT 1 FROM public.journal_lines jl
      WHERE jl.account_id = leftover.id
        AND jl.profile_id = p_profile_id
    );

  -- 1d. Unmatched leftover AR WITH journals: nest under 1180, keep row, hide.
  UPDATE public.chart_of_accounts leftover
  SET is_active = false,
      parent_id = COALESCE(ar_header_id, leftover.parent_id)
  WHERE leftover.profile_id = p_profile_id
    AND leftover.code ~ '^[0-9]+$'
    AND leftover.code::int >= 1181 AND leftover.code::int < 2000
    AND leftover.code <> '1200'
    AND COALESCE(leftover.is_header, false) = false
    AND leftover.is_active IS DISTINCT FROM false
    AND (
      lower(COALESCE(leftover.subtype, '')) = 'receivable'
      OR leftover.name ~* '^AR[[:space:]]+[—-]'
    )
    AND EXISTS (
      SELECT 1 FROM public.journal_lines jl
      WHERE jl.account_id = leftover.id
        AND jl.profile_id = p_profile_id
    );

  -- AP 2181–2999, want free.
  UPDATE public.chart_of_accounts c
  SET code = '2180-' || lpad(sup.id::text, 7, '0'),
      parent_id = ap_header_id,
      is_header = false,
      is_active = true,
      account_type = 'liability',
      subtype = 'payable',
      normal_balance = 'credit',
      metadata = COALESCE(c.metadata, '{}'::jsonb)
        || jsonb_build_object(
          'party_kind', 'supplier_ap',
          'party_ids', jsonb_build_array(sup.id),
          'ap_account_number', '2180-' || lpad(sup.id::text, 7, '0')
        )
  FROM public.srm_suppliers sup
  WHERE c.profile_id = p_profile_id
    AND sup.profile_id = p_profile_id
    AND c.code ~ '^[0-9]+$'
    AND c.code::int >= 2181 AND c.code::int < 3000
    AND COALESCE(c.is_header, false) = false
    AND (
      lower(COALESCE(c.subtype, '')) = 'payable'
      OR c.name ~* '^AP[[:space:]]+[—-]'
    )
    AND (
      (sup.metadata->>'gl_account_id') ~ '^[0-9]+$'
        AND (sup.metadata->>'gl_account_id')::int = c.id
      OR sup.metadata->>'gl_account_code' = c.code
      OR (c.metadata->'party_ids' @> to_jsonb(sup.id))
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.chart_of_accounts x
      WHERE x.profile_id = p_profile_id
        AND x.id <> c.id
        AND x.code = '2180-' || lpad(sup.id::text, 7, '0')
    );

  UPDATE public.chart_of_accounts leftover
  SET is_active = false,
      parent_id = ap_header_id
  FROM public.srm_suppliers sup
  WHERE leftover.profile_id = p_profile_id
    AND sup.profile_id = p_profile_id
    AND leftover.code ~ '^[0-9]+$'
    AND leftover.code::int >= 2181 AND leftover.code::int < 3000
    AND COALESCE(leftover.is_header, false) = false
    AND leftover.is_active IS DISTINCT FROM false
    AND (
      lower(COALESCE(leftover.subtype, '')) = 'payable'
      OR leftover.name ~* '^AP[[:space:]]+[—-]'
    )
    AND EXISTS (
      SELECT 1 FROM public.chart_of_accounts x
      WHERE x.profile_id = p_profile_id
        AND x.id <> leftover.id
        AND x.code = '2180-' || lpad(sup.id::text, 7, '0')
    );

  -- 2. Retire integer 4401–4499 Member — income leaves with 0 journal lines.
  -- Never recode these onto 1180 (they are revenue).
  UPDATE public.chart_of_accounts c
  SET is_active = false
  WHERE c.profile_id = p_profile_id
    AND c.code ~ '^44[0-9]{2}$'
    AND c.code <> '4400'
    AND COALESCE(c.is_header, false) = false
    AND c.is_active IS DISTINCT FROM false
    AND (
      c.name ~* '^Member[[:space:]]+[—-]'
      OR (
        lower(COALESCE(c.subtype, '')) = 'service'
        AND rev_header_id IS NOT NULL
        AND c.parent_id = rev_header_id
      )
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.journal_lines jl
      WHERE jl.account_id = c.id
        AND jl.profile_id = p_profile_id
    );

  -- 3. Mint missing 1180-####### leaves, then restamp every customer.
  INSERT INTO public.chart_of_accounts (
    profile_id, code, name, account_type, subtype, is_header, is_active, is_system,
    normal_balance, parent_id, currency, sort_order, description, metadata
  )
  SELECT
    p_profile_id,
    '1180-' || lpad(cust.id::text, 7, '0'),
    'AR — ' || COALESCE(NULLIF(trim(cust.trading_name), ''), NULLIF(trim(cust.legal_name), ''), 'Customer ' || cust.id::text),
    'asset',
    'receivable',
    false,
    true,
    false,
    'debit',
    ar_header_id,
    'ZAR',
    841,
    'AR account 1180-' || lpad(cust.id::text, 7, '0'),
    jsonb_build_object(
      'party_kind', 'customer_ar',
      'party_ids', jsonb_build_array(cust.id),
      'ar_account_number', '1180-' || lpad(cust.id::text, 7, '0')
    )
  FROM public.customers cust
  WHERE cust.profile_id = p_profile_id
    AND COALESCE(lower(cust.status), 'active') NOT IN ('inactive', 'archived', 'closed', 'deleted', 'void')
    AND NOT EXISTS (
      SELECT 1 FROM public.chart_of_accounts x
      WHERE x.profile_id = p_profile_id
        AND x.code = '1180-' || lpad(cust.id::text, 7, '0')
    );

  UPDATE public.customers cust
  SET metadata = COALESCE(cust.metadata, '{}'::jsonb)
    || jsonb_build_object(
      'gl_account_id', c.id,
      'gl_account_code', c.code,
      'gl_account_kind', 'ar',
      'ar_account_number', c.code
    )
  FROM public.chart_of_accounts c
  WHERE cust.profile_id = p_profile_id
    AND c.profile_id = p_profile_id
    AND c.code = '1180-' || lpad(cust.id::text, 7, '0');

  UPDATE public.srm_suppliers sup
  SET metadata = COALESCE(sup.metadata, '{}'::jsonb)
    || jsonb_build_object(
      'gl_account_id', c.id,
      'gl_account_code', c.code,
      'gl_account_kind', 'ap',
      'ap_account_number', c.code
    )
  FROM public.chart_of_accounts c
  WHERE sup.profile_id = p_profile_id
    AND c.profile_id = p_profile_id
    AND c.code = '2180-' || lpad(sup.id::text, 7, '0');

  -- Parent 1180-* and leftover AR integers under the 1180 header (not 1130).
  UPDATE public.chart_of_accounts c
  SET parent_id = ar_header_id
  WHERE c.profile_id = p_profile_id
    AND ar_header_id IS NOT NULL
    AND c.id <> ar_header_id
    AND (
      c.code LIKE '1180-%'
      OR (
        c.code ~ '^[0-9]+$'
        AND c.code::int >= 1181 AND c.code::int < 2000
        AND c.code <> '1200'
        AND COALESCE(c.is_header, false) = false
        AND (
          lower(COALESCE(c.subtype, '')) = 'receivable'
          OR c.name ~* '^AR[[:space:]]+[—-]'
        )
      )
    );
END;
$$;

SELECT public.sa_brief35_recode_party_gl(110);
-- Profile 102 is clean (0 leftover integer AR/AP). Uncomment only if leftovers reappear:
-- SELECT public.sa_brief35_recode_party_gl(102);
