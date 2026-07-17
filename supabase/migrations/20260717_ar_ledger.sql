-- First-class AR payment ledger (not notes-only).
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS public.customer_invoice_payments (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL,
  invoice_id bigint NOT NULL,
  customer_id bigint NULL,
  amount numeric(18,2) NOT NULL,
  currency text NOT NULL DEFAULT 'ZAR',
  paid_at timestamptz NOT NULL DEFAULT now(),
  method text NULL DEFAULT 'manual',
  reference text NULL,
  proof_url text NULL,
  notes text NULL,
  created_by text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ar_payments_profile_paid
  ON public.customer_invoice_payments (profile_id, paid_at DESC);

CREATE INDEX IF NOT EXISTS idx_ar_payments_invoice
  ON public.customer_invoice_payments (invoice_id, paid_at DESC);

CREATE INDEX IF NOT EXISTS idx_ar_payments_customer
  ON public.customer_invoice_payments (profile_id, customer_id)
  WHERE customer_id IS NOT NULL;

COMMENT ON TABLE public.customer_invoice_payments IS
  'AR payment ledger lines; amount_paid on customer_invoices is the rollup.';

-- Optional: track when R69 was first stored for SLA
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'verification_paid_at'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN verification_paid_at timestamptz NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'verification_paid_at add skipped: %', SQLERRM;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_verification_paid_at
  ON public.profiles (verification_paid_at)
  WHERE verification_paid_at IS NOT NULL;
