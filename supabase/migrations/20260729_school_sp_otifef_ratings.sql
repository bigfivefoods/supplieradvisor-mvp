-- SP OTIFEF metrics + school ratings of SPs and food (constructive feedback)

-- Persist rolling OTIFEF on SP profile
SELECT public.sa_add_column('nsnp_isp_profiles', 'delivery_otifef_pct', 'numeric(6,2)', '0');
SELECT public.sa_add_column('nsnp_isp_profiles', 'otif_on_time_pct', 'numeric(6,2)');
SELECT public.sa_add_column('nsnp_isp_profiles', 'otif_in_full_pct', 'numeric(6,2)');
SELECT public.sa_add_column('nsnp_isp_profiles', 'otif_error_free_pct', 'numeric(6,2)');
SELECT public.sa_add_column('nsnp_isp_profiles', 'avg_school_rating', 'numeric(4,2)');
SELECT public.sa_add_column('nsnp_isp_profiles', 'otifef_updated_at', 'timestamptz');

-- School rates linked service provider (subjective + OTIFEF dimensions)
CREATE TABLE IF NOT EXISTS public.school_isp_ratings (
  id bigserial PRIMARY KEY,
  school_profile_id bigint NOT NULL,
  profile_id bigint NOT NULL, -- school company
  isp_profile_id bigint NOT NULL,
  -- Overall 1–5 stars
  overall_rating numeric(3,1) NOT NULL,
  -- OTIFEF dimension scores 1–5 (optional; overall required)
  on_time_rating numeric(3,1),
  in_full_rating numeric(3,1),
  error_free_rating numeric(3,1),
  communication_rating numeric(3,1),
  constructive_feedback text,
  would_recommend boolean,
  period_from date,
  period_to date,
  po_id bigint,
  delivery_id bigint,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_school_isp_ratings_school
  ON public.school_isp_ratings (school_profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_school_isp_ratings_isp
  ON public.school_isp_ratings (isp_profile_id, created_at DESC);

-- School kitchen/staff rates food quality (constructive feedback for continuous improvement)
CREATE TABLE IF NOT EXISTS public.school_food_ratings (
  id bigserial PRIMARY KEY,
  school_profile_id bigint NOT NULL,
  profile_id bigint NOT NULL,
  feed_date date NOT NULL DEFAULT CURRENT_DATE,
  meal_type text NOT NULL DEFAULT 'lunch', -- breakfast | lunch | snack
  -- Overall 1–5
  overall_rating numeric(3,1) NOT NULL,
  taste_rating numeric(3,1),
  portion_rating numeric(3,1),
  appearance_rating numeric(3,1),
  temperature_rating numeric(3,1),
  menu_adherence_rating numeric(3,1),
  constructive_feedback text,
  what_worked text,
  what_to_improve text,
  isp_profile_id bigint, -- optional: food linked to supplying SP
  recipe_name text,
  menu_name text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_school_food_ratings_school
  ON public.school_food_ratings (school_profile_id, feed_date DESC);

COMMENT ON TABLE public.school_isp_ratings IS
  'School ratings of linked SPs — OTIFEF dimensions + constructive feedback';
COMMENT ON TABLE public.school_food_ratings IS
  'School kitchen/staff food quality ratings with constructive improvement notes';
