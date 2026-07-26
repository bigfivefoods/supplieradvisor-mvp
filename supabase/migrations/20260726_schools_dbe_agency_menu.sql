-- =============================================================================
-- Schools: DBE / governmental agency links + menu enhancements
-- =============================================================================

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

-- Governmental / DBE / PEU agency registry (company profile = agency workspace)
CREATE TABLE IF NOT EXISTS public.nsnp_agency_profiles (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL UNIQUE,
  agency_name text NOT NULL,
  agency_type text NOT NULL DEFAULT 'dbe',
  -- dbe | provincial_nsnp | district_peu | circuit | other
  province text,
  district text,
  contact_name text,
  contact_email text,
  contact_phone text,
  description text,
  status text NOT NULL DEFAULT 'active',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nsnp_agency_type ON public.nsnp_agency_profiles (agency_type);
CREATE INDEX IF NOT EXISTS idx_nsnp_agency_province ON public.nsnp_agency_profiles (province);

-- School joins / associates with agency (DBE sees linked schools)
CREATE TABLE IF NOT EXISTS public.school_agency_links (
  id bigserial PRIMARY KEY,
  school_profile_id bigint NOT NULL REFERENCES public.school_profiles(id) ON DELETE CASCADE,
  school_company_id bigint NOT NULL,
  agency_profile_id bigint NOT NULL, -- company id of DBE / PEU
  status text NOT NULL DEFAULT 'active',
  -- pending | active | suspended | left
  requested_by text,
  accepted_at timestamptz,
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_profile_id, agency_profile_id)
);

CREATE INDEX IF NOT EXISTS idx_school_agency_links_school ON public.school_agency_links (school_profile_id);
CREATE INDEX IF NOT EXISTS idx_school_agency_links_agency ON public.school_agency_links (agency_profile_id);
CREATE INDEX IF NOT EXISTS idx_school_agency_links_status ON public.school_agency_links (status);

-- Soft columns on school_profiles for primary agency
SELECT public.sa_add_column('school_profiles', 'primary_agency_profile_id', 'bigint');

-- Menu cycle extras
SELECT public.sa_add_column('school_menu_cycles', 'description', 'text');
SELECT public.sa_add_column('school_menu_cycles', 'meal_types', 'text[]');
SELECT public.sa_add_column('school_menu_cycles', 'is_template', 'boolean', 'false');

COMMENT ON TABLE public.nsnp_agency_profiles IS 'DBE / provincial NSNP / PEU governmental agencies on SupplierAdvisor';
COMMENT ON TABLE public.school_agency_links IS 'School association with DBE or PEU for programme oversight';
