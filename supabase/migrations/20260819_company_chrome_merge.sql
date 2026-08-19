-- Workspace chrome is often a subset (sidenav order only). Returning it
-- instead of profile keys dropped enabled_modules and hid Advisor hubs
-- (GymAdvisor on VUKA Fitness). Always overlay: profile keys then workspace.

CREATE OR REPLACE FUNCTION public.sa_get_company_chrome(p_company_id integer)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ws jsonb;
  profile_chrome jsonb;
  keys text[] := ARRAY[
    'enabled_modules',
    'user_sidebar_orders',
    'os_entity_type',
    'os_sector',
    'os_industry',
    'os_industries',
    'os_business_type_id',
    'os_business_type_ids',
    'industry_packs',
    'industry_modules',
    'setup_status',
    'setup_path'
  ];
BEGIN
  profile_chrome := public.sa_get_profile_metadata_keys(p_company_id, keys);

  SELECT chrome INTO ws
  FROM public.company_workspace
  WHERE company_id = p_company_id;

  RETURN COALESCE(profile_chrome, '{}'::jsonb) || COALESCE(ws, '{}'::jsonb);
END;
$$;

COMMENT ON FUNCTION public.sa_get_company_chrome(integer) IS
  'Dashboard chrome: profile module/pack keys overlaid with workspace sidenav chrome.';
