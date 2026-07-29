-- Kitchen stock cover planning: days of stock to hold + reorder cover + levels

SELECT public.sa_add_column('school_kitchen_stock', 'reorder_level', 'numeric(14,3)');
SELECT public.sa_add_column('school_kitchen_stock', 'min_level', 'numeric(14,3)');
SELECT public.sa_add_column('school_kitchen_stock', 'target_level', 'numeric(14,3)');
-- Optional per-product override for cover days (null = use school default)
SELECT public.sa_add_column('school_kitchen_stock', 'cover_days', 'int');
SELECT public.sa_add_column('school_kitchen_stock', 'reorder_cover_days', 'int');

SELECT public.sa_add_column('school_profiles', 'kitchen_stock_cover_days', 'int', '14');
SELECT public.sa_add_column('school_profiles', 'kitchen_reorder_cover_days', 'int', '5');
SELECT public.sa_add_column('school_profiles', 'kitchen_lead_time_days', 'int', '3');

COMMENT ON COLUMN public.school_profiles.kitchen_stock_cover_days IS
  'Target days of stock to hold based on menu demand (default 14)';
COMMENT ON COLUMN public.school_profiles.kitchen_reorder_cover_days IS
  'Reorder when on-hand cover falls to this many days (default 5)';
COMMENT ON COLUMN public.school_profiles.kitchen_lead_time_days IS
  'Typical SP delivery lead time days for critical prompts';
