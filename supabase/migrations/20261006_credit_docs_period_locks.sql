-- Credit supporting documents, month locks, and the journal id on a referral redemption.
-- Does not insert applications, agreements, or lock any month.
-- Paste the root copy RUN_THIS_FOR_CREDIT_DOCS_AND_LOCKS.sql if you are rebuilding a database.

ALTER TABLE public.customer_credit_applications
  ADD COLUMN IF NOT EXISTS supporting_documents jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.referral_commission_redemptions
  ADD COLUMN IF NOT EXISTS journal_entry_id bigint;

CREATE TABLE IF NOT EXISTS public.accounting_period_locks (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL,
  period_key TEXT NOT NULL,
  locked BOOLEAN NOT NULL DEFAULT false,
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (profile_id, period_key)
);

CREATE INDEX IF NOT EXISTS idx_period_locks_profile
  ON public.accounting_period_locks (profile_id, period_key DESC);

ALTER TABLE public.accounting_period_locks ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.accounting_period_locks FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.accounting_period_locks TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.accounting_period_locks_id_seq TO service_role;

NOTIFY pgrst, 'reload schema';
