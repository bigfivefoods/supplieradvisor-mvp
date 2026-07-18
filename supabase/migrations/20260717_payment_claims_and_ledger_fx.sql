-- Buyer payment claims + multi-currency ledger FX columns.
-- Safe to re-run.

-- ── Buyer "I paid" claims (seller confirms → AR ledger) ──────────────────────
CREATE TABLE IF NOT EXISTS public.customer_payment_claims (
  id bigserial PRIMARY KEY,
  seller_profile_id bigint NOT NULL,
  buyer_profile_id bigint NOT NULL,
  invoice_id bigint NOT NULL,
  amount numeric(18,2) NOT NULL,
  currency text NOT NULL DEFAULT 'ZAR',
  reference text NULL,
  proof_url text NULL,
  notes text NULL,
  status text NOT NULL DEFAULT 'pending',
  -- pending | confirmed | rejected | cancelled
  claimed_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz NULL,
  resolved_by text NULL,
  ledger_payment_id bigint NULL,
  created_by text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_claims_seller_status
  ON public.customer_payment_claims (seller_profile_id, status, claimed_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_claims_buyer
  ON public.customer_payment_claims (buyer_profile_id, claimed_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_claims_invoice
  ON public.customer_payment_claims (invoice_id, status);

COMMENT ON TABLE public.customer_payment_claims IS
  'Buyer asserts payment; seller confirm writes customer_invoice_payments ledger.';

-- ── Ledger FX (optional columns) ─────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'customer_invoice_payments'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'customer_invoice_payments'
        AND column_name = 'amount_base'
    ) THEN
      ALTER TABLE public.customer_invoice_payments
        ADD COLUMN amount_base numeric(18,2) NULL;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'customer_invoice_payments'
        AND column_name = 'base_currency'
    ) THEN
      ALTER TABLE public.customer_invoice_payments
        ADD COLUMN base_currency text NULL;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'customer_invoice_payments'
        AND column_name = 'fx_rate'
    ) THEN
      ALTER TABLE public.customer_invoice_payments
        ADD COLUMN fx_rate numeric(18,8) NULL;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'customer_invoice_payments'
        AND column_name = 'fx_as_of'
    ) THEN
      ALTER TABLE public.customer_invoice_payments
        ADD COLUMN fx_as_of date NULL;
    END IF;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ledger FX columns skipped: %', SQLERRM;
END $$;
