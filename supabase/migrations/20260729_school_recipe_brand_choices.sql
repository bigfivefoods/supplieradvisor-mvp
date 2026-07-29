-- School brand choice per DBE recipe BOM line (e.g. pick Imana vs Big Five soya).
-- Qty remains from the DBE BOM; only the approved product / brand is school-selected.

CREATE TABLE IF NOT EXISTS public.school_nsnp_recipe_brand_choices (
  id bigserial PRIMARY KEY,
  school_profile_id bigint NOT NULL,
  profile_id bigint NOT NULL, -- school company
  recipe_id bigint NOT NULL,
  recipe_line_id bigint NOT NULL,
  -- DBE default product on the BOM
  default_product_id bigint,
  category text,
  -- School's chosen brand / product (must be on agency approved list)
  chosen_product_id bigint NOT NULL,
  chosen_product_name text,
  chosen_brand_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_profile_id, recipe_line_id)
);

CREATE INDEX IF NOT EXISTS idx_school_recipe_brand_school
  ON public.school_nsnp_recipe_brand_choices (school_profile_id);

CREATE INDEX IF NOT EXISTS idx_school_recipe_brand_recipe
  ON public.school_nsnp_recipe_brand_choices (recipe_id);

COMMENT ON TABLE public.school_nsnp_recipe_brand_choices IS
  'School selection of brand/product for each DBE recipe BOM line (same category range)';
