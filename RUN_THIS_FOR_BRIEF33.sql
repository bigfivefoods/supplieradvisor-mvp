-- Brief 33 — recode leftover integer AR 1181+ / AP 2181+ onto 7-digit
-- 1180-0000001 / 2180-0000008 leaves. Same chart_of_accounts.id so
-- journal_lines.account_id stays valid. Paste in the Supabase SQL editor.
-- Safe to re-run. Profiles 110 (VUKA) and 102 (Big Five Foods leftovers).

CREATE OR REPLACE FUNCTION public.sa_brief33_recode_party_gl(p_profile_id integer)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  ar_header_id integer;
  ap_header_id integer;
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
      parent_id = COALESCE(parent_id, parent_1100),
      name = 'Customers'
  WHERE profile_id = p_profile_id AND code = '1180';

  UPDATE public.chart_of_accounts
  SET is_header = true,
      parent_id = COALESCE(parent_id, parent_2100),
      name = 'Suppliers'
  WHERE profile_id = p_profile_id AND code = '2180';

  SELECT id INTO ar_header_id FROM public.chart_of_accounts
    WHERE profile_id = p_profile_id AND code = '1180' LIMIT 1;
  SELECT id INTO ap_header_id FROM public.chart_of_accounts
    WHERE profile_id = p_profile_id AND code = '2180' LIMIT 1;

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
    AND (
      (cust.metadata->>'gl_account_id') ~ '^[0-9]+$'
        AND (cust.metadata->>'gl_account_id')::int = c.id
      OR cust.metadata->>'gl_account_code' = c.code
      OR (c.metadata->'party_ids' @> to_jsonb(cust.id))
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.chart_of_accounts x
      WHERE x.profile_id = p_profile_id
        AND x.id <> c.id
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
END;
$$;

SELECT public.sa_brief33_recode_party_gl(110);
SELECT public.sa_brief33_recode_party_gl(102);
