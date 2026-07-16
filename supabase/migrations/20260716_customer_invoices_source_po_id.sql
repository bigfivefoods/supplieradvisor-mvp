-- Link customer invoices to source purchase order (fromPo create flow)
-- Idempotent. Run in Supabase SQL Editor if not applied by CI.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'customer_invoices'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'customer_invoices'
      AND column_name = 'source_po_id'
  ) THEN
    ALTER TABLE public.customer_invoices
      ADD COLUMN source_po_id bigint NULL;
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'source_po_id add skipped: %', SQLERRM;
END $$;

CREATE INDEX IF NOT EXISTS idx_customer_invoices_source_po
  ON public.customer_invoices (profile_id, source_po_id)
  WHERE source_po_id IS NOT NULL;
