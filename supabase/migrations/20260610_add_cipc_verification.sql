-- Migration: add CIPC / registry verification columns to profiles
-- These columns store the result of company registry verification (CIPC for South Africa).

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS verification_status TEXT CHECK (verification_status IN ('pending', 'verified', 'failed')),
  ADD COLUMN IF NOT EXISTS official_name TEXT,
  ADD COLUMN IF NOT EXISTS status_from_registry TEXT,
  ADD COLUMN IF NOT EXISTS cipc_verified_at TIMESTAMPTZ;

-- Index for fast filtering of verified suppliers in search
CREATE INDEX IF NOT EXISTS idx_profiles_verification_status
  ON profiles (verification_status);

COMMENT ON COLUMN profiles.verification_status IS 'CIPC/registry verification status: pending, verified, or failed';
COMMENT ON COLUMN profiles.official_name IS 'Official company name as returned by the registry';
COMMENT ON COLUMN profiles.status_from_registry IS 'Company status as returned by the registry (e.g. "In Business")';
COMMENT ON COLUMN profiles.cipc_verified_at IS 'Timestamp when the company was successfully verified with the registry';
