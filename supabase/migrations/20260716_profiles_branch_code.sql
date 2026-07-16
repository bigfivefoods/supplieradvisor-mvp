-- Ensure banking branch_code (+ related fields) exist on public.profiles.
-- Without these columns, profile PATCH silently drops branch_code (safe-write only keeps existing keys).

DO $$
BEGIN
  -- Prefer helper when present
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'sa_add_column'
  ) THEN
    PERFORM public.sa_add_column('profiles', 'branch_code', 'text');
    PERFORM public.sa_add_column('profiles', 'account_type', 'text');
    PERFORM public.sa_add_column('profiles', 'bank_verification_status', 'text');
    PERFORM public.sa_add_column('profiles', 'bank_verified_at', 'timestamptz');
    PERFORM public.sa_add_column('profiles', 'bank_verification_payment_ref', 'text');
  ELSE
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS branch_code text;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_type text;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bank_verification_status text;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bank_verified_at timestamptz;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bank_verification_payment_ref text;
  END IF;
END $$;

-- Always ensure with plain IF NOT EXISTS (idempotent even if helper existed but failed)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS branch_code text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_type text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bank_verification_status text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bank_verified_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bank_verification_payment_ref text;

COMMENT ON COLUMN public.profiles.branch_code IS 'SA bank branch code (6 digits) for invoices and VerifyNow AVS';
COMMENT ON COLUMN public.profiles.account_type IS 'Bank account type e.g. Current, Savings';
