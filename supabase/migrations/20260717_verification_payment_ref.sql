-- CIPC verification payment + badge timestamps on profiles
-- Run in Supabase SQL Editor if health reports verification_payment_ref missing.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = 'verification_payment_ref'
    ) THEN
      ALTER TABLE public.profiles
        ADD COLUMN verification_payment_ref text NULL;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = 'verified_at'
    ) THEN
      ALTER TABLE public.profiles
        ADD COLUMN verified_at timestamptz NULL;
    END IF;
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'verification payment columns skip: %', SQLERRM;
END $$;

-- Prefer helper when present (idempotent)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'sa_add_column'
  ) THEN
    PERFORM public.sa_add_column('profiles', 'verification_payment_ref', 'text');
    PERFORM public.sa_add_column('profiles', 'verified_at', 'timestamptz');
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'sa_add_column verification skip: %', SQLERRM;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_verification_status
  ON public.profiles (verification_status)
  WHERE verification_status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_verification_payment_ref
  ON public.profiles (verification_payment_ref)
  WHERE verification_payment_ref IS NOT NULL;

COMMENT ON COLUMN public.profiles.verification_payment_ref IS
  'Paystack reference for last R69 CIPC company verification payment';
COMMENT ON COLUMN public.profiles.verified_at IS
  'When verification_status last became verified (optional; status is source of truth)';

-- Re-affirm invoice source_po_id (idempotent)
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
  RAISE NOTICE 'source_po_id reaffirm skip: %', SQLERRM;
END $$;

CREATE INDEX IF NOT EXISTS idx_customer_invoices_source_po
  ON public.customer_invoices (profile_id, source_po_id)
  WHERE source_po_id IS NOT NULL;
