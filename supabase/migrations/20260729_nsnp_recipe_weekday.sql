-- Assign each programme recipe BOM to a school weekday (Mon–Fri) for menu grouping.
-- 1=Monday … 5=Friday; NULL = unassigned (shown under "Unassigned" in UI).

SELECT public.sa_add_column('nsnp_recipes', 'weekday', 'int');

COMMENT ON COLUMN public.nsnp_recipes.weekday IS
  'School weekday 1=Mon … 5=Fri for weekly menu grouping; null = unassigned.';

CREATE INDEX IF NOT EXISTS idx_nsnp_recipes_weekday
  ON public.nsnp_recipes (agency_profile_id, weekday, meal_type);
