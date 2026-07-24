-- Golden-loop RLS hardening (transitional: authenticated full access; anon denied).
-- App still enforces company membership via service role + assertCompanyMember.
-- Safe to re-run.

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'purchase_orders',
    'customer_invoices',
    'customer_payment_claims',
    'customer_invoice_payments',
    'stock_levels',
    'stock_movements',
    'po_reviews',
    'pm_projects',
    'pm_project_riads',
    'pm_tasks',
    'esg_emissions',
    'esg_targets',
    'esg_resources',
    'esg_initiatives'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

      -- Deny anonymous direct client access
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_deny_anon', t);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO anon USING (false) WITH CHECK (false)',
        t || '_deny_anon',
        t
      );

      -- Authenticated: allow (service role bypasses RLS; tighten when JWT has company claims)
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_auth_all', t);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
        t || '_auth_all',
        t
      );
    END IF;
  END LOOP;
END $$;

COMMENT ON SCHEMA public IS
  'RLS: anon denied on golden-loop tables; authenticated open until JWT company claims; service role for API.';
