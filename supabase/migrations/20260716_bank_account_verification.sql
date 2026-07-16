-- Bank account fields + VerifyNow AVS result columns on company profiles.
-- Used by business profile banking panel and /api/business/verify-bank (R50).

SELECT public.sa_add_column('profiles', 'branch_code', 'text');
SELECT public.sa_add_column('profiles', 'account_type', 'text');
SELECT public.sa_add_column('profiles', 'bank_verification_status', 'text');
SELECT public.sa_add_column('profiles', 'bank_verified_at', 'timestamptz');
SELECT public.sa_add_column('profiles', 'bank_verification_payment_ref', 'text');

COMMENT ON COLUMN public.profiles.branch_code IS 'SA bank branch code (6 digits) for invoices and VerifyNow AVS';
COMMENT ON COLUMN public.profiles.account_type IS 'Bank account type e.g. Current, Savings';
COMMENT ON COLUMN public.profiles.bank_verification_status IS 'verified | failed | pending from VerifyNow bank-account-verification';
COMMENT ON COLUMN public.profiles.bank_verified_at IS 'When bank account last verified via VerifyNow AVS';
COMMENT ON COLUMN public.profiles.bank_verification_payment_ref IS 'Paystack reference for last R50 bank verification payment';
