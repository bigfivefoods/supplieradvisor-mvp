-- Brief 122. pg_trgm and the 113 indexes applied on production on 19 Oct 2026.
--
-- Production built each index with CREATE INDEX CONCURRENTLY, one statement
-- at a time, outside a transaction. Those statements are not rows in
-- supabase_migrations.schema_migrations. This file is the repo copy.
--
-- CONCURRENTLY is omitted on purpose. Supabase migration tooling applies a
-- file inside one transaction, and CREATE INDEX CONCURRENTLY cannot run
-- there (SQLSTATE 25001). CREATE INDEX IF NOT EXISTS is legal in a
-- transaction. It still takes a lock on every target table and holds those
-- locks until the transaction commits, including when the index already
-- exists. On production that is about 110 tables. Do not execute this file
-- there. Mark version 20261032 applied instead:
--   supabase migration repair --status applied 20261032
-- See docs/db/2026-10-19-production-rollout.md. Never repair a
-- production-only version back to reverted.
--
-- Repo version 20261032 sorts after 20261023_brief122_merge_metadata_noop.sql.
-- It is not a calendar day (October has 31 days), so it does not take the
-- version a real 20261024–20261031 migration would use. The production clock
-- time (about 202610191055) cannot be the filename: 20261019105500_*.sql
-- sorts before 20261019_fleetgraph_a.sql, because the character after
-- 20261019 is '1' in the 14-digit form and '_' in the repo form, and
-- '1' < '_'.
--
-- A table that is not in this database is skipped with a notice. Thirteen
-- target tables are not created by supabase/migrations; they do exist on
-- production, so a production apply still covers all 113 names.

CREATE SCHEMA IF NOT EXISTS extensions;

DO $ext$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'pg_trgm'
      AND n.nspname <> 'extensions'
  ) THEN
    RAISE EXCEPTION 'pg_trgm is installed outside schema extensions; the profiles trigram indexes need extensions.gin_trgm_ops';
  END IF;
END
$ext$;

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- Applies to the rest of this file when the migration runner has opened a
-- transaction (Supabase CLI). As its own autocommit statement it only warns.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '0';

-- 002 idx_profiles_store_slug
-- storefront slug resolve (lib/storefront/catalog.ts); staging EXPLAIN Seq Scan 0.425 ms -> Index Scan 0.151 ms, 72 -> 2 buffers; profiles seq-scan hotspot (assessment: 286k scans)
DO $idx$
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_profiles_store_slug, public.profiles is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_profiles_store_slug ON public.profiles ((metadata ->> 'store_slug')) WHERE (metadata ->> 'store_slug') IS NOT NULL$sql$;
END
$idx$;

-- 003 idx_profiles_trading_name_trgm
-- repo uses .ilike on trading_name (app/api/b2c/brands, business/group-links, schools/agency search, lib/accounting/party-book-role): trigram GIN is the only index that can serve it
DO $idx$
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_profiles_trading_name_trgm, public.profiles is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_profiles_trading_name_trgm ON public.profiles USING gin (trading_name extensions.gin_trgm_ops) WHERE trading_name IS NOT NULL$sql$;
END
$idx$;

-- 004 idx_profiles_legal_name_trgm
-- repo uses .ilike on legal_name (app/api/b2c/brands, business/group-links, schools/agency search, lib/accounting/party-book-role): trigram GIN is the only index that can serve it
DO $idx$
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_profiles_legal_name_trgm, public.profiles is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_profiles_legal_name_trgm ON public.profiles USING gin (legal_name extensions.gin_trgm_ops) WHERE legal_name IS NOT NULL$sql$;
END
$idx$;

-- 005 idx_activity_log_profile_id_created_at
-- stage-1/2 EXPLAIN: recent-50 per company 60.8 -> 0.8 ms; repo .eq(profile_id).order(created_at)
DO $idx$
BEGIN
  IF to_regclass('public.activity_log') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_activity_log_profile_id_created_at, public.activity_log is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_activity_log_profile_id_created_at ON public.activity_log (profile_id, created_at DESC)$sql$;
END
$idx$;

-- 006 idx_products_profile_id_name
-- also covers the tenant FK to profiles (cascade delete), replaces a B2 index; repo: 65 tenant-filter call sites
DO $idx$
BEGIN
  IF to_regclass('public.products') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_products_profile_id_name, public.products is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_products_profile_id_name ON public.products (profile_id, name)$sql$;
END
$idx$;

-- 007 idx_inventory_lots_profile_id_created_at
-- repo: 8 tenant-filter call sites
DO $idx$
BEGIN
  IF to_regclass('public.inventory_lots') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_inventory_lots_profile_id_created_at, public.inventory_lots is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_inventory_lots_profile_id_created_at ON public.inventory_lots (profile_id, created_at DESC)$sql$;
END
$idx$;

-- 008 idx_inventory_serials_profile_id_created_at
-- repo: 3 tenant-filter call sites
DO $idx$
BEGIN
  IF to_regclass('public.inventory_serials') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_inventory_serials_profile_id_created_at, public.inventory_serials is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_inventory_serials_profile_id_created_at ON public.inventory_serials (profile_id, created_at DESC)$sql$;
END
$idx$;

-- 009 idx_inventory_transfers_profile_id_created_at
-- repo: 1 tenant-filter call sites
DO $idx$
BEGIN
  IF to_regclass('public.inventory_transfers') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_inventory_transfers_profile_id_created_at, public.inventory_transfers is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_inventory_transfers_profile_id_created_at ON public.inventory_transfers (profile_id, created_at DESC)$sql$;
END
$idx$;

-- 010 idx_haccp_records_profile_id_recorded_at
-- also covers the tenant FK to profiles (cascade delete), replaces a B2 index
DO $idx$
BEGIN
  IF to_regclass('public.haccp_records') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_haccp_records_profile_id_recorded_at, public.haccp_records is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_haccp_records_profile_id_recorded_at ON public.haccp_records (profile_id, recorded_at DESC)$sql$;
END
$idx$;

-- 011 idx_haccp_ccps_profile_id_plan_id
-- repo: 2 tenant-filter call sites
DO $idx$
BEGIN
  IF to_regclass('public.haccp_ccps') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_haccp_ccps_profile_id_plan_id, public.haccp_ccps is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_haccp_ccps_profile_id_plan_id ON public.haccp_ccps (profile_id, plan_id)$sql$;
END
$idx$;

-- 012 idx_hr_payroll_lines_profile_id_payroll_run_id
-- also covers the tenant FK to profiles (cascade delete), replaces a B2 index; repo: 3 tenant-filter call sites
DO $idx$
BEGIN
  IF to_regclass('public.hr_payroll_lines') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_hr_payroll_lines_profile_id_payroll_run_id, public.hr_payroll_lines is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_hr_payroll_lines_profile_id_payroll_run_id ON public.hr_payroll_lines (profile_id, payroll_run_id)$sql$;
END
$idx$;

-- 013 idx_hr_disciplinary_events_profile_id_event_date
-- also covers the tenant FK to profiles (cascade delete), replaces a B2 index
DO $idx$
BEGIN
  IF to_regclass('public.hr_disciplinary_events') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_hr_disciplinary_events_profile_id_event_date, public.hr_disciplinary_events is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_hr_disciplinary_events_profile_id_event_date ON public.hr_disciplinary_events (profile_id, event_date DESC)$sql$;
END
$idx$;

-- 014 idx_hr_recognition_profile_id_recognition_date
-- also covers the tenant FK to profiles (cascade delete), replaces a B2 index
DO $idx$
BEGIN
  IF to_regclass('public.hr_recognition') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_hr_recognition_profile_id_recognition_date, public.hr_recognition is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_hr_recognition_profile_id_recognition_date ON public.hr_recognition (profile_id, recognition_date DESC)$sql$;
END
$idx$;

-- 015 idx_training_records_profile_id_created_at
-- repo: 3 tenant-filter call sites
DO $idx$
BEGIN
  IF to_regclass('public.training_records') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_training_records_profile_id_created_at, public.training_records is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_training_records_profile_id_created_at ON public.training_records (profile_id, created_at DESC)$sql$;
END
$idx$;

-- 016 idx_timesheets_profile_id_work_date
-- also covers the tenant FK to profiles (cascade delete), replaces a B2 index
DO $idx$
BEGIN
  IF to_regclass('public.timesheets') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_timesheets_profile_id_work_date, public.timesheets is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_timesheets_profile_id_work_date ON public.timesheets (profile_id, work_date DESC)$sql$;
END
$idx$;

-- 017 idx_trade_portal_messages_profile_id_created_at
-- also covers the tenant FK to profiles (cascade delete), replaces a B2 index; repo: 4 tenant-filter call sites
DO $idx$
BEGIN
  IF to_regclass('public.trade_portal_messages') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_trade_portal_messages_profile_id_created_at, public.trade_portal_messages is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_trade_portal_messages_profile_id_created_at ON public.trade_portal_messages (profile_id, created_at DESC)$sql$;
END
$idx$;

-- 018 idx_trade_customer_push_company_id_created_at
-- repo: 1 tenant-filter call sites
DO $idx$
BEGIN
  IF to_regclass('public.trade_customer_push') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_trade_customer_push_company_id_created_at, public.trade_customer_push is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_trade_customer_push_company_id_created_at ON public.trade_customer_push (company_id, created_at DESC)$sql$;
END
$idx$;

-- 019 idx_trade_customer_sessions_company_id_created_at
-- also covers the tenant FK to profiles (cascade delete), replaces a B2 index
DO $idx$
BEGIN
  IF to_regclass('public.trade_customer_sessions') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_trade_customer_sessions_company_id_created_at, public.trade_customer_sessions is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_trade_customer_sessions_company_id_created_at ON public.trade_customer_sessions (company_id, created_at DESC)$sql$;
END
$idx$;

-- 020 idx_trade_job_lines_company_id
-- repo: 1 tenant-filter call sites
DO $idx$
BEGIN
  IF to_regclass('public.trade_job_lines') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_trade_job_lines_company_id, public.trade_job_lines is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_trade_job_lines_company_id ON public.trade_job_lines (company_id)$sql$;
END
$idx$;

-- 021 idx_trade_job_updates_company_id
-- repo: 1 tenant-filter call sites
DO $idx$
BEGIN
  IF to_regclass('public.trade_job_updates') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_trade_job_updates_company_id, public.trade_job_updates is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_trade_job_updates_company_id ON public.trade_job_updates (company_id)$sql$;
END
$idx$;

-- 022 idx_trade_material_lines_company_id
-- repo: 1 tenant-filter call sites
DO $idx$
BEGIN
  IF to_regclass('public.trade_material_lines') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_trade_material_lines_company_id, public.trade_material_lines is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_trade_material_lines_company_id ON public.trade_material_lines (company_id)$sql$;
END
$idx$;

-- 023 idx_trade_payments_company_id_paid_at
-- also covers the tenant FK to profiles (cascade delete), replaces a B2 index; repo: 1 tenant-filter call sites
DO $idx$
BEGIN
  IF to_regclass('public.trade_payments') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_trade_payments_company_id_paid_at, public.trade_payments is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_trade_payments_company_id_paid_at ON public.trade_payments (company_id, paid_at DESC)$sql$;
END
$idx$;

-- 024 idx_trade_quote_lines_company_id
-- repo: 1 tenant-filter call sites
DO $idx$
BEGIN
  IF to_regclass('public.trade_quote_lines') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_trade_quote_lines_company_id, public.trade_quote_lines is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_trade_quote_lines_company_id ON public.trade_quote_lines (company_id)$sql$;
END
$idx$;

-- 025 idx_manufacturing_bom_lines_profile_id_created_at
-- also covers the tenant FK to profiles (cascade delete), replaces a B2 index
DO $idx$
BEGIN
  IF to_regclass('public.manufacturing_bom_lines') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_manufacturing_bom_lines_profile_id_created_at, public.manufacturing_bom_lines is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_manufacturing_bom_lines_profile_id_created_at ON public.manufacturing_bom_lines (profile_id, created_at DESC)$sql$;
END
$idx$;

-- 026 idx_manufacturing_mps_lines_profile_id_week_start
-- also covers the tenant FK to profiles (cascade delete), replaces a B2 index; repo: 1 tenant-filter call sites
DO $idx$
BEGIN
  IF to_regclass('public.manufacturing_mps_lines') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_manufacturing_mps_lines_profile_id_week_start, public.manufacturing_mps_lines is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_manufacturing_mps_lines_profile_id_week_start ON public.manufacturing_mps_lines (profile_id, week_start)$sql$;
END
$idx$;

-- 027 idx_manufacturing_mrp_requirements_profile_id_requirement_date
-- also covers the tenant FK to profiles (cascade delete), replaces a B2 index
DO $idx$
BEGIN
  IF to_regclass('public.manufacturing_mrp_requirements') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_manufacturing_mrp_requirements_profile_id_requirement_date, public.manufacturing_mrp_requirements is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_manufacturing_mrp_requirements_profile_id_requirement_date ON public.manufacturing_mrp_requirements (profile_id, requirement_date)$sql$;
END
$idx$;

-- 028 idx_pm_tasks_profile_id_project_id
-- repo: 12 tenant-filter call sites
DO $idx$
BEGIN
  IF to_regclass('public.pm_tasks') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_pm_tasks_profile_id_project_id, public.pm_tasks is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_pm_tasks_profile_id_project_id ON public.pm_tasks (profile_id, project_id)$sql$;
END
$idx$;

-- 029 idx_pm_milestones_profile_id_project_id
-- repo: 3 tenant-filter call sites
DO $idx$
BEGIN
  IF to_regclass('public.pm_milestones') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_pm_milestones_profile_id_project_id, public.pm_milestones is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_pm_milestones_profile_id_project_id ON public.pm_milestones (profile_id, project_id)$sql$;
END
$idx$;

-- 030 idx_pm_gate_transitions_profile_id_project_id_created_at
-- also covers the tenant FK to profiles (cascade delete), replaces a B2 index
DO $idx$
BEGIN
  IF to_regclass('public.pm_gate_transitions') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_pm_gate_transitions_profile_id_project_id_created_at, public.pm_gate_transitions is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_pm_gate_transitions_profile_id_project_id_created_at ON public.pm_gate_transitions (profile_id, project_id, created_at DESC)$sql$;
END
$idx$;

-- 031 idx_loyalty_accounts_profile_id_customer_id
-- repo: 3 tenant-filter call sites
DO $idx$
BEGIN
  IF to_regclass('public.loyalty_accounts') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_loyalty_accounts_profile_id_customer_id, public.loyalty_accounts is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_loyalty_accounts_profile_id_customer_id ON public.loyalty_accounts (profile_id, customer_id)$sql$;
END
$idx$;

-- 032 idx_loyalty_transactions_profile_id_created_at
-- repo: 1 tenant-filter call sites
DO $idx$
BEGIN
  IF to_regclass('public.loyalty_transactions') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_loyalty_transactions_profile_id_created_at, public.loyalty_transactions is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_profile_id_created_at ON public.loyalty_transactions (profile_id, created_at DESC)$sql$;
END
$idx$;

-- 033 idx_business_catalog_profile_id_sku
-- also covers the tenant FK to profiles (cascade delete), replaces a B2 index
DO $idx$
BEGIN
  IF to_regclass('public.business_catalog') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_business_catalog_profile_id_sku, public.business_catalog is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_business_catalog_profile_id_sku ON public.business_catalog (profile_id, sku)$sql$;
END
$idx$;

-- 034 idx_business_services_profile_id_name
-- repo: 2 tenant-filter call sites
DO $idx$
BEGIN
  IF to_regclass('public.business_services') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_business_services_profile_id_name, public.business_services is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_business_services_profile_id_name ON public.business_services (profile_id, name)$sql$;
END
$idx$;

-- 035 idx_carbon_entries_profile_id_created_at
-- also covers the tenant FK to profiles (cascade delete), replaces a B2 index
DO $idx$
BEGIN
  IF to_regclass('public.carbon_entries') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_carbon_entries_profile_id_created_at, public.carbon_entries is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_carbon_entries_profile_id_created_at ON public.carbon_entries (profile_id, created_at DESC)$sql$;
END
$idx$;

-- 036 idx_company_certificates_profile_id_created_at
-- also covers the tenant FK to profiles (cascade delete), replaces a B2 index
DO $idx$
BEGIN
  IF to_regclass('public.company_certificates') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_company_certificates_profile_id_created_at, public.company_certificates is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_company_certificates_profile_id_created_at ON public.company_certificates (profile_id, created_at DESC)$sql$;
END
$idx$;

-- 037 idx_compliance_certificates_profile_id_expires_at
-- also covers the tenant FK to profiles (cascade delete), replaces a B2 index
DO $idx$
BEGIN
  IF to_regclass('public.compliance_certificates') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_compliance_certificates_profile_id_expires_at, public.compliance_certificates is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_compliance_certificates_profile_id_expires_at ON public.compliance_certificates (profile_id, expires_at)$sql$;
END
$idx$;

-- 038 idx_container_payouts_profile_id_created_at
-- also covers the tenant FK to profiles (cascade delete), replaces a B2 index
DO $idx$
BEGIN
  IF to_regclass('public.container_payouts') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_container_payouts_profile_id_created_at, public.container_payouts is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_container_payouts_profile_id_created_at ON public.container_payouts (profile_id, created_at DESC)$sql$;
END
$idx$;

-- 039 idx_container_sales_profile_id_sale_date
-- also covers the tenant FK to profiles (cascade delete), replaces a B2 index; repo: 5 tenant-filter call sites
DO $idx$
BEGIN
  IF to_regclass('public.container_sales') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_container_sales_profile_id_sale_date, public.container_sales is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_container_sales_profile_id_sale_date ON public.container_sales (profile_id, sale_date DESC)$sql$;
END
$idx$;

-- 040 idx_container_stock_counts_profile_id_counted_at
-- also covers the tenant FK to profiles (cascade delete), replaces a B2 index
DO $idx$
BEGIN
  IF to_regclass('public.container_stock_counts') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_container_stock_counts_profile_id_counted_at, public.container_stock_counts is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_container_stock_counts_profile_id_counted_at ON public.container_stock_counts (profile_id, counted_at DESC)$sql$;
END
$idx$;

-- 041 idx_contractor_invites_profile_id_status
-- also covers the tenant FK to profiles (cascade delete), replaces a B2 index
DO $idx$
BEGIN
  IF to_regclass('public.contractor_invites') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_contractor_invites_profile_id_status, public.contractor_invites is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_contractor_invites_profile_id_status ON public.contractor_invites (profile_id, status)$sql$;
END
$idx$;

-- 042 idx_edi_messages_profile_id_created_at
-- repo: 1 tenant-filter call sites
DO $idx$
BEGIN
  IF to_regclass('public.edi_messages') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_edi_messages_profile_id_created_at, public.edi_messages is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_edi_messages_profile_id_created_at ON public.edi_messages (profile_id, created_at DESC)$sql$;
END
$idx$;

-- 043 idx_riad_entries_profile_id_created_at
-- also covers the tenant FK to profiles (cascade delete), replaces a B2 index
DO $idx$
BEGIN
  IF to_regclass('public.riad_entries') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_riad_entries_profile_id_created_at, public.riad_entries is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_riad_entries_profile_id_created_at ON public.riad_entries (profile_id, created_at DESC)$sql$;
END
$idx$;

-- 044 idx_company_connections_initiated_by
-- FK child of profiles; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.company_connections') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_company_connections_initiated_by, public.company_connections is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_company_connections_initiated_by ON public.company_connections (initiated_by)$sql$;
END
$idx$;

-- 045 idx_company_group_links_requested_by_profile_id
-- FK child of profiles; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.company_group_links') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_company_group_links_requested_by_profile_id, public.company_group_links is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_company_group_links_requested_by_profile_id ON public.company_group_links (requested_by_profile_id)$sql$;
END
$idx$;

-- 046 idx_customer_invitations_target_profile_id
-- FK child of profiles; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.customer_invitations') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_customer_invitations_target_profile_id, public.customer_invitations is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_customer_invitations_target_profile_id ON public.customer_invitations (target_profile_id)$sql$;
END
$idx$;

-- 047 idx_documents_verified_by
-- FK child of profiles; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.documents') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_documents_verified_by, public.documents is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_documents_verified_by ON public.documents (verified_by)$sql$;
END
$idx$;

-- 048 idx_riad_logs_created_by
-- FK child of profiles; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.riad_logs') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_riad_logs_created_by, public.riad_logs is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_riad_logs_created_by ON public.riad_logs (created_by)$sql$;
END
$idx$;

-- 049 idx_riad_logs_stakeholder_id
-- FK child of profiles; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.riad_logs') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_riad_logs_stakeholder_id, public.riad_logs is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_riad_logs_stakeholder_id ON public.riad_logs (stakeholder_id)$sql$;
END
$idx$;

-- 050 idx_shared_documents_to_profile_id
-- FK child of profiles; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.shared_documents') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_shared_documents_to_profile_id, public.shared_documents is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_shared_documents_to_profile_id ON public.shared_documents (to_profile_id)$sql$;
END
$idx$;

-- 051 idx_supplier_riad_logs_supplier_id
-- FK child of profiles; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.supplier_riad_logs') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_supplier_riad_logs_supplier_id, public.supplier_riad_logs is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_supplier_riad_logs_supplier_id ON public.supplier_riad_logs (supplier_id)$sql$;
END
$idx$;

-- 052 idx_container_inventory_product_id
-- FK child of products; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.container_inventory') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_container_inventory_product_id, public.container_inventory is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_container_inventory_product_id ON public.container_inventory (product_id)$sql$;
END
$idx$;

-- 053 idx_container_performance_daily_contract_id
-- FK child of contracts; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.container_performance_daily') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_container_performance_daily_contract_id, public.container_performance_daily is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_container_performance_daily_contract_id ON public.container_performance_daily (contract_id)$sql$;
END
$idx$;

-- 054 idx_container_stock_counts_contractor_id
-- FK child of container_contractors; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.container_stock_counts') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_container_stock_counts_contractor_id, public.container_stock_counts is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_container_stock_counts_contractor_id ON public.container_stock_counts (contractor_id)$sql$;
END
$idx$;

-- 055 idx_containers_contractor_id
-- FK child of container_contractors; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.containers') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_containers_contractor_id, public.containers is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_containers_contractor_id ON public.containers (contractor_id)$sql$;
END
$idx$;

-- 056 idx_contractor_invites_container_id
-- FK child of containers; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.contractor_invites') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_contractor_invites_container_id, public.contractor_invites is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_contractor_invites_container_id ON public.contractor_invites (container_id)$sql$;
END
$idx$;

-- 057 idx_contractor_invites_contractor_id
-- FK child of container_contractors; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.contractor_invites') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_contractor_invites_contractor_id, public.contractor_invites is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_contractor_invites_contractor_id ON public.contractor_invites (contractor_id)$sql$;
END
$idx$;

-- 058 idx_customers_connection_id
-- FK child of business_connections; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.customers') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_customers_connection_id, public.customers is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_customers_connection_id ON public.customers (connection_id)$sql$;
END
$idx$;

-- 059 idx_fg_compliance_items_renewed_from_id
-- FK child of fg_compliance_items; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.fg_compliance_items') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_fg_compliance_items_renewed_from_id, public.fg_compliance_items is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_fg_compliance_items_renewed_from_id ON public.fg_compliance_items (renewed_from_id)$sql$;
END
$idx$;

-- 060 idx_fg_cost_entries_company_id_driver_id
-- FK child of fg_drivers; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.fg_cost_entries') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_fg_cost_entries_company_id_driver_id, public.fg_cost_entries is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_fg_cost_entries_company_id_driver_id ON public.fg_cost_entries (company_id, driver_id)$sql$;
END
$idx$;

-- 061 idx_fg_cost_entries_company_id_reverses_id
-- FK child of fg_cost_entries; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.fg_cost_entries') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_fg_cost_entries_company_id_reverses_id, public.fg_cost_entries is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_fg_cost_entries_company_id_reverses_id ON public.fg_cost_entries (company_id, reverses_id)$sql$;
END
$idx$;

-- 062 idx_fg_cost_entries_vehicle_id
-- FK child of fg_vehicles; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.fg_cost_entries') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_fg_cost_entries_vehicle_id, public.fg_cost_entries is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_fg_cost_entries_vehicle_id ON public.fg_cost_entries (vehicle_id)$sql$;
END
$idx$;

-- 063 idx_fg_cost_profiles_vehicle_id
-- FK child of fg_vehicles; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.fg_cost_profiles') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_fg_cost_profiles_vehicle_id, public.fg_cost_profiles is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_fg_cost_profiles_vehicle_id ON public.fg_cost_profiles (vehicle_id)$sql$;
END
$idx$;

-- 064 idx_fg_jobs_company_id_customer_id
-- FK child of customers; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.fg_jobs') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_fg_jobs_company_id_customer_id, public.fg_jobs is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_fg_jobs_company_id_customer_id ON public.fg_jobs (company_id, customer_id)$sql$;
END
$idx$;

-- 065 idx_fg_jobs_company_id_driver_id
-- FK child of fg_drivers; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.fg_jobs') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_fg_jobs_company_id_driver_id, public.fg_jobs is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_fg_jobs_company_id_driver_id ON public.fg_jobs (company_id, driver_id)$sql$;
END
$idx$;

-- 066 idx_fg_jobs_company_id_vehicle_id
-- FK child of fg_vehicles; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.fg_jobs') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_fg_jobs_company_id_vehicle_id, public.fg_jobs is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_fg_jobs_company_id_vehicle_id ON public.fg_jobs (company_id, vehicle_id)$sql$;
END
$idx$;

-- 067 idx_fg_jobs_customer_id
-- FK child of customers; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.fg_jobs') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_fg_jobs_customer_id, public.fg_jobs is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_fg_jobs_customer_id ON public.fg_jobs (customer_id)$sql$;
END
$idx$;

-- 068 idx_fg_odometer_readings_vehicle_id
-- FK child of fg_vehicles; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.fg_odometer_readings') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_fg_odometer_readings_vehicle_id, public.fg_odometer_readings is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_fg_odometer_readings_vehicle_id ON public.fg_odometer_readings (vehicle_id)$sql$;
END
$idx$;

-- 069 idx_fg_portal_otps_invite_id
-- FK child of fg_portal_invites; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.fg_portal_otps') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_fg_portal_otps_invite_id, public.fg_portal_otps is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_fg_portal_otps_invite_id ON public.fg_portal_otps (invite_id)$sql$;
END
$idx$;

-- 070 idx_fg_position_events_vehicle_id
-- FK child of fg_vehicles; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.fg_position_events') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_fg_position_events_vehicle_id, public.fg_position_events is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_fg_position_events_vehicle_id ON public.fg_position_events (vehicle_id)$sql$;
END
$idx$;

-- 071 idx_fg_telematics_links_vehicle_id
-- FK child of fg_vehicles; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.fg_telematics_links') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_fg_telematics_links_vehicle_id, public.fg_telematics_links is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_fg_telematics_links_vehicle_id ON public.fg_telematics_links (vehicle_id)$sql$;
END
$idx$;

-- 072 idx_fg_trailer_links_trailer_id
-- FK child of fg_vehicles; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.fg_trailer_links') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_fg_trailer_links_trailer_id, public.fg_trailer_links is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_fg_trailer_links_trailer_id ON public.fg_trailer_links (trailer_id)$sql$;
END
$idx$;

-- 073 idx_fg_trailer_links_truck_id
-- FK child of fg_vehicles; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.fg_trailer_links') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_fg_trailer_links_truck_id, public.fg_trailer_links is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_fg_trailer_links_truck_id ON public.fg_trailer_links (truck_id)$sql$;
END
$idx$;

-- 074 idx_fg_vehicle_status_events_vehicle_id
-- FK child of fg_vehicles; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.fg_vehicle_status_events') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_fg_vehicle_status_events_vehicle_id, public.fg_vehicle_status_events is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_fg_vehicle_status_events_vehicle_id ON public.fg_vehicle_status_events (vehicle_id)$sql$;
END
$idx$;

-- 075 idx_fixed_assets_work_station_id
-- FK child of manufacturing_work_stations; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.fixed_assets') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_fixed_assets_work_station_id, public.fixed_assets is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_fixed_assets_work_station_id ON public.fixed_assets (work_station_id)$sql$;
END
$idx$;

-- 076 idx_hr_leave_requests_leave_type_id
-- FK child of hr_leave_types; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.hr_leave_requests') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_hr_leave_requests_leave_type_id, public.hr_leave_requests is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_hr_leave_requests_leave_type_id ON public.hr_leave_requests (leave_type_id)$sql$;
END
$idx$;

-- 077 idx_manufacturing_asset_allocations_work_center_id
-- FK child of manufacturing_work_centers; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.manufacturing_asset_allocations') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_manufacturing_asset_allocations_work_center_id, public.manufacturing_asset_allocations is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_manufacturing_asset_allocations_work_center_id ON public.manufacturing_asset_allocations (work_center_id)$sql$;
END
$idx$;

-- 078 idx_manufacturing_asset_allocations_work_station_id
-- FK child of manufacturing_work_stations; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.manufacturing_asset_allocations') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_manufacturing_asset_allocations_work_station_id, public.manufacturing_asset_allocations is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_manufacturing_asset_allocations_work_station_id ON public.manufacturing_asset_allocations (work_station_id)$sql$;
END
$idx$;

-- 079 idx_manufacturing_business_units_parent_id
-- FK child of manufacturing_business_units; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.manufacturing_business_units') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_manufacturing_business_units_parent_id, public.manufacturing_business_units is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_manufacturing_business_units_parent_id ON public.manufacturing_business_units (parent_id)$sql$;
END
$idx$;

-- 080 idx_manufacturing_production_orders_bom_id
-- FK child of manufacturing_boms; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.manufacturing_production_orders') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_manufacturing_production_orders_bom_id, public.manufacturing_production_orders is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_manufacturing_production_orders_bom_id ON public.manufacturing_production_orders (bom_id)$sql$;
END
$idx$;

-- 081 idx_manufacturing_production_orders_work_center_id
-- FK child of manufacturing_work_centers; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.manufacturing_production_orders') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_manufacturing_production_orders_work_center_id, public.manufacturing_production_orders is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_manufacturing_production_orders_work_center_id ON public.manufacturing_production_orders (work_center_id)$sql$;
END
$idx$;

-- 082 idx_payouts_contract_id
-- FK child of contracts; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.payouts') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_payouts_contract_id, public.payouts is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_payouts_contract_id ON public.payouts (contract_id)$sql$;
END
$idx$;

-- 083 idx_pm_project_riads_riad_log_id
-- FK child of riad_logs; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.pm_project_riads') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_pm_project_riads_riad_log_id, public.pm_project_riads is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_pm_project_riads_riad_log_id ON public.pm_project_riads (riad_log_id)$sql$;
END
$idx$;

-- 084 idx_po_items_product_id
-- FK child of products; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.po_items') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_po_items_product_id, public.po_items is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_po_items_product_id ON public.po_items (product_id)$sql$;
END
$idx$;

-- 085 idx_product_documents_product_id
-- FK child of products; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.product_documents') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_product_documents_product_id, public.product_documents is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_product_documents_product_id ON public.product_documents (product_id)$sql$;
END
$idx$;

-- 086 idx_product_images_product_id
-- FK child of products; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.product_images') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_product_images_product_id, public.product_images is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON public.product_images (product_id)$sql$;
END
$idx$;

-- 087 idx_project_tasks_project_id
-- FK child of projects; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.project_tasks') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_project_tasks_project_id, public.project_tasks is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_project_tasks_project_id ON public.project_tasks (project_id)$sql$;
END
$idx$;

-- 088 idx_recover_accounts_assigned_to
-- FK child of recover_staff; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.recover_accounts') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_recover_accounts_assigned_to, public.recover_accounts is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_recover_accounts_assigned_to ON public.recover_accounts (assigned_to)$sql$;
END
$idx$;

-- 089 idx_recover_accounts_batch_id
-- FK child of recover_batches; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.recover_accounts') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_recover_accounts_batch_id, public.recover_accounts is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_recover_accounts_batch_id ON public.recover_accounts (batch_id)$sql$;
END
$idx$;

-- 090 idx_recover_accounts_creditor_id
-- FK child of recover_creditors; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.recover_accounts') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_recover_accounts_creditor_id, public.recover_accounts is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_recover_accounts_creditor_id ON public.recover_accounts (creditor_id)$sql$;
END
$idx$;

-- 091 idx_recover_accounts_debtor_id
-- FK child of recover_debtors; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.recover_accounts') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_recover_accounts_debtor_id, public.recover_accounts is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_recover_accounts_debtor_id ON public.recover_accounts (debtor_id)$sql$;
END
$idx$;

-- 092 idx_recover_accounts_mandate_id
-- FK child of recover_mandates; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.recover_accounts') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_recover_accounts_mandate_id, public.recover_accounts is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_recover_accounts_mandate_id ON public.recover_accounts (mandate_id)$sql$;
END
$idx$;

-- 093 idx_recover_accounts_team_id
-- FK child of recover_teams; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.recover_accounts') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_recover_accounts_team_id, public.recover_accounts is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_recover_accounts_team_id ON public.recover_accounts (team_id)$sql$;
END
$idx$;

-- 094 idx_recover_batches_creditor_id
-- FK child of recover_creditors; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.recover_batches') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_recover_batches_creditor_id, public.recover_batches is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_recover_batches_creditor_id ON public.recover_batches (creditor_id)$sql$;
END
$idx$;

-- 095 idx_recover_batches_mandate_id
-- FK child of recover_mandates; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.recover_batches') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_recover_batches_mandate_id, public.recover_batches is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_recover_batches_mandate_id ON public.recover_batches (mandate_id)$sql$;
END
$idx$;

-- 096 idx_recover_contact_points_batch_id
-- FK child of recover_batches; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.recover_contact_points') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_recover_contact_points_batch_id, public.recover_contact_points is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_recover_contact_points_batch_id ON public.recover_contact_points (batch_id)$sql$;
END
$idx$;

-- 097 idx_recover_contact_points_debtor_id
-- FK child of recover_debtors; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.recover_contact_points') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_recover_contact_points_debtor_id, public.recover_contact_points is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_recover_contact_points_debtor_id ON public.recover_contact_points (debtor_id)$sql$;
END
$idx$;

-- 098 idx_recover_creditors_customer_id
-- FK child of customers; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.recover_creditors') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_recover_creditors_customer_id, public.recover_creditors is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_recover_creditors_customer_id ON public.recover_creditors (customer_id)$sql$;
END
$idx$;

-- 099 idx_recover_debtors_merged_into_id
-- FK child of recover_debtors; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.recover_debtors') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_recover_debtors_merged_into_id, public.recover_debtors is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_recover_debtors_merged_into_id ON public.recover_debtors (merged_into_id)$sql$;
END
$idx$;

-- 100 idx_recover_mandates_creditor_id
-- FK child of recover_creditors; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.recover_mandates') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_recover_mandates_creditor_id, public.recover_mandates is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_recover_mandates_creditor_id ON public.recover_mandates (creditor_id)$sql$;
END
$idx$;

-- 101 idx_recover_staff_company_id_team_id
-- FK child of recover_teams; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.recover_staff') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_recover_staff_company_id_team_id, public.recover_staff is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_recover_staff_company_id_team_id ON public.recover_staff (company_id, team_id)$sql$;
END
$idx$;

-- 102 idx_recover_teams_lead_staff_id
-- FK child of recover_staff; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.recover_teams') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_recover_teams_lead_staff_id, public.recover_teams is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_recover_teams_lead_staff_id ON public.recover_teams (lead_staff_id)$sql$;
END
$idx$;

-- 103 idx_school_import_batches_school_profile_id
-- FK child of school_profiles; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.school_import_batches') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_school_import_batches_school_profile_id, public.school_import_batches is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_school_import_batches_school_profile_id ON public.school_import_batches (school_profile_id)$sql$;
END
$idx$;

-- 104 idx_school_kitchen_stock_approved_product_id
-- FK child of nsnp_approved_products; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.school_kitchen_stock') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_school_kitchen_stock_approved_product_id, public.school_kitchen_stock is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_school_kitchen_stock_approved_product_id ON public.school_kitchen_stock (approved_product_id)$sql$;
END
$idx$;

-- 105 idx_school_menu_cycles_school_profile_id
-- FK child of school_profiles; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.school_menu_cycles') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_school_menu_cycles_school_profile_id, public.school_menu_cycles is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_school_menu_cycles_school_profile_id ON public.school_menu_cycles (school_profile_id)$sql$;
END
$idx$;

-- 106 idx_stock_movements_container_id
-- FK child of containers; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.stock_movements') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_stock_movements_container_id, public.stock_movements is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_stock_movements_container_id ON public.stock_movements (container_id)$sql$;
END
$idx$;

-- 107 idx_trade_customer_invites_customer_id
-- FK child of trade_customers; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.trade_customer_invites') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_trade_customer_invites_customer_id, public.trade_customer_invites is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_trade_customer_invites_customer_id ON public.trade_customer_invites (customer_id)$sql$;
END
$idx$;

-- 108 idx_trade_customer_sessions_customer_id
-- FK child of trade_customers; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.trade_customer_sessions') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_trade_customer_sessions_customer_id, public.trade_customer_sessions is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_trade_customer_sessions_customer_id ON public.trade_customer_sessions (customer_id)$sql$;
END
$idx$;

-- 109 idx_trade_invoices_customer_id
-- FK child of trade_customers; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.trade_invoices') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_trade_invoices_customer_id, public.trade_invoices is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_trade_invoices_customer_id ON public.trade_invoices (customer_id)$sql$;
END
$idx$;

-- 110 idx_trade_job_requests_customer_id
-- FK child of trade_customers; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.trade_job_requests') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_trade_job_requests_customer_id, public.trade_job_requests is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_trade_job_requests_customer_id ON public.trade_job_requests (customer_id)$sql$;
END
$idx$;

-- 111 idx_trade_jobs_customer_id
-- FK child of trade_customers; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.trade_jobs') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_trade_jobs_customer_id, public.trade_jobs is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_trade_jobs_customer_id ON public.trade_jobs (customer_id)$sql$;
END
$idx$;

-- 112 idx_trade_material_lines_order_id
-- FK child of trade_material_orders; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.trade_material_lines') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_trade_material_lines_order_id, public.trade_material_lines is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_trade_material_lines_order_id ON public.trade_material_lines (order_id)$sql$;
END
$idx$;

-- 113 idx_trade_quotes_customer_id
-- FK child of trade_customers; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.trade_quotes') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_trade_quotes_customer_id, public.trade_quotes is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_trade_quotes_customer_id ON public.trade_quotes (customer_id)$sql$;
END
$idx$;

-- 114 idx_training_records_contractor_id
-- FK child of contractors; a delete/cascade on the parent scans this table without it
DO $idx$
BEGIN
  IF to_regclass('public.training_records') IS NULL THEN
    RAISE NOTICE 'brief122 indexes: skip idx_training_records_contractor_id, public.training_records is absent';
    RETURN;
  END IF;
  EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_training_records_contractor_id ON public.training_records (contractor_id)$sql$;
END
$idx$;

DO $count$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n
  FROM pg_class c
  JOIN pg_namespace ns ON ns.oid = c.relnamespace
  WHERE ns.nspname = 'public'
    AND c.relkind = 'i'
    AND c.relname = ANY (ARRAY['idx_profiles_store_slug','idx_profiles_trading_name_trgm','idx_profiles_legal_name_trgm','idx_activity_log_profile_id_created_at','idx_products_profile_id_name','idx_inventory_lots_profile_id_created_at','idx_inventory_serials_profile_id_created_at','idx_inventory_transfers_profile_id_created_at','idx_haccp_records_profile_id_recorded_at','idx_haccp_ccps_profile_id_plan_id','idx_hr_payroll_lines_profile_id_payroll_run_id','idx_hr_disciplinary_events_profile_id_event_date','idx_hr_recognition_profile_id_recognition_date','idx_training_records_profile_id_created_at','idx_timesheets_profile_id_work_date','idx_trade_portal_messages_profile_id_created_at','idx_trade_customer_push_company_id_created_at','idx_trade_customer_sessions_company_id_created_at','idx_trade_job_lines_company_id','idx_trade_job_updates_company_id','idx_trade_material_lines_company_id','idx_trade_payments_company_id_paid_at','idx_trade_quote_lines_company_id','idx_manufacturing_bom_lines_profile_id_created_at','idx_manufacturing_mps_lines_profile_id_week_start','idx_manufacturing_mrp_requirements_profile_id_requirement_date','idx_pm_tasks_profile_id_project_id','idx_pm_milestones_profile_id_project_id','idx_pm_gate_transitions_profile_id_project_id_created_at','idx_loyalty_accounts_profile_id_customer_id','idx_loyalty_transactions_profile_id_created_at','idx_business_catalog_profile_id_sku','idx_business_services_profile_id_name','idx_carbon_entries_profile_id_created_at','idx_company_certificates_profile_id_created_at','idx_compliance_certificates_profile_id_expires_at','idx_container_payouts_profile_id_created_at','idx_container_sales_profile_id_sale_date','idx_container_stock_counts_profile_id_counted_at','idx_contractor_invites_profile_id_status','idx_edi_messages_profile_id_created_at','idx_riad_entries_profile_id_created_at','idx_company_connections_initiated_by','idx_company_group_links_requested_by_profile_id','idx_customer_invitations_target_profile_id','idx_documents_verified_by','idx_riad_logs_created_by','idx_riad_logs_stakeholder_id','idx_shared_documents_to_profile_id','idx_supplier_riad_logs_supplier_id','idx_container_inventory_product_id','idx_container_performance_daily_contract_id','idx_container_stock_counts_contractor_id','idx_containers_contractor_id','idx_contractor_invites_container_id','idx_contractor_invites_contractor_id','idx_customers_connection_id','idx_fg_compliance_items_renewed_from_id','idx_fg_cost_entries_company_id_driver_id','idx_fg_cost_entries_company_id_reverses_id','idx_fg_cost_entries_vehicle_id','idx_fg_cost_profiles_vehicle_id','idx_fg_jobs_company_id_customer_id','idx_fg_jobs_company_id_driver_id','idx_fg_jobs_company_id_vehicle_id','idx_fg_jobs_customer_id','idx_fg_odometer_readings_vehicle_id','idx_fg_portal_otps_invite_id','idx_fg_position_events_vehicle_id','idx_fg_telematics_links_vehicle_id','idx_fg_trailer_links_trailer_id','idx_fg_trailer_links_truck_id','idx_fg_vehicle_status_events_vehicle_id','idx_fixed_assets_work_station_id','idx_hr_leave_requests_leave_type_id','idx_manufacturing_asset_allocations_work_center_id','idx_manufacturing_asset_allocations_work_station_id','idx_manufacturing_business_units_parent_id','idx_manufacturing_production_orders_bom_id','idx_manufacturing_production_orders_work_center_id','idx_payouts_contract_id','idx_pm_project_riads_riad_log_id','idx_po_items_product_id','idx_product_documents_product_id','idx_product_images_product_id','idx_project_tasks_project_id','idx_recover_accounts_assigned_to','idx_recover_accounts_batch_id','idx_recover_accounts_creditor_id','idx_recover_accounts_debtor_id','idx_recover_accounts_mandate_id','idx_recover_accounts_team_id','idx_recover_batches_creditor_id','idx_recover_batches_mandate_id','idx_recover_contact_points_batch_id','idx_recover_contact_points_debtor_id','idx_recover_creditors_customer_id','idx_recover_debtors_merged_into_id','idx_recover_mandates_creditor_id','idx_recover_staff_company_id_team_id','idx_recover_teams_lead_staff_id','idx_school_import_batches_school_profile_id','idx_school_kitchen_stock_approved_product_id','idx_school_menu_cycles_school_profile_id','idx_stock_movements_container_id','idx_trade_customer_invites_customer_id','idx_trade_customer_sessions_customer_id','idx_trade_invoices_customer_id','idx_trade_job_requests_customer_id','idx_trade_jobs_customer_id','idx_trade_material_lines_order_id','idx_trade_quotes_customer_id','idx_training_records_contractor_id']::text[]);
  RAISE NOTICE 'brief122 indexes present: % of 113', n;
END
$count$;
