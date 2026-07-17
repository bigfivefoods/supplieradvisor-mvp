-- Promise-to-pay date on commercial invoices (collections)
-- Idempotent. Run in Supabase SQL Editor if not applied by CI.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'customer_invoices'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'customer_invoices'
      AND column_name = 'promise_to_pay_date'
  ) THEN
    ALTER TABLE public.customer_invoices
      ADD COLUMN promise_to_pay_date date NULL;
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'promise_to_pay_date add skipped: %', SQLERRM;
END $$;

CREATE INDEX IF NOT EXISTS idx_customer_invoices_promise_to_pay
  ON public.customer_invoices (promise_to_pay_date)
  WHERE promise_to_pay_date IS NOT NULL
    AND status IS DISTINCT FROM 'paid'
    AND status IS DISTINCT FROM 'void';

COMMENT ON COLUMN public.customer_invoices.promise_to_pay_date IS
  'Buyer promised payment date; reminder cron notifies seller when due/past while still open';
