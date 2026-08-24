-- Standing order-chain routing: customer + your products + supplier.
-- Safe / idempotent.

CREATE OR REPLACE FUNCTION public.sa_add_column(p_table text, p_column text, p_type text, p_default text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=p_table
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name=p_table AND column_name=p_column
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

CREATE TABLE IF NOT EXISTS public.order_chain_setups (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL,
  name text,
  customer_id bigint,
  customer_name text,
  srm_supplier_id bigint,
  supplier_name text,
  product_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'active',
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

SELECT public.sa_add_column('order_chain_setups', 'profile_id', 'bigint');
SELECT public.sa_add_column('order_chain_setups', 'name', 'text');
SELECT public.sa_add_column('order_chain_setups', 'customer_id', 'bigint');
SELECT public.sa_add_column('order_chain_setups', 'customer_name', 'text');
SELECT public.sa_add_column('order_chain_setups', 'srm_supplier_id', 'bigint');
SELECT public.sa_add_column('order_chain_setups', 'supplier_name', 'text');
SELECT public.sa_add_column('order_chain_setups', 'product_ids', 'jsonb', '''[]''::jsonb');
SELECT public.sa_add_column('order_chain_setups', 'status', 'text', '''active''');
SELECT public.sa_add_column('order_chain_setups', 'notes', 'text');
SELECT public.sa_add_column('order_chain_setups', 'metadata', 'jsonb', '''{}''::jsonb');
SELECT public.sa_add_column('order_chain_setups', 'created_by', 'text');
SELECT public.sa_add_column('order_chain_setups', 'created_at', 'timestamptz', 'now()');
SELECT public.sa_add_column('order_chain_setups', 'updated_at', 'timestamptz', 'now()');

CREATE INDEX IF NOT EXISTS idx_order_chain_setups_profile
  ON public.order_chain_setups (profile_id, status);
CREATE INDEX IF NOT EXISTS idx_order_chain_setups_customer
  ON public.order_chain_setups (profile_id, customer_id);
