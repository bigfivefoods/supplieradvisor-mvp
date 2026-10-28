-- Optional contracting company on a sales contractor agreement, and the
-- last time an admin resent the unsigned agreement.
-- Nullable, no default. A blank company name keeps the contract in the
-- person's name. Do not apply this to production or staging until the
-- owner approves the schema change. The application also stores these
-- values in metadata so signing and resend keep working before this runs.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'sales_contractor_agreements'
  ) THEN
    ALTER TABLE public.sales_contractor_agreements
      ADD COLUMN IF NOT EXISTS contractor_company_name text,
      ADD COLUMN IF NOT EXISTS contractor_registration_number text,
      ADD COLUMN IF NOT EXISTS contract_resent_at timestamptz;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
