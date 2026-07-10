-- Marketplace: sell inventory products on the network (public or connected-only)
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

CREATE TABLE IF NOT EXISTS public.marketplace_listings (
  id bigserial PRIMARY KEY,
  seller_profile_id bigint NOT NULL,
  product_id bigint,
  title text NOT NULL,
  description text,
  category text,
  product_type text,
  sku text,
  uom text DEFAULT 'unit',
  unit_price numeric(18,4) DEFAULT 0,
  currency text DEFAULT 'ZAR',
  min_order_qty numeric(18,4) DEFAULT 1,
  moq_note text,
  visibility text DEFAULT 'public', -- public | connected
  status text DEFAULT 'active',     -- draft | active | paused | archived
  primary_image_url text,
  show_stock boolean DEFAULT false,
  stock_qty_snapshot numeric(18,4),
  lead_time_days integer,
  incoterms text,
  origin_country text,
  origin_city text,
  tags text[] DEFAULT '{}',
  public_id text,
  onchain_hash text,
  onchain_status text,
  metadata jsonb DEFAULT '{}'::jsonb,
  published_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

SELECT public.sa_add_column('marketplace_listings', 'seller_profile_id', 'bigint');
SELECT public.sa_add_column('marketplace_listings', 'product_id', 'bigint');
SELECT public.sa_add_column('marketplace_listings', 'title', 'text');
SELECT public.sa_add_column('marketplace_listings', 'description', 'text');
SELECT public.sa_add_column('marketplace_listings', 'category', 'text');
SELECT public.sa_add_column('marketplace_listings', 'product_type', 'text');
SELECT public.sa_add_column('marketplace_listings', 'sku', 'text');
SELECT public.sa_add_column('marketplace_listings', 'uom', 'text', '''unit''');
SELECT public.sa_add_column('marketplace_listings', 'unit_price', 'numeric(18,4)', '0');
SELECT public.sa_add_column('marketplace_listings', 'currency', 'text', '''ZAR''');
SELECT public.sa_add_column('marketplace_listings', 'min_order_qty', 'numeric(18,4)', '1');
SELECT public.sa_add_column('marketplace_listings', 'moq_note', 'text');
SELECT public.sa_add_column('marketplace_listings', 'visibility', 'text', '''public''');
SELECT public.sa_add_column('marketplace_listings', 'status', 'text', '''active''');
SELECT public.sa_add_column('marketplace_listings', 'primary_image_url', 'text');
SELECT public.sa_add_column('marketplace_listings', 'show_stock', 'boolean', 'false');
SELECT public.sa_add_column('marketplace_listings', 'stock_qty_snapshot', 'numeric(18,4)');
SELECT public.sa_add_column('marketplace_listings', 'lead_time_days', 'integer');
SELECT public.sa_add_column('marketplace_listings', 'incoterms', 'text');
SELECT public.sa_add_column('marketplace_listings', 'origin_country', 'text');
SELECT public.sa_add_column('marketplace_listings', 'origin_city', 'text');
SELECT public.sa_add_column('marketplace_listings', 'tags', 'text[]', '''{}''');
SELECT public.sa_add_column('marketplace_listings', 'public_id', 'text');
SELECT public.sa_add_column('marketplace_listings', 'onchain_hash', 'text');
SELECT public.sa_add_column('marketplace_listings', 'onchain_status', 'text');
SELECT public.sa_add_column('marketplace_listings', 'metadata', 'jsonb', '''{}''::jsonb');
SELECT public.sa_add_column('marketplace_listings', 'published_at', 'timestamptz');
SELECT public.sa_add_column('marketplace_listings', 'created_at', 'timestamptz', 'now()');
SELECT public.sa_add_column('marketplace_listings', 'updated_at', 'timestamptz', 'now()');

CREATE INDEX IF NOT EXISTS idx_mpl_seller ON public.marketplace_listings (seller_profile_id);
CREATE INDEX IF NOT EXISTS idx_mpl_status ON public.marketplace_listings (status);
CREATE INDEX IF NOT EXISTS idx_mpl_visibility ON public.marketplace_listings (visibility);
CREATE INDEX IF NOT EXISTS idx_mpl_product ON public.marketplace_listings (product_id);
CREATE INDEX IF NOT EXISTS idx_mpl_category ON public.marketplace_listings (category);

CREATE TABLE IF NOT EXISTS public.marketplace_inquiries (
  id bigserial PRIMARY KEY,
  listing_id bigint NOT NULL,
  buyer_profile_id bigint NOT NULL,
  seller_profile_id bigint NOT NULL,
  quantity numeric(18,4) DEFAULT 1,
  unit_price numeric(18,4),
  currency text DEFAULT 'ZAR',
  message text,
  status text DEFAULT 'new', -- new | quoted | accepted | declined | converted | cancelled
  contact_name text,
  contact_email text,
  contact_phone text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

SELECT public.sa_add_column('marketplace_inquiries', 'listing_id', 'bigint');
SELECT public.sa_add_column('marketplace_inquiries', 'buyer_profile_id', 'bigint');
SELECT public.sa_add_column('marketplace_inquiries', 'seller_profile_id', 'bigint');
SELECT public.sa_add_column('marketplace_inquiries', 'quantity', 'numeric(18,4)', '1');
SELECT public.sa_add_column('marketplace_inquiries', 'unit_price', 'numeric(18,4)');
SELECT public.sa_add_column('marketplace_inquiries', 'currency', 'text', '''ZAR''');
SELECT public.sa_add_column('marketplace_inquiries', 'message', 'text');
SELECT public.sa_add_column('marketplace_inquiries', 'status', 'text', '''new''');
SELECT public.sa_add_column('marketplace_inquiries', 'contact_name', 'text');
SELECT public.sa_add_column('marketplace_inquiries', 'contact_email', 'text');
SELECT public.sa_add_column('marketplace_inquiries', 'contact_phone', 'text');
SELECT public.sa_add_column('marketplace_inquiries', 'metadata', 'jsonb', '''{}''::jsonb');
SELECT public.sa_add_column('marketplace_inquiries', 'created_at', 'timestamptz', 'now()');
SELECT public.sa_add_column('marketplace_inquiries', 'updated_at', 'timestamptz', 'now()');

CREATE INDEX IF NOT EXISTS idx_mpi_listing ON public.marketplace_inquiries (listing_id);
CREATE INDEX IF NOT EXISTS idx_mpi_buyer ON public.marketplace_inquiries (buyer_profile_id);
CREATE INDEX IF NOT EXISTS idx_mpi_seller ON public.marketplace_inquiries (seller_profile_id);
CREATE INDEX IF NOT EXISTS idx_mpi_status ON public.marketplace_inquiries (status);

SELECT 'marketplace_listings' AS t, count(*)::text AS n FROM information_schema.columns
WHERE table_schema='public' AND table_name='marketplace_listings'
UNION ALL
SELECT 'marketplace_inquiries', count(*)::text FROM information_schema.columns
WHERE table_schema='public' AND table_name='marketplace_inquiries';
