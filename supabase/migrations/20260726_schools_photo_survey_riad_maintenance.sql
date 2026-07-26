-- School photo, food surveys, maintenance register (RIAD uses module=schools on riad_logs)

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

SELECT public.sa_add_column('school_profiles', 'photo_url', 'text');
SELECT public.sa_add_column('school_profiles', 'photo_urls', 'jsonb');
SELECT public.sa_add_column('school_profiles', 'motto', 'text');
SELECT public.sa_add_column('school_profiles', 'about', 'text');

-- Public food satisfaction surveys (learners / parents / staff)
CREATE TABLE IF NOT EXISTS public.school_food_surveys (
  id bigserial PRIMARY KEY,
  school_profile_id bigint NOT NULL REFERENCES public.school_profiles(id) ON DELETE CASCADE,
  profile_id bigint NOT NULL,
  title text NOT NULL DEFAULT 'How was your school meal?',
  audience text NOT NULL DEFAULT 'learner', -- learner | parent | staff | visitor
  public_token text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  meal_type text DEFAULT 'lunch',
  questions jsonb DEFAULT '[]'::jsonb,
  response_count int DEFAULT 0,
  avg_rating numeric(4,2),
  starts_on date,
  ends_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_school_food_surveys_token
  ON public.school_food_surveys (public_token);
CREATE INDEX IF NOT EXISTS idx_school_food_surveys_school
  ON public.school_food_surveys (school_profile_id);

CREATE TABLE IF NOT EXISTS public.school_food_survey_responses (
  id bigserial PRIMARY KEY,
  survey_id bigint NOT NULL REFERENCES public.school_food_surveys(id) ON DELETE CASCADE,
  school_profile_id bigint NOT NULL,
  rating int NOT NULL CHECK (rating >= 1 AND rating <= 5),
  taste int CHECK (taste IS NULL OR (taste >= 1 AND taste <= 5)),
  portion int CHECK (portion IS NULL OR (portion >= 1 AND portion <= 5)),
  cleanliness int CHECK (cleanliness IS NULL OR (cleanliness >= 1 AND cleanliness <= 5)),
  variety int CHECK (variety IS NULL OR (variety >= 1 AND variety <= 5)),
  would_recommend boolean,
  comment text,
  respondent_role text, -- learner | parent | staff
  grade text,
  meal_date date,
  answers jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_school_food_resp_survey
  ON public.school_food_survey_responses (survey_id);
CREATE INDEX IF NOT EXISTS idx_school_food_resp_school
  ON public.school_food_survey_responses (school_profile_id);

-- School maintenance / facilities register
CREATE TABLE IF NOT EXISTS public.school_maintenance_items (
  id bigserial PRIMARY KEY,
  school_profile_id bigint NOT NULL REFERENCES public.school_profiles(id) ON DELETE CASCADE,
  profile_id bigint NOT NULL,
  title text NOT NULL,
  description text,
  area text, -- kitchen | classroom | ablution | grounds | roof | electrical | water | other
  priority text NOT NULL DEFAULT 'medium', -- low | medium | high | critical
  status text NOT NULL DEFAULT 'open', -- open | in_progress | waiting_parts | done | cancelled
  reported_by text,
  assigned_to text,
  cost_estimate numeric(12,2),
  cost_actual numeric(12,2),
  due_date date,
  completed_at timestamptz,
  photo_url text,
  notes text,
  linked_riad_id bigint,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_school_maint_school
  ON public.school_maintenance_items (school_profile_id, status);

COMMENT ON TABLE public.school_food_surveys IS 'Public QR food satisfaction surveys for NSNP meals';
COMMENT ON TABLE public.school_maintenance_items IS 'School facilities & kitchen maintenance register';
