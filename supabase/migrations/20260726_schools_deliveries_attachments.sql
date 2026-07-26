-- NSNP delivery lifecycle: ISP supplies → school receives + shared documents (POD, invoice, etc.)

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

-- Delivery note linking school PO to ISP supply event
CREATE TABLE IF NOT EXISTS public.school_nsnp_deliveries (
  id bigserial PRIMARY KEY,
  school_profile_id bigint NOT NULL REFERENCES public.school_profiles(id) ON DELETE CASCADE,
  school_company_id bigint NOT NULL,
  isp_profile_id bigint NOT NULL,
  po_id bigint,
  delivery_number text,
  status text NOT NULL DEFAULT 'draft',
  -- draft | confirmed | dispatched | delivered | received | disputed | cancelled
  expected_date date,
  dispatched_at timestamptz,
  delivered_at timestamptz,
  received_at timestamptz,
  vehicle_reg text,
  driver_name text,
  lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- [{approved_product_id, product_name, brand_name, qty_ordered, qty_delivered, qty_received, uom}]
  notes_isp text,
  notes_school text,
  dispute_reason text,
  grn_receipt_id bigint,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nsnp_deliv_school
  ON public.school_nsnp_deliveries (school_profile_id, status);
CREATE INDEX IF NOT EXISTS idx_nsnp_deliv_isp
  ON public.school_nsnp_deliveries (isp_profile_id, status);
CREATE INDEX IF NOT EXISTS idx_nsnp_deliv_po
  ON public.school_nsnp_deliveries (po_id);

-- Shared attachments: POD, invoice, packing list, photos — school + ISP can upload
CREATE TABLE IF NOT EXISTS public.school_nsnp_delivery_files (
  id bigserial PRIMARY KEY,
  delivery_id bigint NOT NULL REFERENCES public.school_nsnp_deliveries(id) ON DELETE CASCADE,
  school_profile_id bigint NOT NULL,
  isp_profile_id bigint,
  uploaded_by_company_id bigint NOT NULL,
  uploaded_by_role text NOT NULL DEFAULT 'school',
  -- school | isp | dbe
  kind text NOT NULL DEFAULT 'other',
  -- pod | invoice | packing_list | photo | credit_note | other
  file_name text,
  file_url text NOT NULL,
  file_size bigint,
  content_type text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nsnp_deliv_files_deliv
  ON public.school_nsnp_delivery_files (delivery_id);

-- Also allow documents on the PO itself (pre-delivery invoices/quotes)
CREATE TABLE IF NOT EXISTS public.school_nsnp_order_files (
  id bigserial PRIMARY KEY,
  po_id bigint NOT NULL,
  school_profile_id bigint NOT NULL,
  isp_profile_id bigint,
  uploaded_by_company_id bigint NOT NULL,
  uploaded_by_role text NOT NULL DEFAULT 'school',
  kind text NOT NULL DEFAULT 'other',
  -- po_scan | invoice | quote | other
  file_name text,
  file_url text NOT NULL,
  file_size bigint,
  content_type text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nsnp_order_files_po
  ON public.school_nsnp_order_files (po_id);

-- Soft enrich PO / ISP for collaboration
SELECT public.sa_add_column('school_purchase_orders', 'delivery_status', 'text');
SELECT public.sa_add_column('nsnp_isp_profiles', 'contact_name', 'text');
SELECT public.sa_add_column('nsnp_isp_profiles', 'contact_phone', 'text');
SELECT public.sa_add_column('nsnp_isp_profiles', 'contact_email', 'text');
SELECT public.sa_add_column('nsnp_agency_profiles', 'contact_name', 'text');
SELECT public.sa_add_column('nsnp_agency_profiles', 'contact_phone', 'text');
SELECT public.sa_add_column('nsnp_agency_profiles', 'contact_email', 'text');
SELECT public.sa_add_column('nsnp_agency_profiles', 'about', 'text');

COMMENT ON TABLE public.school_nsnp_deliveries IS 'ISP → school food delivery events with receive confirmation';
COMMENT ON TABLE public.school_nsnp_delivery_files IS 'POD, invoice, packing list attachments shared by ISP and school';
