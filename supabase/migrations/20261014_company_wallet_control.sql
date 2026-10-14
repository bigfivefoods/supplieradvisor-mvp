-- Company payout wallet challenges and audit.
-- Ship this file in the pull request only. Do not apply it to a live database from the PR.

CREATE TABLE IF NOT EXISTS public.company_wallet_challenges (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL,
  nonce TEXT NOT NULL UNIQUE,
  new_address TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_wallet_challenges_profile
  ON public.company_wallet_challenges (profile_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.company_wallet_audit (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL,
  actor_user_id TEXT,
  previous_address TEXT,
  new_address TEXT NOT NULL,
  nonce TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_wallet_audit_profile
  ON public.company_wallet_audit (profile_id, created_at DESC);

ALTER TABLE public.company_wallet_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_wallet_audit ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.company_wallet_challenges FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.company_wallet_audit FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.company_wallet_challenges TO service_role;
GRANT ALL ON TABLE public.company_wallet_audit TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.company_wallet_challenges_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.company_wallet_audit_id_seq TO service_role;

NOTIFY pgrst, 'reload schema';
