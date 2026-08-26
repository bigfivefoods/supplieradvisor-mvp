-- SchoolAdvisor scale: 5k+ schools making POs / GRNs / serve-day.
-- Composite indexes + SQL rollups so hubs never page the full register.
-- Safe to re-run.

-- Identity lookups (hub / role / catalogue on every request)
CREATE INDEX IF NOT EXISTS idx_school_profiles_profile
  ON public.school_profiles (profile_id);

CREATE INDEX IF NOT EXISTS idx_nsnp_agency_profiles_profile
  ON public.nsnp_agency_profiles (profile_id);

CREATE INDEX IF NOT EXISTS idx_nsnp_isp_profiles_profile
  ON public.nsnp_isp_profiles (profile_id);

-- Transaction hot paths (school + SP)
CREATE INDEX IF NOT EXISTS idx_school_pos_school_status
  ON public.school_purchase_orders (school_profile_id, status);

CREATE INDEX IF NOT EXISTS idx_school_pos_isp_status_date
  ON public.school_purchase_orders (isp_profile_id, status, order_date);

CREATE INDEX IF NOT EXISTS idx_nsnp_deliv_school_status
  ON public.school_nsnp_deliveries (school_profile_id, status);

CREATE INDEX IF NOT EXISTS idx_nsnp_deliv_isp_status
  ON public.school_nsnp_deliveries (isp_profile_id, status);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'school_nsnp_deliveries'
      AND column_name = 'expected_date'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_nsnp_deliv_isp_expected
      ON public.school_nsnp_deliveries (isp_profile_id, expected_date);
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'idx_nsnp_deliv_isp_expected skip: %', SQLERRM;
END $$;

CREATE INDEX IF NOT EXISTS idx_school_isp_links_isp_status
  ON public.school_isp_links (isp_profile_id, status);

CREATE INDEX IF NOT EXISTS idx_school_isp_links_school_status
  ON public.school_isp_links (school_profile_id, status);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'school_kitchen_receipts'
      AND column_name = 'isp_profile_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_school_receipts_isp_received
      ON public.school_kitchen_receipts (isp_profile_id, received_at);
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'idx_school_receipts_isp_received skip: %', SQLERRM;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'school_kitchen_receipts'
      AND column_name = 'compliance_ok'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_school_receipts_compliance
      ON public.school_kitchen_receipts (school_profile_id, compliance_ok, received_at);
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'idx_school_receipts_compliance skip: %', SQLERRM;
END $$;

CREATE INDEX IF NOT EXISTS idx_school_agency_links_agency_status_school
  ON public.school_agency_links (agency_profile_id, status, school_profile_id);

CREATE INDEX IF NOT EXISTS idx_school_profiles_geo
  ON public.school_profiles (province, district);

CREATE INDEX IF NOT EXISTS idx_nsnp_isp_agency_links_agency_status
  ON public.nsnp_isp_agency_links (agency_profile_id, status);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'nsnp_prize_scores'
      AND column_name = 'computed_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_nsnp_prize_scores_school_computed
      ON public.nsnp_prize_scores (school_profile_id, computed_at DESC);
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'idx_nsnp_prize_scores_school_computed skip: %', SQLERRM;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'school_compliance_events'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_school_compliance_school_status
      ON public.school_compliance_events (school_profile_id, status);
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'idx_school_compliance_school_status skip: %', SQLERRM;
END $$;

CREATE INDEX IF NOT EXISTS idx_school_feeding_feed_date
  ON public.school_feeding_days (feed_date);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'nsnp_recipes'
      AND column_name = 'weekday'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_nsnp_recipes_agency_weekday
      ON public.nsnp_recipes (agency_profile_id, weekday)
      WHERE active IS DISTINCT FROM false;
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'idx_nsnp_recipes_agency_weekday skip: %', SQLERRM;
END $$;

-- Geo rollup in one round-trip (DBE districts / provinces / quintiles)
CREATE OR REPLACE FUNCTION public.sa_nsnp_geo_rollup(p_agency_profile_id bigint)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH linked AS (
    SELECT
      COALESCE(NULLIF(btrim(s.province), ''), 'Unknown') AS province,
      COALESCE(NULLIF(btrim(s.district), ''), 'Unknown') AS district,
      COALESCE(s.quintile::text, 'Unspecified') AS quintile,
      COALESCE(s.learner_count_enrolled, 0)::bigint AS learners,
      COALESCE(s.learner_count_verified, 0)::bigint AS verified
    FROM public.school_agency_links l
    JOIN public.school_profiles s ON s.id = l.school_profile_id
    WHERE l.agency_profile_id = p_agency_profile_id
      AND l.status = 'active'
  )
  SELECT jsonb_build_object(
    'byDistrict', (
      SELECT COALESCE(jsonb_agg(x ORDER BY x.schools DESC), '[]'::jsonb)
      FROM (
        SELECT district,
               COUNT(*)::int AS schools,
               SUM(learners)::bigint AS learners,
               SUM(verified)::bigint AS verified
        FROM linked
        GROUP BY district
      ) x
    ),
    'byProvince', (
      SELECT COALESCE(jsonb_agg(x ORDER BY x.schools DESC), '[]'::jsonb)
      FROM (
        SELECT province,
               COUNT(*)::int AS schools,
               SUM(learners)::bigint AS learners,
               SUM(verified)::bigint AS verified
        FROM linked
        GROUP BY province
      ) x
    ),
    'byQuintile', (
      SELECT COALESCE(jsonb_agg(x ORDER BY x.quintile), '[]'::jsonb)
      FROM (
        SELECT quintile,
               COUNT(*)::int AS schools,
               SUM(learners)::bigint AS learners
        FROM linked
        GROUP BY quintile
      ) x
    )
  );
$$;

REVOKE ALL ON FUNCTION public.sa_nsnp_geo_rollup(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sa_nsnp_geo_rollup(bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.sa_nsnp_geo_rollup(bigint) TO authenticated;

-- Hub / exception counts without paging 5k school ids
CREATE OR REPLACE FUNCTION public.sa_nsnp_network_ops(
  p_agency_profile_id bigint,
  p_as_of date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  late_n int := 0;
  offcat_n int := 0;
  claims_n int := 0;
  isp_pending int := 0;
  isp_active int := 0;
  cat_n int := 0;
  menu_n int := 0;
  recipe_n int := 0;
  cal_n int := 0;
BEGIN
  BEGIN
    SELECT COUNT(*)::int INTO late_n
    FROM public.school_nsnp_deliveries d
    INNER JOIN public.school_agency_links l
      ON l.school_profile_id = d.school_profile_id
     AND l.agency_profile_id = p_agency_profile_id
     AND l.status = 'active'
    WHERE d.status IN ('dispatched', 'delivered', 'confirmed')
      AND d.expected_date IS NOT NULL
      AND d.expected_date < p_as_of;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    late_n := 0;
  END;

  BEGIN
    SELECT COUNT(*)::int INTO offcat_n
    FROM public.school_kitchen_receipts r
    INNER JOIN public.school_agency_links l
      ON l.school_profile_id = r.school_profile_id
     AND l.agency_profile_id = p_agency_profile_id
     AND l.status = 'active'
    WHERE r.compliance_ok IS FALSE
      AND r.received_at >= ((p_as_of - 14)::timestamptz);
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    offcat_n := 0;
  END;

  BEGIN
    SELECT COUNT(*)::int INTO claims_n
    FROM public.nsnp_claim_packs
    WHERE agency_profile_id = p_agency_profile_id
      AND status = 'submitted';
  EXCEPTION WHEN undefined_table THEN
    claims_n := 0;
  END;

  BEGIN
    SELECT
      COUNT(*) FILTER (WHERE status = 'pending')::int,
      COUNT(*) FILTER (WHERE status = 'active')::int
    INTO isp_pending, isp_active
    FROM public.nsnp_isp_agency_links
    WHERE agency_profile_id = p_agency_profile_id;
  EXCEPTION WHEN undefined_table THEN
    isp_pending := 0;
    isp_active := 0;
  END;

  BEGIN
    SELECT COUNT(*)::int INTO cat_n
    FROM public.nsnp_approved_products
    WHERE agency_profile_id = p_agency_profile_id
      AND active IS DISTINCT FROM false;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    cat_n := 0;
  END;

  BEGIN
    SELECT CASE WHEN EXISTS (
      SELECT 1 FROM public.school_menu_cycles
      WHERE agency_profile_id = p_agency_profile_id
    ) THEN 1 ELSE 0 END INTO menu_n;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    menu_n := 0;
  END;

  BEGIN
    SELECT COUNT(*)::int INTO recipe_n
    FROM public.nsnp_recipes
    WHERE agency_profile_id = p_agency_profile_id
      AND active IS DISTINCT FROM false;
  EXCEPTION WHEN undefined_table THEN
    recipe_n := 0;
  END;

  BEGIN
    SELECT COUNT(*)::int INTO cal_n
    FROM public.nsnp_feeding_calendars
    WHERE agency_profile_id = p_agency_profile_id;
  EXCEPTION WHEN undefined_table THEN
    cal_n := 0;
  END;

  RETURN jsonb_build_object(
    'lateDeliveries', late_n,
    'offCatalogueReceipts14d', offcat_n,
    'submittedClaims', claims_n,
    'pendingIspLinks', isp_pending,
    'activeIspLinks', isp_active,
    'catalogueProducts', cat_n,
    'menus', menu_n,
    'recipes', recipe_n,
    'calendars', cal_n
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sa_nsnp_network_ops(bigint, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sa_nsnp_network_ops(bigint, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.sa_nsnp_network_ops(bigint, date) TO authenticated;

COMMENT ON FUNCTION public.sa_nsnp_geo_rollup(bigint) IS
  'DBE province/district/quintile school + learner totals. Avoids paging 5k school_profiles.';
COMMENT ON FUNCTION public.sa_nsnp_network_ops(bigint, date) IS
  'DBE hub counts (late DN, off-catalogue GRN, claims, catalogue) via joins — no 5k id list.';
