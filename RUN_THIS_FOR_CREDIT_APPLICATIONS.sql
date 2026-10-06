-- Trade credit applications filled in by a customer (including on the guest portal).
-- Approving an application writes customers.credit_limit. This does not post journals
-- and does not insert any application rows.
-- Paste into the Supabase SQL editor if you are rebuilding a database.
-- The live project is updated from the app when this file is applied there.

CREATE TABLE IF NOT EXISTS public.customer_credit_applications (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL,
  customer_id bigint NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'in_review', 'approved', 'declined')),
  legal_name text,
  trading_name text,
  registration_number text,
  vat_number text,
  billing_address text,
  contact_name text,
  contact_email text,
  contact_phone text,
  industry text,
  years_trading integer,
  requested_limit numeric(18,2),
  currency text NOT NULL DEFAULT 'ZAR',
  payment_terms text,
  expected_monthly numeric(18,2),
  bank_name text,
  bank_account_name text,
  bank_branch_code text,
  bank_account_number text,
  trade_references jsonb NOT NULL DEFAULT '[]'::jsonb,
  signatory_name text,
  signatory_title text,
  declaration_accepted boolean NOT NULL DEFAULT false,
  approved_limit numeric(18,2),
  approved_terms text,
  decision_notes text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_credit_app_open
  ON public.customer_credit_applications (profile_id, customer_id)
  WHERE status IN ('draft', 'submitted', 'in_review');

CREATE INDEX IF NOT EXISTS idx_credit_app_profile
  ON public.customer_credit_applications (profile_id, updated_at DESC);

ALTER TABLE public.customer_credit_applications ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.customer_credit_applications FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.customer_credit_applications TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.customer_credit_applications_id_seq TO service_role;

NOTIFY pgrst, 'reload schema';
