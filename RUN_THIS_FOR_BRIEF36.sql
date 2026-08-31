-- Brief 36 — VUKA padded member income 4400-0000001 (not 4401/4500).
-- Recodes integer Member — 4401–4699 onto 4400-{lpad(customer.id,7)}.
-- Does not touch 1180-* AR, leftover 1190, or profile 102.
-- Paste after Brief 36 is on main. Do not re-run Brief 33 SQL.

CREATE OR REPLACE FUNCTION public.sa_brief36_recode_member_rev(p_profile_id integer)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  rev_header_id integer;
  parent_4000 integer;
BEGIN
  SELECT id INTO parent_4000 FROM public.chart_of_accounts
    WHERE profile_id = p_profile_id AND code = '4000' LIMIT 1;

  INSERT INTO public.chart_of_accounts (
    profile_id, code, name, account_type, subtype, is_header, is_active, is_system,
    normal_balance, parent_id, currency, sort_order, description, metadata
  )
  SELECT p_profile_id, '4400', 'Membership & care revenue', 'revenue', 'service',
         true, true, false, 'credit', parent_4000, 'ZAR', 440,
         'IFRS 15 membership & care income header. Each member is 4400-0000001 …',
         jsonb_build_object('party_kind', 'member_rev_header')
  WHERE NOT EXISTS (
    SELECT 1 FROM public.chart_of_accounts
    WHERE profile_id = p_profile_id AND code = '4400'
  );

  UPDATE public.chart_of_accounts
  SET is_header = true,
      is_active = true,
      account_type = 'revenue',
      subtype = 'service',
      parent_id = COALESCE(parent_id, parent_4000),
      name = 'Membership & care revenue'
  WHERE profile_id = p_profile_id AND code = '4400';

  SELECT id INTO rev_header_id FROM public.chart_of_accounts
    WHERE profile_id = p_profile_id AND code = '4400' LIMIT 1;

  -- Recode matched integer Member leaves onto 4400-{pad} when free.
  UPDATE public.chart_of_accounts c
  SET code = '4400-' || lpad(cust.id::text, 7, '0'),
      parent_id = rev_header_id,
      is_header = false,
      is_active = true,
      account_type = 'revenue',
      subtype = 'service',
      normal_balance = 'credit',
      metadata = COALESCE(c.metadata, '{}'::jsonb)
        || jsonb_build_object(
          'party_kind', 'member_rev',
          'party_ids', jsonb_build_array(cust.id),
          'rev_account_number', '4400-' || lpad(cust.id::text, 7, '0')
        )
  FROM public.customers cust
  WHERE c.profile_id = p_profile_id
    AND cust.profile_id = p_profile_id
    AND c.code ~ '^[0-9]+$'
    AND c.code::int >= 4401 AND c.code::int <= 4699
    AND COALESCE(c.is_header, false) = false
    AND (
      c.name ~* '^Member[[:space:]]+[—-]'
      OR lower(COALESCE(c.subtype, '')) = 'service'
    )
    AND (
      (cust.metadata->>'gl_account_id') ~ '^[0-9]+$'
        AND (cust.metadata->>'gl_account_id')::int = c.id
      OR cust.metadata->>'gl_account_code' = c.code
      OR (c.metadata->'party_ids' @> to_jsonb(cust.id))
      OR lower(trim(regexp_replace(c.name, '^Member[[:space:]]+[—-][[:space:]]*', '', 'i')))
           = lower(trim(COALESCE(cust.trading_name, cust.legal_name, '')))
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.chart_of_accounts x
      WHERE x.profile_id = p_profile_id
        AND x.id <> c.id
        AND x.code = '4400-' || lpad(cust.id::text, 7, '0')
    );

  -- Want taken: deactivate integer leftover.
  UPDATE public.chart_of_accounts leftover
  SET is_active = false,
      parent_id = rev_header_id
  FROM public.customers cust
  WHERE leftover.profile_id = p_profile_id
    AND cust.profile_id = p_profile_id
    AND leftover.code ~ '^[0-9]+$'
    AND leftover.code::int >= 4401 AND leftover.code::int <= 4699
    AND COALESCE(leftover.is_header, false) = false
    AND leftover.is_active IS DISTINCT FROM false
    AND (
      leftover.name ~* '^Member[[:space:]]+[—-]'
      OR lower(COALESCE(leftover.subtype, '')) = 'service'
    )
    AND (
      (cust.metadata->>'gl_account_id') ~ '^[0-9]+$'
        AND (cust.metadata->>'gl_account_id')::int = leftover.id
      OR cust.metadata->>'gl_account_code' = leftover.code
      OR (leftover.metadata->'party_ids' @> to_jsonb(cust.id))
      OR lower(trim(regexp_replace(leftover.name, '^Member[[:space:]]+[—-][[:space:]]*', '', 'i')))
           = lower(trim(COALESCE(cust.trading_name, cust.legal_name, '')))
    )
    AND EXISTS (
      SELECT 1 FROM public.chart_of_accounts x
      WHERE x.profile_id = p_profile_id
        AND x.id <> leftover.id
        AND x.code = '4400-' || lpad(cust.id::text, 7, '0')
    );

  -- Unmatched integer Member leaves with 0 journals: deactivate.
  UPDATE public.chart_of_accounts leftover
  SET is_active = false,
      parent_id = COALESCE(rev_header_id, leftover.parent_id)
  WHERE leftover.profile_id = p_profile_id
    AND leftover.code ~ '^[0-9]+$'
    AND leftover.code::int >= 4401 AND leftover.code::int <= 4699
    AND COALESCE(leftover.is_header, false) = false
    AND leftover.is_active IS DISTINCT FROM false
    AND (
      leftover.name ~* '^Member[[:space:]]+[—-]'
      OR (
        lower(COALESCE(leftover.subtype, '')) = 'service'
        AND rev_header_id IS NOT NULL
        AND leftover.parent_id = rev_header_id
      )
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.journal_lines jl
      WHERE jl.account_id = leftover.id
        AND jl.profile_id = p_profile_id
    );

  -- Unmatched with journals: nest under 4400, hide posting.
  UPDATE public.chart_of_accounts leftover
  SET is_active = false,
      parent_id = COALESCE(rev_header_id, leftover.parent_id)
  WHERE leftover.profile_id = p_profile_id
    AND leftover.code ~ '^[0-9]+$'
    AND leftover.code::int >= 4401 AND leftover.code::int <= 4699
    AND COALESCE(leftover.is_header, false) = false
    AND leftover.is_active IS DISTINCT FROM false
    AND leftover.name ~* '^Member[[:space:]]+[—-]'
    AND EXISTS (
      SELECT 1 FROM public.journal_lines jl
      WHERE jl.account_id = leftover.id
        AND jl.profile_id = p_profile_id
    );

  -- Parent padded 4400-* under the 4400 header.
  UPDATE public.chart_of_accounts c
  SET parent_id = rev_header_id,
      is_header = false,
      account_type = 'revenue',
      subtype = 'service'
  WHERE c.profile_id = p_profile_id
    AND rev_header_id IS NOT NULL
    AND c.id <> rev_header_id
    AND c.code LIKE '4400-%';

  -- Stamp member income code; never overwrite 1180 AR gl_account_code.
  UPDATE public.customers cust
  SET metadata = COALESCE(cust.metadata, '{}'::jsonb) || jsonb_build_object(
        'member_rev_account_code', '4400-' || lpad(cust.id::text, 7, '0')
      )
  WHERE cust.profile_id = p_profile_id
    AND EXISTS (
      SELECT 1 FROM public.chart_of_accounts x
      WHERE x.profile_id = p_profile_id
        AND x.code = '4400-' || lpad(cust.id::text, 7, '0')
        AND x.is_active IS DISTINCT FROM false
    );
END;
$$;

SELECT public.sa_brief36_recode_member_rev(110);
-- Do not run on 102.
-- Coach AP 2180-* backfills on CoA ensure (syncAdvisorContractorsToSuppliers), not this SQL.
