-- Reseller field RIAD (Risk · Issue · Action · Decision) — problems from the last mile

CREATE TABLE IF NOT EXISTS public.reseller_riad (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL,
  reseller_id BIGINT NOT NULL,
  container_id BIGINT,
  product_id BIGINT,
  product_name TEXT,
  sku TEXT,
  riad_type TEXT NOT NULL DEFAULT 'issue',
  -- risk | issue | action | decision
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  -- open | in_progress | mitigated | resolved | closed | on_hold
  priority TEXT NOT NULL DEFAULT 'medium',
  -- low | medium | high | critical
  category TEXT,
  owner_name TEXT,
  severity INT,
  likelihood INT,
  time_horizon INT,
  rpn INT,
  mitigation_plan TEXT,
  resolution TEXT,
  notes TEXT,
  due_date DATE,
  closed_at TIMESTAMPTZ,
  created_by TEXT,
  created_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reseller_riad_profile ON public.reseller_riad(profile_id);
CREATE INDEX IF NOT EXISTS idx_reseller_riad_reseller ON public.reseller_riad(reseller_id);
CREATE INDEX IF NOT EXISTS idx_reseller_riad_status ON public.reseller_riad(profile_id, status);
CREATE INDEX IF NOT EXISTS idx_reseller_riad_type ON public.reseller_riad(profile_id, riad_type);
CREATE INDEX IF NOT EXISTS idx_reseller_riad_created ON public.reseller_riad(created_at DESC);

DO $$
BEGIN
  BEGIN
    ALTER TABLE public.reseller_riad ENABLE ROW LEVEL SECURITY;
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'reseller_riad RLS enable skip: %', SQLERRM;
  END;
  BEGIN
    DROP POLICY IF EXISTS sa_deny_anon ON public.reseller_riad;
    CREATE POLICY sa_deny_anon ON public.reseller_riad
      FOR ALL TO anon USING (false) WITH CHECK (false);
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'reseller_riad deny anon skip: %', SQLERRM;
  END;
  BEGIN
    DROP POLICY IF EXISTS sa_deny_authenticated ON public.reseller_riad;
    CREATE POLICY sa_deny_authenticated ON public.reseller_riad
      FOR ALL TO authenticated USING (false) WITH CHECK (false);
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'reseller_riad deny auth skip: %', SQLERRM;
  END;
END $$;

NOTIFY pgrst, 'reload schema';

COMMENT ON TABLE public.reseller_riad IS
  'Field RIAD entries logged by container resellers — risks/issues/actions/decisions for product ops & pricing';
