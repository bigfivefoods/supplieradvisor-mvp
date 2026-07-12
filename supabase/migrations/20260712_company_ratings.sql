-- General peer company star ratings (subjective feedback).
-- Distinct from OTIFEF (objective PO performance on purchase_orders).
-- One published rating per rater → ratee → role (supplier | customer | partner).

CREATE TABLE IF NOT EXISTS public.company_ratings (
  id BIGSERIAL PRIMARY KEY,
  rater_profile_id BIGINT NOT NULL,
  ratee_profile_id BIGINT NOT NULL,
  ratee_role TEXT NOT NULL DEFAULT 'supplier'
    CHECK (ratee_role IN ('supplier', 'customer', 'partner')),
  overall INT NOT NULL CHECK (overall >= 1 AND overall <= 5),
  quality INT CHECK (quality IS NULL OR (quality >= 1 AND quality <= 5)),
  delivery INT CHECK (delivery IS NULL OR (delivery >= 1 AND delivery <= 5)),
  communication INT CHECK (communication IS NULL OR (communication >= 1 AND communication <= 5)),
  value INT CHECK (value IS NULL OR (value >= 1 AND value <= 5)),
  payment INT CHECK (payment IS NULL OR (payment >= 1 AND payment <= 5)),
  reliability INT CHECK (reliability IS NULL OR (reliability >= 1 AND reliability <= 5)),
  comment TEXT,
  status TEXT NOT NULL DEFAULT 'published'
    CHECK (status IN ('published', 'hidden')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT company_ratings_parties_chk CHECK (rater_profile_id <> ratee_profile_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_company_ratings_unique_pair
  ON public.company_ratings (rater_profile_id, ratee_profile_id, ratee_role)
  WHERE status = 'published';

CREATE INDEX IF NOT EXISTS idx_company_ratings_ratee
  ON public.company_ratings (ratee_profile_id, status, overall);

CREATE INDEX IF NOT EXISTS idx_company_ratings_rater
  ON public.company_ratings (rater_profile_id, ratee_role);

COMMENT ON TABLE public.company_ratings IS
  'Subjective 1–5 star peer ratings between companies. OTIFEF remains PO-based objective score.';

DO $$
BEGIN
  ALTER TABLE public.company_ratings ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS deny_anon_all ON public.company_ratings;
  CREATE POLICY deny_anon_all ON public.company_ratings
    FOR ALL TO anon USING (false) WITH CHECK (false);
EXCEPTION WHEN others THEN
  RAISE NOTICE 'company_ratings RLS skip: %', SQLERRM;
END $$;
