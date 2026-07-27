-- Provincial SP (service provider) registry for DBE bulk import
-- Columns: District · Cluster allocation · Name of service provider · CSD number

SELECT public.sa_add_column('nsnp_isp_profiles', 'csd_number', 'text');
SELECT public.sa_add_column('nsnp_isp_profiles', 'district', 'text');
SELECT public.sa_add_column('nsnp_isp_profiles', 'cluster_allocation', 'text');
SELECT public.sa_add_column('nsnp_isp_profiles', 'registry_source', 'text');
SELECT public.sa_add_column('nsnp_isp_profiles', 'registry_imported_at', 'timestamptz');

CREATE UNIQUE INDEX IF NOT EXISTS idx_nsnp_isp_csd_unique
  ON public.nsnp_isp_profiles (csd_number)
  WHERE csd_number IS NOT NULL AND btrim(csd_number) <> '';

CREATE INDEX IF NOT EXISTS idx_nsnp_isp_district
  ON public.nsnp_isp_profiles (district);

CREATE INDEX IF NOT EXISTS idx_nsnp_isp_cluster
  ON public.nsnp_isp_profiles (cluster_allocation);

COMMENT ON COLUMN public.nsnp_isp_profiles.csd_number IS
  'Central Supplier Database (CSD) number';
COMMENT ON COLUMN public.nsnp_isp_profiles.cluster_allocation IS
  'Education cluster allocation for NSNP supply';
COMMENT ON COLUMN public.nsnp_isp_profiles.district IS
  'Education district the SP is allocated to';
