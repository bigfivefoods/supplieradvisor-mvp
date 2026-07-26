-- Close PO → GRN loop + claim review metadata

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

-- Link GRN to purchase order
SELECT public.sa_add_column('school_kitchen_receipts', 'po_id', 'bigint');
SELECT public.sa_add_column('school_kitchen_receipts', 'purchase_order_id', 'bigint');

-- PO receive tracking
SELECT public.sa_add_column('school_purchase_orders', 'received_at', 'timestamptz');
SELECT public.sa_add_column('school_purchase_orders', 'received_pct', 'numeric(5,2)');

-- Claim agency review fields
SELECT public.sa_add_column('nsnp_claim_packs', 'reviewed_at', 'timestamptz');
SELECT public.sa_add_column('nsnp_claim_packs', 'review_notes', 'text');
SELECT public.sa_add_column('nsnp_claim_packs', 'reviewed_by', 'text');
SELECT public.sa_add_column('nsnp_claim_packs', 'updated_at', 'timestamptz');

CREATE INDEX IF NOT EXISTS idx_school_receipts_po
  ON public.school_kitchen_receipts (po_id)
  WHERE po_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_nsnp_claims_agency_status
  ON public.nsnp_claim_packs (agency_profile_id, status);

COMMENT ON COLUMN public.school_kitchen_receipts.po_id IS 'Optional link to school_purchase_orders.id for PO→GRN loop';
