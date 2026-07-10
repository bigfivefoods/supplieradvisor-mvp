-- Multi-company pricing agreements / list prices + product chain pedigree
-- Seller company grants agreed unit prices to a connected buyer company.
-- Sales companies further up the chain import products (with specs) and set higher on-sell prices.

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

-- ─── Pricing agreements (header) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pricing_agreements (
  id bigserial PRIMARY KEY,
  seller_profile_id bigint NOT NULL,
  buyer_profile_id bigint NOT NULL,
  title text NOT NULL,
  agreement_number text,
  status text DEFAULT 'draft', -- draft | active | suspended | expired | cancelled
  currency text DEFAULT 'ZAR',
  effective_from date,
  effective_to date,
  payment_terms text,
  notes text,
  connection_id bigint,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

SELECT public.sa_add_column('pricing_agreements', 'seller_profile_id', 'bigint');
SELECT public.sa_add_column('pricing_agreements', 'buyer_profile_id', 'bigint');
SELECT public.sa_add_column('pricing_agreements', 'title', 'text');
SELECT public.sa_add_column('pricing_agreements', 'agreement_number', 'text');
SELECT public.sa_add_column('pricing_agreements', 'status', 'text', '''draft''');
SELECT public.sa_add_column('pricing_agreements', 'currency', 'text', '''ZAR''');
SELECT public.sa_add_column('pricing_agreements', 'effective_from', 'date');
SELECT public.sa_add_column('pricing_agreements', 'effective_to', 'date');
SELECT public.sa_add_column('pricing_agreements', 'payment_terms', 'text');
SELECT public.sa_add_column('pricing_agreements', 'notes', 'text');
SELECT public.sa_add_column('pricing_agreements', 'connection_id', 'bigint');
SELECT public.sa_add_column('pricing_agreements', 'metadata', 'jsonb', '''{}''::jsonb');
SELECT public.sa_add_column('pricing_agreements', 'created_by', 'text');
SELECT public.sa_add_column('pricing_agreements', 'created_at', 'timestamptz', 'now()');
SELECT public.sa_add_column('pricing_agreements', 'updated_at', 'timestamptz', 'now()');

CREATE INDEX IF NOT EXISTS idx_pa_seller ON public.pricing_agreements (seller_profile_id);
CREATE INDEX IF NOT EXISTS idx_pa_buyer ON public.pricing_agreements (buyer_profile_id);
CREATE INDEX IF NOT EXISTS idx_pa_status ON public.pricing_agreements (status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_pa_seller_buyer_title
  ON public.pricing_agreements (seller_profile_id, buyer_profile_id, title)
  WHERE status IN ('draft', 'active');

-- ─── Pricing agreement lines (SKU list prices) ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.pricing_agreement_lines (
  id bigserial PRIMARY KEY,
  agreement_id bigint NOT NULL,
  seller_product_id bigint,
  product_name text NOT NULL,
  sku text,
  uom text DEFAULT 'unit',
  list_price numeric(18,4) NOT NULL DEFAULT 0,
  min_qty numeric(18,4) DEFAULT 1,
  max_qty numeric(18,4),
  currency text,
  discount_pct numeric(8,4) DEFAULT 0,
  notes text,
  -- optional on-sell guidance for buyer (not binding)
  suggested_resale_price numeric(18,4),
  specs_sheet_url text,
  specs_sheet_name text,
  primary_image_url text,
  sort_order integer DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

SELECT public.sa_add_column('pricing_agreement_lines', 'agreement_id', 'bigint');
SELECT public.sa_add_column('pricing_agreement_lines', 'seller_product_id', 'bigint');
SELECT public.sa_add_column('pricing_agreement_lines', 'product_name', 'text');
SELECT public.sa_add_column('pricing_agreement_lines', 'sku', 'text');
SELECT public.sa_add_column('pricing_agreement_lines', 'uom', 'text', '''unit''');
SELECT public.sa_add_column('pricing_agreement_lines', 'list_price', 'numeric(18,4)', '0');
SELECT public.sa_add_column('pricing_agreement_lines', 'min_qty', 'numeric(18,4)', '1');
SELECT public.sa_add_column('pricing_agreement_lines', 'max_qty', 'numeric(18,4)');
SELECT public.sa_add_column('pricing_agreement_lines', 'currency', 'text');
SELECT public.sa_add_column('pricing_agreement_lines', 'discount_pct', 'numeric(8,4)', '0');
SELECT public.sa_add_column('pricing_agreement_lines', 'notes', 'text');
SELECT public.sa_add_column('pricing_agreement_lines', 'suggested_resale_price', 'numeric(18,4)');
SELECT public.sa_add_column('pricing_agreement_lines', 'specs_sheet_url', 'text');
SELECT public.sa_add_column('pricing_agreement_lines', 'specs_sheet_name', 'text');
SELECT public.sa_add_column('pricing_agreement_lines', 'primary_image_url', 'text');
SELECT public.sa_add_column('pricing_agreement_lines', 'sort_order', 'integer', '0');
SELECT public.sa_add_column('pricing_agreement_lines', 'metadata', 'jsonb', '''{}''::jsonb');
SELECT public.sa_add_column('pricing_agreement_lines', 'created_at', 'timestamptz', 'now()');
SELECT public.sa_add_column('pricing_agreement_lines', 'updated_at', 'timestamptz', 'now()');

CREATE INDEX IF NOT EXISTS idx_pal_agreement ON public.pricing_agreement_lines (agreement_id);
CREATE INDEX IF NOT EXISTS idx_pal_seller_product ON public.pricing_agreement_lines (seller_product_id);
CREATE INDEX IF NOT EXISTS idx_pal_sku ON public.pricing_agreement_lines (sku);

-- ─── Product chain pedigree (import from upstream seller) ──────────────────
SELECT public.sa_add_column('products', 'source_profile_id', 'bigint');
SELECT public.sa_add_column('products', 'source_product_id', 'bigint');
SELECT public.sa_add_column('products', 'source_agreement_id', 'bigint');
SELECT public.sa_add_column('products', 'source_agreement_line_id', 'bigint');
SELECT public.sa_add_column('products', 'upstream_specs_sheet_url', 'text');
SELECT public.sa_add_column('products', 'upstream_specs_sheet_name', 'text');

CREATE INDEX IF NOT EXISTS idx_products_source_profile ON public.products (source_profile_id);
CREATE INDEX IF NOT EXISTS idx_products_source_product ON public.products (source_product_id);

SELECT 'pricing_agreements' AS t, count(*)::text AS n FROM information_schema.columns
WHERE table_schema='public' AND table_name='pricing_agreements'
UNION ALL
SELECT 'pricing_agreement_lines', count(*)::text FROM information_schema.columns
WHERE table_schema='public' AND table_name='pricing_agreement_lines';
