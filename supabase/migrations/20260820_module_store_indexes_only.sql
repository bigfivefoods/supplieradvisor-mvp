-- SUPERSEDED by 20260820_module_store_secure.sql and 20260821_saas_db_harden.sql.
-- Do not re-run this file on its own: it writes indexes without the module allowlist.
-- Gym/clinic module data lives in company_module_stores.

CREATE OR REPLACE FUNCTION public.sa_put_module_store(
  p_company_id integer,
  p_module text,
  p_data jsonb,
  p_indexes jsonb DEFAULT '{}'::jsonb,
  p_public_token text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.company_module_stores (
    company_id, module, data, public_token, updated_at
  )
  VALUES (
    p_company_id,
    p_module,
    COALESCE(p_data, '{}'::jsonb),
    NULLIF(trim(COALESCE(p_public_token, '')), ''),
    now()
  )
  ON CONFLICT (company_id, module) DO UPDATE
    SET
      data = EXCLUDED.data,
      public_token = EXCLUDED.public_token,
      updated_at = now();

  PERFORM public.sa_merge_profile_metadata(
    p_company_id,
    COALESCE(p_indexes, '{}'::jsonb)
  );
END;
$$;

COMMENT ON FUNCTION public.sa_put_module_store(integer, text, jsonb, jsonb, text) IS
  'Write one Advisor module row. Metadata only gets token indexes, not the full store.';
