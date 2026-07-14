-- Reseller field feedback: product / price / brand stars + free text for product development

CREATE TABLE IF NOT EXISTS public.reseller_customer_feedback (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL,
  reseller_id BIGINT NOT NULL,
  container_id BIGINT,
  sale_id BIGINT,
  product_id BIGINT,
  product_name TEXT NOT NULL DEFAULT 'Product',
  sku TEXT,
  -- Star ratings 1–5 (NULL = not rated)
  rating_product NUMERIC(3,1),
  rating_price NUMERIC(3,1),
  rating_brand NUMERIC(3,1),
  rating_value NUMERIC(3,1),
  rating_packaging NUMERIC(3,1),
  rating_overall NUMERIC(3,1),
  free_text TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  customer_location TEXT,
  source TEXT NOT NULL DEFAULT 'reseller_portal',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reseller_feedback_profile
  ON public.reseller_customer_feedback(profile_id);
CREATE INDEX IF NOT EXISTS idx_reseller_feedback_reseller
  ON public.reseller_customer_feedback(reseller_id);
CREATE INDEX IF NOT EXISTS idx_reseller_feedback_product
  ON public.reseller_customer_feedback(profile_id, product_name);
CREATE INDEX IF NOT EXISTS idx_reseller_feedback_created
  ON public.reseller_customer_feedback(created_at DESC);

-- RLS deny anon/authenticated (service-role APIs only)
DO $$
BEGIN
  BEGIN
    ALTER TABLE public.reseller_customer_feedback ENABLE ROW LEVEL SECURITY;
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'feedback RLS enable skip: %', SQLERRM;
  END;
  BEGIN
    DROP POLICY IF EXISTS sa_deny_anon ON public.reseller_customer_feedback;
    CREATE POLICY sa_deny_anon ON public.reseller_customer_feedback
      FOR ALL TO anon USING (false) WITH CHECK (false);
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'feedback deny anon skip: %', SQLERRM;
  END;
  BEGIN
    DROP POLICY IF EXISTS sa_deny_authenticated ON public.reseller_customer_feedback;
    CREATE POLICY sa_deny_authenticated ON public.reseller_customer_feedback
      FOR ALL TO authenticated USING (false) WITH CHECK (false);
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'feedback deny auth skip: %', SQLERRM;
  END;
END $$;

NOTIFY pgrst, 'reload schema';

COMMENT ON TABLE public.reseller_customer_feedback IS
  'Field customer feedback captured by resellers — product/price/brand stars + free text for product development & pricing';
