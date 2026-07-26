-- =============================================================================
-- DBE / agency-owned NSNP approved catalogue
-- Each agency (DBE, provincial PEU) publishes brands/products schools & ISPs
-- must buy and supply. NULL agency_profile_id = national/platform fallback list.
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

SELECT public.sa_add_column('nsnp_approved_brands', 'agency_profile_id', 'bigint');
SELECT public.sa_add_column('nsnp_approved_products', 'agency_profile_id', 'bigint');
SELECT public.sa_add_column('nsnp_approved_products', 'published_at', 'timestamptz');
SELECT public.sa_add_column('nsnp_approved_brands', 'published_at', 'timestamptz');

-- Allow same brand name under different agencies
DROP INDEX IF EXISTS public.idx_nsnp_brands_name_lower;
CREATE UNIQUE INDEX IF NOT EXISTS idx_nsnp_brands_agency_name
  ON public.nsnp_approved_brands (COALESCE(agency_profile_id, 0), lower(name));

CREATE INDEX IF NOT EXISTS idx_nsnp_brands_agency
  ON public.nsnp_approved_brands (agency_profile_id);
CREATE INDEX IF NOT EXISTS idx_nsnp_products_agency
  ON public.nsnp_approved_products (agency_profile_id);

COMMENT ON COLUMN public.nsnp_approved_products.agency_profile_id IS
  'Owning DBE/PEU company profile_id; NULL = platform/national fallback list';
