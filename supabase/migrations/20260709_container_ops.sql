-- Container retail operations: inventory + replenishment orders
-- Safe / idempotent for Supabase SQL Editor (handles partially-created tables)

-- ---------------------------------------------------------------------------
-- Helpers — DROP first (CREATE OR REPLACE cannot rename parameters / change
-- signatures of existing world_class helpers like sa_create_index)
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

-- Same signature/parameter names as world_class_schema (p_columns, not p_column)
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
-- Ensure containers exists (minimal) before FKs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.containers (
  id bigserial PRIMARY KEY,
  container_code text,
  name text,
  status text DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure containers.profile_id exists (tenant key used by app)
SELECT public.sa_add_column('containers', 'profile_id', 'bigint');

-- ---------------------------------------------------------------------------
-- container_inventory
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.container_inventory (
  id bigserial PRIMARY KEY,
  container_id bigint,
  product_name text NOT NULL DEFAULT 'Item',
  qty_on_hand numeric(18,4) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add every column the app expects (works if table was created with a thin schema)
SELECT public.sa_add_column('container_inventory', 'profile_id', 'bigint');
SELECT public.sa_add_column('container_inventory', 'container_id', 'bigint');
SELECT public.sa_add_column('container_inventory', 'product_name', 'text', '''Item''');
SELECT public.sa_add_column('container_inventory', 'sku', 'text');
SELECT public.sa_add_column('container_inventory', 'qty_on_hand', 'numeric(18,4)', '0');
SELECT public.sa_add_column('container_inventory', 'unit', 'text', '''unit''');
SELECT public.sa_add_column('container_inventory', 'reorder_level', 'numeric(18,4)', '0');
SELECT public.sa_add_column('container_inventory', 'unit_cost', 'numeric(18,2)', '0');
SELECT public.sa_add_column('container_inventory', 'last_received_at', 'timestamptz');
SELECT public.sa_add_column('container_inventory', 'notes', 'text');
SELECT public.sa_add_column('container_inventory', 'created_at', 'timestamptz', 'now()');
SELECT public.sa_add_column('container_inventory', 'updated_at', 'timestamptz', 'now()');

-- FK container_id → containers (optional, skip if already present / conflict)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'container_inventory' AND column_name = 'container_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'containers'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND constraint_name = 'container_inventory_container_id_fkey'
  ) THEN
    ALTER TABLE public.container_inventory
      ADD CONSTRAINT container_inventory_container_id_fkey
      FOREIGN KEY (container_id) REFERENCES public.containers(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'container_inventory container_id FK skip: %', SQLERRM;
END $$;

-- FK profile_id → profiles (only if profiles exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'container_inventory' AND column_name = 'profile_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND constraint_name = 'container_inventory_profile_id_fkey'
  ) THEN
    ALTER TABLE public.container_inventory
      ADD CONSTRAINT container_inventory_profile_id_fkey
      FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'container_inventory profile_id FK skip: %', SQLERRM;
END $$;

SELECT public.sa_create_index('idx_container_inventory_container', 'container_inventory', 'container_id');
SELECT public.sa_create_index('idx_container_inventory_profile', 'container_inventory', 'profile_id');

-- ---------------------------------------------------------------------------
-- container_orders
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.container_orders (
  id bigserial PRIMARY KEY,
  container_id bigint,
  status text NOT NULL DEFAULT 'draft',
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

SELECT public.sa_add_column('container_orders', 'profile_id', 'bigint');
SELECT public.sa_add_column('container_orders', 'container_id', 'bigint');
SELECT public.sa_add_column('container_orders', 'order_number', 'text');
SELECT public.sa_add_column('container_orders', 'status', 'text', '''draft''');
SELECT public.sa_add_column('container_orders', 'items', 'jsonb', '''[]''::jsonb');
SELECT public.sa_add_column('container_orders', 'notes', 'text');
SELECT public.sa_add_column('container_orders', 'ordered_at', 'timestamptz');
SELECT public.sa_add_column('container_orders', 'received_at', 'timestamptz');
SELECT public.sa_add_column('container_orders', 'created_by', 'text');
SELECT public.sa_add_column('container_orders', 'ordered_by', 'text');
SELECT public.sa_add_column('container_orders', 'created_at', 'timestamptz', 'now()');
SELECT public.sa_add_column('container_orders', 'updated_at', 'timestamptz', 'now()');

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'container_orders' AND column_name = 'container_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'containers'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND constraint_name = 'container_orders_container_id_fkey'
  ) THEN
    ALTER TABLE public.container_orders
      ADD CONSTRAINT container_orders_container_id_fkey
      FOREIGN KEY (container_id) REFERENCES public.containers(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'container_orders container_id FK skip: %', SQLERRM;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'container_orders' AND column_name = 'profile_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND constraint_name = 'container_orders_profile_id_fkey'
  ) THEN
    ALTER TABLE public.container_orders
      ADD CONSTRAINT container_orders_profile_id_fkey
      FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'container_orders profile_id FK skip: %', SQLERRM;
END $$;

SELECT public.sa_create_index('idx_container_orders_container', 'container_orders', 'container_id');
SELECT public.sa_create_index('idx_container_orders_status', 'container_orders', 'status');
SELECT public.sa_create_index('idx_container_orders_profile', 'container_orders', 'profile_id');

-- ---------------------------------------------------------------------------
-- RLS (service-role / app uses service key; policies allow all for now)
-- ---------------------------------------------------------------------------
ALTER TABLE public.container_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.container_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS container_inventory_all ON public.container_inventory;
CREATE POLICY container_inventory_all ON public.container_inventory
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS container_orders_all ON public.container_orders;
CREATE POLICY container_orders_all ON public.container_orders
  FOR ALL USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Verification
-- ---------------------------------------------------------------------------
SELECT
  t.table_name,
  c.column_name,
  c.data_type
FROM information_schema.tables t
JOIN information_schema.columns c
  ON c.table_schema = t.table_schema AND c.table_name = t.table_name
WHERE t.table_schema = 'public'
  AND t.table_name IN ('container_inventory', 'container_orders')
  AND c.column_name IN (
    'id', 'profile_id', 'container_id', 'product_name', 'qty_on_hand',
    'order_number', 'status', 'items'
  )
ORDER BY t.table_name, c.column_name;
