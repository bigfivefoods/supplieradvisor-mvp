-- Independent contractor invitations + portal identity
-- Run in Supabase SQL Editor

ALTER TABLE public.container_contractors
  ADD COLUMN IF NOT EXISTS user_id text,
  ADD COLUMN IF NOT EXISTS invite_token text,
  ADD COLUMN IF NOT EXISTS invited_at timestamptz,
  ADD COLUMN IF NOT EXISTS contract_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS contract_version text,
  ADD COLUMN IF NOT EXISTS portal_status text DEFAULT 'draft';

CREATE INDEX IF NOT EXISTS idx_container_contractors_user ON public.container_contractors(user_id);
CREATE INDEX IF NOT EXISTS idx_container_contractors_email ON public.container_contractors(email);
CREATE INDEX IF NOT EXISTS idx_container_contractors_invite ON public.container_contractors(invite_token);

CREATE TABLE IF NOT EXISTS public.contractor_invites (
  id bigserial PRIMARY KEY,
  token text NOT NULL UNIQUE,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  container_id bigint NOT NULL REFERENCES public.containers(id) ON DELETE CASCADE,
  contractor_id bigint REFERENCES public.container_contractors(id) ON DELETE SET NULL,
  email text NOT NULL,
  full_name text,
  status text NOT NULL DEFAULT 'pending', -- pending | accepted | expired | revoked
  contract_version text NOT NULL DEFAULT 'IC-2026.1',
  contract_accepted_at timestamptz,
  user_id text,
  invited_by text,
  company_name text,
  container_name text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contractor_invites_token ON public.contractor_invites(token);
CREATE INDEX IF NOT EXISTS idx_contractor_invites_email ON public.contractor_invites(email);
CREATE INDEX IF NOT EXISTS idx_contractor_invites_status ON public.contractor_invites(status);

-- Sales already exist; ensure contractor can record sales with optional contractor_id
ALTER TABLE public.container_sales
  ADD COLUMN IF NOT EXISTS contractor_id bigint,
  ADD COLUMN IF NOT EXISTS items jsonb DEFAULT '[]'::jsonb;

-- Stock counts log
CREATE TABLE IF NOT EXISTS public.container_stock_counts (
  id bigserial PRIMARY KEY,
  profile_id bigint REFERENCES public.profiles(id) ON DELETE CASCADE,
  container_id bigint NOT NULL REFERENCES public.containers(id) ON DELETE CASCADE,
  contractor_id bigint REFERENCES public.container_contractors(id) ON DELETE SET NULL,
  user_id text,
  lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  counted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_counts_container ON public.container_stock_counts(container_id);

ALTER TABLE public.contractor_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.container_stock_counts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contractor_invites_all ON public.contractor_invites;
CREATE POLICY contractor_invites_all ON public.contractor_invites FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS container_stock_counts_all ON public.container_stock_counts;
CREATE POLICY container_stock_counts_all ON public.container_stock_counts FOR ALL USING (true) WITH CHECK (true);
