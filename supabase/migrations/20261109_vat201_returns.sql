-- VAT201 vendor settings and return status.
-- AWAITING APPROVAL. Do not apply this file to the production Supabase
-- project (onkklullmgrdqoertngp) until it has been reviewed.
-- The VAT number stays on profiles.vat_number. This file does not replace it.
-- RLS matches the accounting module (20260710_accounting_module.sql):
-- row security enabled, select and write policies for the server role path.

CREATE TABLE IF NOT EXISTS public.vat_vendor_settings (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  vat_basis text NOT NULL DEFAULT 'invoice' CHECK (vat_basis IN ('payment', 'invoice', 'hybrid')),
  period_category text NOT NULL DEFAULT 'B' CHECK (period_category IN ('A', 'B', 'C', 'D', 'E')),
  effective_from date,
  first_period_end date,
  filing_channel text NOT NULL DEFAULT 'efiling' CHECK (filing_channel IN ('manual', 'efiling')),
  isv_submit_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vat_returns (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'reviewed', 'submitted', 'paid')),
  locked boolean NOT NULL DEFAULT false,
  locked_at timestamptz,
  locked_months text[] NOT NULL DEFAULT '{}',
  snapshot jsonb,
  submission_reference text,
  submitted_on date,
  payment_reference text,
  paid_on date,
  payment_amount numeric(18,2),
  settlement_journal_id bigint,
  reviewed_by text,
  submitted_by text,
  paid_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_vat_returns_profile
  ON public.vat_returns (profile_id, period_end DESC);

ALTER TABLE public.vat_vendor_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vat_returns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vat_vendor_settings_select_all ON public.vat_vendor_settings;
CREATE POLICY vat_vendor_settings_select_all ON public.vat_vendor_settings
  FOR SELECT USING (true);
DROP POLICY IF EXISTS vat_vendor_settings_write_all ON public.vat_vendor_settings;
CREATE POLICY vat_vendor_settings_write_all ON public.vat_vendor_settings
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS vat_returns_select_all ON public.vat_returns;
CREATE POLICY vat_returns_select_all ON public.vat_returns
  FOR SELECT USING (true);
DROP POLICY IF EXISTS vat_returns_write_all ON public.vat_returns;
CREATE POLICY vat_returns_write_all ON public.vat_returns
  FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE public.vat_vendor_settings IS
  'VAT basis, category and period anchor. VAT number remains on profiles.vat_number. isv_submit_enabled stays false until SARS accredits SupplierAdvisor.';
COMMENT ON TABLE public.vat_returns IS
  'VAT201 status for one tax period. Snapshot is the locked return. Settlement journals use source vat201_settlement.';
