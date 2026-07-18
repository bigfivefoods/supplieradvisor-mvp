-- First-class installment schedule (not notes-only).
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS public.customer_invoice_installments (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL,
  invoice_id bigint NOT NULL,
  customer_id bigint NULL,
  sequence_no int NOT NULL DEFAULT 1,
  due_date date NOT NULL,
  amount numeric(18,2) NOT NULL,
  currency text NOT NULL DEFAULT 'ZAR',
  status text NOT NULL DEFAULT 'open',
  -- open | paid | partial | skipped | void
  amount_paid numeric(18,2) NOT NULL DEFAULT 0,
  paid_at timestamptz NULL,
  ledger_payment_id bigint NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_installments_invoice
  ON public.customer_invoice_installments (invoice_id, sequence_no);

CREATE INDEX IF NOT EXISTS idx_installments_profile_due
  ON public.customer_invoice_installments (profile_id, due_date)
  WHERE status IN ('open', 'partial');

CREATE INDEX IF NOT EXISTS idx_installments_customer
  ON public.customer_invoice_installments (profile_id, customer_id)
  WHERE customer_id IS NOT NULL;

COMMENT ON TABLE public.customer_invoice_installments IS
  'Structured payment plan rows; dual-written with notes [installments] for backward compat.';
