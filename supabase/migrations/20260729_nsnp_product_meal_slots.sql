-- Mark each approved catalogue product for breakfast and/or lunch menu slots.
-- DBE sets these on the catalogue; menu UI only shows products tagged for that meal.

SELECT public.sa_add_column(
  'nsnp_approved_products',
  'for_breakfast',
  'boolean',
  'true'
);
SELECT public.sa_add_column(
  'nsnp_approved_products',
  'for_lunch',
  'boolean',
  'true'
);

COMMENT ON COLUMN public.nsnp_approved_products.for_breakfast IS
  'When true, product may appear under Breakfast on the department mandated menu';
COMMENT ON COLUMN public.nsnp_approved_products.for_lunch IS
  'When true, product may appear under Lunch on the department mandated menu';

-- Prefer sensible defaults by category where still both-true (new columns default true)
UPDATE public.nsnp_approved_products
SET for_breakfast = true,
    for_lunch = false
WHERE COALESCE(for_breakfast, true) = true
  AND COALESCE(for_lunch, true) = true
  AND lower(coalesce(category, '')) ~ '(porridge|cereal|oats)';

UPDATE public.nsnp_approved_products
SET for_breakfast = false,
    for_lunch = true
WHERE COALESCE(for_breakfast, true) = true
  AND COALESCE(for_lunch, true) = true
  AND lower(coalesce(category, '')) ~ '(samp|rice|beans|lentils|peas|soya|oil|vegetables|stock|soup|ready_meal|flour|salt)';
