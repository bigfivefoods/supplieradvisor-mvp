-- Cross-brand B2C directory: email/phone → independent Advisor memberships.
-- Gym, dental, hire, etc. are indexed here so a personal wallet can find
-- brands that are not Core CRM customers of those companies.

CREATE TABLE IF NOT EXISTS public.platform_b2c_directory (
  id bigserial PRIMARY KEY,
  contact_key text NOT NULL,
  contact_type text NOT NULL CHECK (contact_type IN ('email', 'phone')),
  kind text NOT NULL,
  company_id integer NOT NULL,
  ref_id text NOT NULL,
  portal_token text,
  portal_path text NOT NULL,
  checkin_path text,
  brand text,
  company_name text,
  ref_label text,
  capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contact_key, kind, company_id, ref_id)
);

CREATE INDEX IF NOT EXISTS idx_platform_b2c_directory_contact
  ON public.platform_b2c_directory (contact_key);

CREATE INDEX IF NOT EXISTS idx_platform_b2c_directory_company
  ON public.platform_b2c_directory (company_id, kind);

CREATE INDEX IF NOT EXISTS idx_platform_b2c_directory_token
  ON public.platform_b2c_directory (portal_token)
  WHERE portal_token IS NOT NULL;

COMMENT ON TABLE public.platform_b2c_directory IS
  'Personal B2C lookup: one person (email/phone) can belong to many independent Advisor brands. Never mixed with business_users / selectedCompanyId.';
