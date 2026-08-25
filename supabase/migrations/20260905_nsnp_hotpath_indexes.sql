-- SchoolAdvisor hot path: composite indexes + one-round-trip agency summary.
-- Safe to re-run.

CREATE INDEX IF NOT EXISTS idx_school_agency_links_agency_status
  ON public.school_agency_links (agency_profile_id, status);

CREATE INDEX IF NOT EXISTS idx_nsnp_products_agency_active
  ON public.nsnp_approved_products (agency_profile_id, active)
  WHERE active IS DISTINCT FROM false;

CREATE INDEX IF NOT EXISTS idx_nsnp_recipes_agency_active
  ON public.nsnp_recipes (agency_profile_id, active);

CREATE INDEX IF NOT EXISTS idx_school_pos_isp_status
  ON public.school_purchase_orders (isp_profile_id, status);

CREATE INDEX IF NOT EXISTS idx_school_pos_school_date
  ON public.school_purchase_orders (school_profile_id, order_date);

CREATE INDEX IF NOT EXISTS idx_school_receipts_school_received
  ON public.school_kitchen_receipts (school_profile_id, received_at);

CREATE INDEX IF NOT EXISTS idx_nsnp_peu_visits_agency_date
  ON public.nsnp_peu_visits (agency_profile_id, visit_date);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'school_menu_cycles'
      AND column_name = 'is_agency_menu'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_school_menu_agency_live
      ON public.school_menu_cycles (agency_profile_id, active)
      WHERE is_agency_menu IS TRUE;
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'idx_school_menu_agency_live skip: %', SQLERRM;
END $$;

CREATE OR REPLACE FUNCTION public.sa_nsnp_agency_summary(p_agency_profile_id bigint)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'schoolCount', COUNT(*)::int,
    'activeLinks', COUNT(*) FILTER (WHERE l.status = 'active')::int,
    'pendingLinks', COUNT(*) FILTER (WHERE l.status = 'pending')::int,
    'suspendedLinks', COUNT(*) FILTER (WHERE l.status = 'suspended')::int,
    'totalLearners', COALESCE(
      SUM(s.learner_count_enrolled) FILTER (WHERE l.status = 'active'),
      0
    )::bigint,
    'totalVerified', COALESCE(
      SUM(s.learner_count_verified) FILTER (WHERE l.status = 'active'),
      0
    )::bigint,
    'totalNsnpApproved', COALESCE(
      SUM(s.learner_count_nsnp_eligible) FILTER (WHERE l.status = 'active'),
      0
    )::bigint
  )
  FROM public.school_agency_links l
  LEFT JOIN public.school_profiles s ON s.id = l.school_profile_id
  WHERE l.agency_profile_id = p_agency_profile_id
    AND l.status IN ('active', 'pending', 'suspended');
$$;

REVOKE ALL ON FUNCTION public.sa_nsnp_agency_summary(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sa_nsnp_agency_summary(bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.sa_nsnp_agency_summary(bigint) TO authenticated;

COMMENT ON FUNCTION public.sa_nsnp_agency_summary(bigint) IS
  'One-round-trip DBE school link + enrolment totals. Avoids paging 5k+ school_agency_links.';
