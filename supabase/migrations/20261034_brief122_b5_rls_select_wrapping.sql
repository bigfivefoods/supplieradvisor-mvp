-- Brief 122 B5. Wrap current_setting() in 11 trade_portal policies so the
-- value is an initplan: (SELECT current_setting(...)) instead of a per-row call.
--
-- Production history (read 19 Oct 2026 from supabase_migrations.schema_migrations
-- on project onkklullmgrdqoertngp):
--   version 20261019105914
--   name    brief122_b5_rls_select_wrapping
-- Repo filename 20261034 sorts after the index and B7 files. 20261034 is not
-- a calendar day. The production
-- version cannot be the filename without sorting ahead of later 8-digit
-- migrations. See docs/db/2026-10-19-production-rollout.md.
--
-- Idempotent. The guard accepts the original expression and the already
-- wrapped expression. ALTER POLICY sets the same text again. A fresh database
-- whose policies were created by 20261014_tradegraph.sql matches the original
-- text once Postgres stores it. The "654 policies" notice is informational;
-- a database that is not production has a different policy count.

SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';

DO $guard$
DECLARE r record; bad int := 0;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('trade_customer_push','trade_portal_push_all',$q$(customer_id = current_setting('trade.customer_id'::text, true))$q$,$q$((customer_id = current_setting('trade.customer_id'::text, true)) AND (company_id = (current_setting('trade.company_id'::text, true))::bigint))$q$),
    ('trade_customers','trade_portal_customer',$q$(id = current_setting('trade.customer_id'::text, true))$q$,NULL),
    ('trade_invoices','trade_portal_invoices',$q$((customer_id = current_setting('trade.customer_id'::text, true)) AND (status <> 'void'::text))$q$,NULL),
    ('trade_job_lines','trade_portal_job_lines',$q$(customer_id = current_setting('trade.customer_id'::text, true))$q$,NULL),
    ('trade_job_requests','trade_portal_requests_insert',NULL,$q$((customer_id = current_setting('trade.customer_id'::text, true)) AND (company_id = (current_setting('trade.company_id'::text, true))::bigint) AND (status = 'new'::text))$q$),
    ('trade_job_requests','trade_portal_requests_select',$q$(customer_id = current_setting('trade.customer_id'::text, true))$q$,NULL),
    ('trade_job_updates','trade_portal_updates',$q$((customer_id = current_setting('trade.customer_id'::text, true)) AND (shared = true))$q$,NULL),
    ('trade_jobs','trade_portal_jobs',$q$((customer_id = current_setting('trade.customer_id'::text, true)) AND (status <> 'cancelled'::text))$q$,NULL),
    ('trade_payments','trade_portal_payments',$q$(customer_id = current_setting('trade.customer_id'::text, true))$q$,NULL),
    ('trade_quote_lines','trade_portal_quote_lines',$q$((customer_id = current_setting('trade.customer_id'::text, true)) AND (EXISTS ( SELECT 1
   FROM trade_quotes q
  WHERE ((q.id = trade_quote_lines.quote_id) AND (q.status <> 'draft'::text)))))$q$,NULL),
    ('trade_quotes','trade_portal_quotes',$q$((customer_id = current_setting('trade.customer_id'::text, true)) AND (status <> 'draft'::text))$q$,NULL)
  ) e(tbl, pol, qual_expected, check_expected)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = 'public'
        AND p.tablename = r.tbl
        AND p.policyname = r.pol
        AND p.permissive = 'PERMISSIVE'
        AND p.roles = '{trade_portal}'
        AND coalesce(regexp_replace(p.qual, '\( SELECT (current_setting\(''[a-z_.]+''::text, true\)) AS current_setting\)', '\1', 'g'), '') = coalesce(r.qual_expected, '')
        AND coalesce(regexp_replace(p.with_check, '\( SELECT (current_setting\(''[a-z_.]+''::text, true\)) AS current_setting\)', '\1', 'g'), '') = coalesce(r.check_expected, '')
    ) THEN
      RAISE WARNING 'B5 guard: policy %.% does not match the expected original text', r.tbl, r.pol;
      bad := bad + 1;
    END IF;
  END LOOP;
  IF bad > 0 THEN
    RAISE EXCEPTION 'B5 guard failed for % policies, aborting (nothing changed)', bad;
  END IF;
END
$guard$;

ALTER POLICY trade_portal_push_all ON public.trade_customer_push
  USING ((customer_id = (SELECT current_setting('trade.customer_id'::text, true))))
  WITH CHECK (((customer_id = (SELECT current_setting('trade.customer_id'::text, true))) AND (company_id = ((SELECT current_setting('trade.company_id'::text, true)))::bigint)));

ALTER POLICY trade_portal_customer ON public.trade_customers
  USING ((id = (SELECT current_setting('trade.customer_id'::text, true))));

ALTER POLICY trade_portal_invoices ON public.trade_invoices
  USING (((customer_id = (SELECT current_setting('trade.customer_id'::text, true))) AND (status <> 'void'::text)));

ALTER POLICY trade_portal_job_lines ON public.trade_job_lines
  USING ((customer_id = (SELECT current_setting('trade.customer_id'::text, true))));

ALTER POLICY trade_portal_requests_insert ON public.trade_job_requests
  WITH CHECK (((customer_id = (SELECT current_setting('trade.customer_id'::text, true))) AND (company_id = ((SELECT current_setting('trade.company_id'::text, true)))::bigint) AND (status = 'new'::text)));

ALTER POLICY trade_portal_requests_select ON public.trade_job_requests
  USING ((customer_id = (SELECT current_setting('trade.customer_id'::text, true))));

ALTER POLICY trade_portal_updates ON public.trade_job_updates
  USING (((customer_id = (SELECT current_setting('trade.customer_id'::text, true))) AND (shared = true)));

ALTER POLICY trade_portal_jobs ON public.trade_jobs
  USING (((customer_id = (SELECT current_setting('trade.customer_id'::text, true))) AND (status <> 'cancelled'::text)));

ALTER POLICY trade_portal_payments ON public.trade_payments
  USING ((customer_id = (SELECT current_setting('trade.customer_id'::text, true))));

ALTER POLICY trade_portal_quote_lines ON public.trade_quote_lines
  USING (((customer_id = (SELECT current_setting('trade.customer_id'::text, true))) AND (EXISTS ( SELECT 1
   FROM trade_quotes q
  WHERE ((q.id = trade_quote_lines.quote_id) AND (q.status <> 'draft'::text))))));

ALTER POLICY trade_portal_quotes ON public.trade_quotes
  USING (((customer_id = (SELECT current_setting('trade.customer_id'::text, true))) AND (status <> 'draft'::text)));

DO $post$
DECLARE n_wrapped int; n_all int;
BEGIN
  SELECT count(*) INTO n_wrapped
  FROM pg_policies
  WHERE schemaname = 'public'
    AND policyname LIKE 'trade\_portal\_%'
    AND (coalesce(qual, '') || coalesce(with_check, '')) LIKE '%AS current_setting%';
  SELECT count(*) INTO n_all FROM pg_policies WHERE schemaname = 'public';
  IF n_wrapped < 11 THEN
    RAISE EXCEPTION 'B5 post-assert: only % policies wrapped', n_wrapped;
  END IF;
  IF n_all <> 654 THEN
    RAISE NOTICE 'B5 post-assert: public policy count is % (production was 654 when this was planned)', n_all;
  END IF;
END
$post$;
