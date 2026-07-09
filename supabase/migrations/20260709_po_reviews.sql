-- Bilateral post-PO peer reviews (PR 8)
-- Safe / idempotent for Supabase SQL Editor
-- UNIQUE(purchase_order_id, reviewer_profile_id) — one review per party per PO

-- ---------------------------------------------------------------------------
-- Helpers (same signatures as world_class / customer_platform_invites)
-- DROP first: CREATE OR REPLACE cannot rename parameters on existing helpers
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.sa_add_column(text, text, text, text);
DROP FUNCTION IF EXISTS public.sa_add_column(text, text, text);
DROP FUNCTION IF EXISTS public.sa_create_index(text, text, text);
DROP FUNCTION IF EXISTS public.sa_create_index(text, text, text[]);

CREATE OR REPLACE FUNCTION public.sa_add_column(p_table text, p_column text, p_type text, p_default text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
AS $$
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
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN %I %s DEFAULT %s',
        p_table, p_column, p_type, p_default
      );
    END IF;
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'sa_add_column %.% skip: %', p_table, p_column, SQLERRM;
END;
$$;

CREATE OR REPLACE FUNCTION public.sa_create_index(
  p_name text, p_table text, p_columns text
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  col text;
  cols text[];
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = p_table
  ) THEN
    RETURN;
  END IF;

  cols := string_to_array(replace(p_columns, ' ', ''), ',');
  FOREACH col IN ARRAY cols LOOP
    IF col IS NULL OR col = '' THEN CONTINUE; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = p_table AND column_name = col
    ) THEN
      RAISE NOTICE 'Index % skipped: missing %.%', p_name, p_table, col;
      RETURN;
    END IF;
  END LOOP;

  EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (%s)', p_name, p_table, p_columns);
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Index % skipped: %', p_name, SQLERRM;
END;
$$;

-- ---------------------------------------------------------------------------
-- Ensure purchase_orders exists (minimal shell for greenfield)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id bigserial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- po_reviews
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.po_reviews (
  id bigserial PRIMARY KEY,
  purchase_order_id bigint NOT NULL,
  reviewer_profile_id bigint NOT NULL,
  reviewee_profile_id bigint NOT NULL,
  rating int NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title text,
  body text,
  dimensions jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'published'
    CHECK (status IN ('published', 'hidden')),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Greenfield / partial tables: ensure columns exist
SELECT public.sa_add_column('po_reviews', 'purchase_order_id', 'bigint');
SELECT public.sa_add_column('po_reviews', 'reviewer_profile_id', 'bigint');
SELECT public.sa_add_column('po_reviews', 'reviewee_profile_id', 'bigint');
SELECT public.sa_add_column('po_reviews', 'rating', 'int');
SELECT public.sa_add_column('po_reviews', 'title', 'text');
SELECT public.sa_add_column('po_reviews', 'body', 'text');
SELECT public.sa_add_column('po_reviews', 'dimensions', 'jsonb', '''{}''::jsonb');
SELECT public.sa_add_column('po_reviews', 'status', 'text', '''published''');
SELECT public.sa_add_column('po_reviews', 'metadata', 'jsonb', '''{}''::jsonb');
SELECT public.sa_add_column('po_reviews', 'created_at', 'timestamptz', 'now()');
SELECT public.sa_add_column('po_reviews', 'updated_at', 'timestamptz', 'now()');

-- UNIQUE(purchase_order_id, reviewer_profile_id) — one review per reviewer per PO
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'po_reviews'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'po_reviews_purchase_order_id_reviewer_profile_id_key'
      AND conrelid = 'public.po_reviews'::regclass
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'po_reviews'
      AND indexname = 'po_reviews_purchase_order_id_reviewer_profile_id_key'
  ) THEN
    BEGIN
      ALTER TABLE public.po_reviews
        ADD CONSTRAINT po_reviews_purchase_order_id_reviewer_profile_id_key
        UNIQUE (purchase_order_id, reviewer_profile_id);
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'UNIQUE po_reviews (purchase_order_id, reviewer_profile_id) skip: %', SQLERRM;
    END;
  END IF;
END $$;

-- Rating check (idempotent; CREATE TABLE may already attach inline CHECK)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'po_reviews'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'po_reviews_rating_check'
      AND conrelid = 'public.po_reviews'::regclass
  ) THEN
    BEGIN
      ALTER TABLE public.po_reviews
        ADD CONSTRAINT po_reviews_rating_check CHECK (rating >= 1 AND rating <= 5);
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'po_reviews_rating_check skip: %', SQLERRM;
    END;
  END IF;
END $$;

-- Status domain: published | hidden only (idempotent)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'po_reviews'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'po_reviews_status_check'
      AND conrelid = 'public.po_reviews'::regclass
  ) THEN
    BEGIN
      ALTER TABLE public.po_reviews
        ADD CONSTRAINT po_reviews_status_check
        CHECK (status IN ('published', 'hidden'));
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'po_reviews_status_check skip: %', SQLERRM;
    END;
  END IF;
END $$;

-- Indexes
SELECT public.sa_create_index('idx_po_reviews_po', 'po_reviews', 'purchase_order_id');
SELECT public.sa_create_index('idx_po_reviews_reviewer', 'po_reviews', 'reviewer_profile_id');
SELECT public.sa_create_index('idx_po_reviews_reviewee', 'po_reviews', 'reviewee_profile_id');
SELECT public.sa_create_index('idx_po_reviews_status', 'po_reviews', 'status');
SELECT public.sa_create_index('idx_po_reviews_created', 'po_reviews', 'created_at');

-- Optional FK to purchase_orders (ON DELETE CASCADE — reviews go with the PO)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'purchase_orders'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'po_reviews' AND column_name = 'purchase_order_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND constraint_name = 'po_reviews_purchase_order_id_fkey'
  ) THEN
    BEGIN
      ALTER TABLE public.po_reviews
        ADD CONSTRAINT po_reviews_purchase_order_id_fkey
        FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id) ON DELETE CASCADE;
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'FK po_reviews_purchase_order_id_fkey skip: %', SQLERRM;
    END;
  END IF;
END $$;

-- Transitional open RLS
DO $$
BEGIN
  ALTER TABLE public.po_reviews ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'RLS enable po_reviews skip: %', SQLERRM;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'po_reviews' AND policyname = 'po_reviews_all'
  ) THEN
    CREATE POLICY po_reviews_all ON public.po_reviews FOR ALL USING (true) WITH CHECK (true);
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'policy po_reviews_all skip: %', SQLERRM;
END $$;
