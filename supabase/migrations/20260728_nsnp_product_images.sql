-- DBE approved catalogue product images (visible to schools & SPs)
SELECT public.sa_add_column('nsnp_approved_products', 'image_url', 'text');

COMMENT ON COLUMN public.nsnp_approved_products.image_url IS
  'Public URL of the product photo. Set by DBE/PEU on the approved catalogue; shown to associated schools and service providers.';

-- Supplier origin province already exists on nsnp_approved_products.province from
-- 20260726_schools_nsnp_module.sql — document intended meaning for catalogue UX.
COMMENT ON COLUMN public.nsnp_approved_products.province IS
  'South African province where the food supplier / producer is based. Set by DBE on the approved catalogue; visible to schools and service providers.';
