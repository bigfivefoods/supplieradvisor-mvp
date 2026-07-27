-- KZN / provincial school registry fields for bulk NSNP import

SELECT public.sa_add_column('school_profiles', 'cmc', 'text');
SELECT public.sa_add_column('school_profiles', 'local_municipality', 'text');
SELECT public.sa_add_column('school_profiles', 'municipality_ward', 'text');
SELECT public.sa_add_column('school_profiles', 'natemis', 'text');
SELECT public.sa_add_column('school_profiles', 'level_label', 'text');
SELECT public.sa_add_column('school_profiles', 'nsnp_applic_enrol', 'int');
SELECT public.sa_add_column('school_profiles', 'final_emis_enrol', 'int');
SELECT public.sa_add_column('school_profiles', 'final_nsnp_approved_enrol', 'int');
SELECT public.sa_add_column('school_profiles', 'enrolment_year', 'text');
SELECT public.sa_add_column('school_profiles', 'registry_source', 'text');
SELECT public.sa_add_column('school_profiles', 'registry_imported_at', 'timestamptz');

-- Allow registry-only schools before a company claims them
-- (profile_id stays when company workspace exists; may be null for pure registry rows)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'school_profiles' AND column_name = 'profile_id'
  ) THEN
    BEGIN
      ALTER TABLE public.school_profiles ALTER COLUMN profile_id DROP NOT NULL;
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'profile_id already nullable or cannot alter: %', SQLERRM;
    END;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_school_profiles_natemis_unique
  ON public.school_profiles (natemis)
  WHERE natemis IS NOT NULL AND btrim(natemis) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_school_profiles_emis_unique
  ON public.school_profiles (emis_number)
  WHERE emis_number IS NOT NULL AND btrim(emis_number) <> '';

CREATE INDEX IF NOT EXISTS idx_school_profiles_cmc ON public.school_profiles (cmc);
CREATE INDEX IF NOT EXISTS idx_school_profiles_municipality ON public.school_profiles (local_municipality);

COMMENT ON COLUMN public.school_profiles.cmc IS 'Circuit Management Centre / CMC';
COMMENT ON COLUMN public.school_profiles.natemis IS 'National EMIS (NATEMIS) institution number';
COMMENT ON COLUMN public.school_profiles.nsnp_applic_enrol IS 'NSNP application enrolment (e.g. 26-27)';
COMMENT ON COLUMN public.school_profiles.final_emis_enrol IS 'Final EMIS enrolment count';
COMMENT ON COLUMN public.school_profiles.final_nsnp_approved_enrol IS 'Final NSNP approved enrolment';
