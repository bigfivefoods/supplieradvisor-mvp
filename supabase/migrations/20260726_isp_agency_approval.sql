-- ISP compliance is granted only by DBE / PEU / DoH agency (never self-serve)

CREATE OR REPLACE FUNCTION public.sa_add_column(p_table text, p_column text, p_type text, p_default text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = p_table
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = p_table AND column_name = p_column
  ) THEN
    IF p_default IS NULL THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN %I %s', p_table, p_column, p_type);
    ELSE
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN %I %s DEFAULT %s', p_table, p_column, p_type, p_default);
    END IF;
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'sa_add_column %.% skip: %', p_table, p_column, SQLERRM;
END;
$$;

SELECT public.sa_add_column('nsnp_isp_profiles', 'approved_by_agency_profile_id', 'bigint');
SELECT public.sa_add_column('nsnp_isp_profiles', 'approved_at', 'timestamptz');
SELECT public.sa_add_column('nsnp_isp_profiles', 'approved_by_user_id', 'text');
SELECT public.sa_add_column('nsnp_isp_profiles', 'rejection_reason', 'text');
SELECT public.sa_add_column('nsnp_isp_profiles', 'suspended_at', 'timestamptz');
SELECT public.sa_add_column('nsnp_isp_profiles', 'suspension_reason', 'text');

CREATE INDEX IF NOT EXISTS idx_nsnp_isp_compliance
  ON public.nsnp_isp_profiles (compliance_status);

COMMENT ON COLUMN public.nsnp_isp_profiles.approved_by_agency_profile_id IS
  'DBE/PEU/DoH company id that approved this ISP for programme deliveries';
