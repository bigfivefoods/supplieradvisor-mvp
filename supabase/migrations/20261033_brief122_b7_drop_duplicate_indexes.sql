-- Brief 122 B7. Drop 17 exact duplicate indexes.
--
-- Production history (read 19 Oct 2026 from supabase_migrations.schema_migrations
-- on project onkklullmgrdqoertngp):
--   version 20261019105859
--   name    brief122_b7_drop_duplicate_indexes
-- This repo file is 20261033 so it sorts after 20261032_brief122_pg_trgm_and_indexes.sql.
-- 20261033 is not a calendar day. A filename that used the
-- production version would sort before later 8-digit migrations. See
-- docs/db/2026-10-19-production-rollout.md.
--
-- Idempotent. DROP INDEX IF EXISTS is a no-op when the duplicate is already
-- gone. The guard refuses to drop an index unless the kept twin exists, is
-- valid, and is an exact constraint-free duplicate. If neither name exists
-- (a fresh database that never created that pair), the pair is skipped.
-- Do not execute this file on production. Mark version 20261033 applied.
-- See docs/db/2026-10-19-production-rollout.md.
--
-- Kept twins stay. The older CREATE INDEX statements that would recreate the
-- 17 names were removed from the repo in this change.

SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';

DO $guard$
DECLARE r record; n_drop int := 0;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('bank_transactions','idx_bank_txn_status2','idx_bank_txn_status'),
    ('business_connections','idx_bc_requester_id','idx_business_connections_requester'),
    ('business_connections','idx_connections_requester','idx_business_connections_requester'),
    ('business_connections','idx_bc_requestee_id','idx_business_connections_requestee'),
    ('business_connections','idx_connections_requestee','idx_business_connections_requestee'),
    ('company_documents','idx_company_documents_profile_id','idx_company_documents_profile'),
    ('container_inventory','idx_container_inventory_profile','idx_container_inv_profile'),
    ('customers','idx_customers_profile_name','customers_profile_trading_name'),
    ('documents','idx_documents_profile_id','idx_documents_profile'),
    ('invitations','idx_invitations_profile_id','idx_invitations_profile'),
    ('nsnp_isp_agency_links','idx_isp_agency_links_agency','idx_nsnp_isp_agency_links_agency_status'),
    ('nsnp_recipes','idx_nsnp_recipes_agency_active','idx_nsnp_recipes_agency'),
    ('projects','idx_projects_profile_id','idx_projects_profile'),
    ('purchase_orders','idx_po_supplier_legacy','idx_po_supplier_id'),
    ('school_nsnp_deliveries','idx_nsnp_deliv_isp_status','idx_nsnp_deliv_isp'),
    ('school_nsnp_deliveries','idx_nsnp_deliv_school_status','idx_nsnp_deliv_school'),
    ('srm_suppliers','idx_srm_suppliers_profile_updated','srm_suppliers_profile_updated_desc')
  ) v(tbl, drop_idx, keep_idx)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_index i
      JOIN pg_class c ON c.oid = i.indexrelid
      WHERE c.relname = r.keep_idx
        AND c.relnamespace = 'public'::regnamespace
        AND i.indisvalid
    ) THEN
      IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        WHERE c.relname = r.drop_idx AND c.relnamespace = 'public'::regnamespace
      ) AND NOT EXISTS (
        SELECT 1 FROM pg_class c
        WHERE c.relname = r.keep_idx AND c.relnamespace = 'public'::regnamespace
      ) THEN
        RAISE NOTICE 'B7 guard: neither % nor % is present, skipping', r.drop_idx, r.keep_idx;
        CONTINUE;
      END IF;
      RAISE EXCEPTION 'B7 guard: kept index % missing or invalid, aborting', r.keep_idx;
    END IF;

    IF EXISTS (
      SELECT 1 FROM pg_class c
      WHERE c.relname = r.drop_idx AND c.relnamespace = 'public'::regnamespace
    ) THEN
      IF NOT EXISTS (
        SELECT 1 FROM pg_index a
        JOIN pg_class ca ON ca.oid = a.indexrelid
        JOIN pg_index b ON b.indrelid = a.indrelid
        JOIN pg_class cb ON cb.oid = b.indexrelid
        WHERE ca.relname = r.drop_idx
          AND cb.relname = r.keep_idx
          AND ca.relnamespace = 'public'::regnamespace
          AND cb.relnamespace = 'public'::regnamespace
          AND a.indkey = b.indkey
          AND a.indclass = b.indclass
          AND a.indcollation = b.indcollation
          AND a.indoption = b.indoption
          AND coalesce(pg_get_expr(a.indexprs, a.indrelid), '') = coalesce(pg_get_expr(b.indexprs, b.indrelid), '')
          AND coalesce(pg_get_expr(a.indpred, a.indrelid), '') = coalesce(pg_get_expr(b.indpred, b.indrelid), '')
          AND a.indisunique = b.indisunique
          AND ca.relam = cb.relam
          AND NOT a.indisunique
          AND NOT a.indisprimary
          AND NOT a.indisreplident
          AND NOT EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conindid = a.indexrelid)
      ) THEN
        RAISE EXCEPTION 'B7 guard: % is not an exact, constraint-free duplicate of %, aborting', r.drop_idx, r.keep_idx;
      END IF;
      n_drop := n_drop + 1;
    END IF;
  END LOOP;
  RAISE NOTICE 'B7 guard passed: % duplicate indexes will be dropped', n_drop;
END
$guard$;

DROP INDEX IF EXISTS public.idx_bank_txn_status2;
DROP INDEX IF EXISTS public.idx_bc_requester_id;
DROP INDEX IF EXISTS public.idx_connections_requester;
DROP INDEX IF EXISTS public.idx_bc_requestee_id;
DROP INDEX IF EXISTS public.idx_connections_requestee;
DROP INDEX IF EXISTS public.idx_company_documents_profile_id;
DROP INDEX IF EXISTS public.idx_container_inventory_profile;
DROP INDEX IF EXISTS public.idx_customers_profile_name;
DROP INDEX IF EXISTS public.idx_documents_profile_id;
DROP INDEX IF EXISTS public.idx_invitations_profile_id;
DROP INDEX IF EXISTS public.idx_isp_agency_links_agency;
DROP INDEX IF EXISTS public.idx_nsnp_recipes_agency_active;
DROP INDEX IF EXISTS public.idx_projects_profile_id;
DROP INDEX IF EXISTS public.idx_po_supplier_legacy;
DROP INDEX IF EXISTS public.idx_nsnp_deliv_isp_status;
DROP INDEX IF EXISTS public.idx_nsnp_deliv_school_status;
DROP INDEX IF EXISTS public.idx_srm_suppliers_profile_updated;
