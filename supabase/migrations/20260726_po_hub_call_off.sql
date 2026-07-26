-- Hub (blanket / master) purchase orders with call-offs over a window.
-- Safe / idempotent — soft columns; app also stores in metadata.

DROP FUNCTION IF EXISTS public.sa_add_column(text, text, text, text);
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

SELECT public.sa_add_column('purchase_orders', 'order_kind', 'text', '''standard''');
-- standard | hub | call_off
SELECT public.sa_add_column('purchase_orders', 'parent_po_id', 'bigint');
SELECT public.sa_add_column('purchase_orders', 'call_off_window_months', 'integer');
SELECT public.sa_add_column('purchase_orders', 'call_off_window_start', 'date');
SELECT public.sa_add_column('purchase_orders', 'call_off_window_end', 'date');
SELECT public.sa_add_column('purchase_orders', 'hub_quantity', 'numeric(18,4)');
SELECT public.sa_add_column('purchase_orders', 'called_off_quantity', 'numeric(18,4)', '0');

CREATE INDEX IF NOT EXISTS idx_po_parent_call_off
  ON public.purchase_orders (parent_po_id)
  WHERE parent_po_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_po_order_kind
  ON public.purchase_orders (buyer_profile_id, order_kind)
  WHERE order_kind IS NOT NULL;
