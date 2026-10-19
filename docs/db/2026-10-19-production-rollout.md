# Production rollout, 19 Oct 2026

Production Supabase `onkklullmgrdqoertngp` was changed directly on 19 Oct 2026, 12:54–13:00 SAST. This note is the repo record of that end state. It does not apply anything.

## What changed, and why

| group | change | why |
|---|---|---|
| pg_trgm + 113 indexes | extension in schema `extensions`, then 3 profiles indexes (slug expression, two trigram GINs) and 110 btree indexes on tenant and foreign-key columns | stop sequential scans on tenant filters and unindexed foreign keys |
| B7 | dropped 17 exact duplicate indexes; 15 kept twins stayed | duplicate indexes cost writes and storage and add nothing |
| B5 | 11 `trade_portal` policies now call `(SELECT current_setting(...))` | Postgres can evaluate the setting once per query instead of once per row |
| B6 | revoked `anon` and `PUBLIC` EXECUTE on 6 `SECURITY DEFINER` functions; `authenticated` remains only on `user_has_access_to_profile` and `get_current_user_id` | those functions were executable by anon; the app calls the three `sa_nsnp_*` functions with the service role |

No rollback ran. The 113 indexes and `pg_trgm` were built with `CREATE INDEX CONCURRENTLY` / `CREATE EXTENSION` outside migration history. B7, B5 and B6 were applied with `apply_migration` and are in history.

## History mapping

Read-only `SELECT version, name FROM supabase_migrations.schema_migrations` on 19 Oct 2026. These four rows are the rollout (B4 was already merged as `20261023_brief122_merge_metadata_noop.sql`):

| production version | production name | repo file |
|---|---|---|
| *(not recorded)* | pg_trgm + 113 indexes | `supabase/migrations/20261024_brief122_pg_trgm_and_indexes.sql` |
| `20261019105859` | `brief122_b7_drop_duplicate_indexes` | `supabase/migrations/20261025_brief122_b7_drop_duplicate_indexes.sql` |
| `20261019105914` | `brief122_b5_rls_select_wrapping` | `supabase/migrations/20261026_brief122_b5_rls_select_wrapping.sql` |
| `20261019105955` | `brief122_b6_lockdown_definer_rpcs` | `supabase/migrations/20261027_brief122_b6_lockdown_definer_rpcs.sql` |

The repo keeps 8-digit versions (`YYYYMMDD_name.sql`), same as the other 180+ files, and these four sort after `20261023_brief122_merge_metadata_noop.sql`. The production 14-digit versions cannot be the filenames. `20261019105859_*.sql` sorts before `20261019_fleetgraph_a.sql` and before `20261020`–`20261023`, because the character after `20261019` is `1` in the 14-digit form and `_` in the repo form, and `1` < `_`. Those later files create tables the indexes need.

Applying the repo files on production later is idempotent (`IF NOT EXISTS` / `IF EXISTS` / the same `ALTER POLICY` and `REVOKE`). It would insert new history versions `20261024`–`20261027`. It would not collide with `20261019105859`, `20261019105914` or `20261019105955`. To record the repo versions without running the SQL, use `supabase migration repair --status applied` for `20261024`–`20261027` after review. This change does not do that.

`20261019091525 site_insights_report_archive` is also in production history and is not part of this rollout.

## CONCURRENTLY

`CREATE INDEX CONCURRENTLY` cannot run inside a transaction. The Supabase CLI applies each migration file in one transaction, so the repo file uses plain `CREATE INDEX IF NOT EXISTS`. On production the indexes already exist and the statements do nothing. On a new database the same file builds them inside the migration transaction. That is the right tool for an empty database. It is the wrong tool for a busy production table, which is why production used `CONCURRENTLY` first.

`SET LOCAL lock_timeout` applies when the file runs inside a transaction. As its own autocommit statement Postgres warns and ignores it. Pasting the file in `psql` without `-1` still works.

If a target table is missing, that one index is skipped with a notice. These 13 tables are not created by `supabase/migrations` (they exist on production): `business_catalog`, `business_services`, `company_certificates`, `riad_entries`, `company_connections`, `documents`, `shared_documents`, `supplier_riad_logs`, `container_performance_daily`, `payouts`, `po_items`, `product_documents`, `product_images`. A database built only from this repo will not have those 13 indexes until the tables exist.

## Duplicate indexes

B7 drops these 17 names. The kept twin is the one that stays.

| dropped | kept |
|---|---|
| `idx_bank_txn_status2` | `idx_bank_txn_status` |
| `idx_bc_requester_id`, `idx_connections_requester` | `idx_business_connections_requester` |
| `idx_bc_requestee_id`, `idx_connections_requestee` | `idx_business_connections_requestee` |
| `idx_company_documents_profile_id` | `idx_company_documents_profile` |
| `idx_container_inventory_profile` | `idx_container_inv_profile` |
| `idx_customers_profile_name` | `customers_profile_trading_name` |
| `idx_documents_profile_id` | `idx_documents_profile` |
| `idx_invitations_profile_id` | `idx_invitations_profile` |
| `idx_isp_agency_links_agency` | `idx_nsnp_isp_agency_links_agency_status` |
| `idx_nsnp_recipes_agency_active` | `idx_nsnp_recipes_agency` |
| `idx_projects_profile_id` | `idx_projects_profile` |
| `idx_po_supplier_legacy` | `idx_po_supplier_id` |
| `idx_nsnp_deliv_isp_status` | `idx_nsnp_deliv_isp` |
| `idx_nsnp_deliv_school_status` | `idx_nsnp_deliv_school` |
| `idx_srm_suppliers_profile_updated` | `srm_suppliers_profile_updated_desc` |

Seven of the dropped names were created by older repo SQL. Those statements were removed (the kept twins were left) from:

- `supabase/migrations/20260709_container_ops.sql`
- `supabase/migrations/20260726_isp_agency_association.sql`
- `supabase/migrations/20260904_crm_srm_book.sql` and `RUN_THIS_FOR_CRM_SRM_BOOK.sql`, `docs/RUN_THIS_FOR_CRM_SRM_BOOK.sql`
- `supabase/migrations/20260905_nsnp_hotpath_indexes.sql` and `RUN_NSNP_HOTPATH.sql`
- `supabase/migrations/20260906_nsnp_scale.sql` and `RUN_NSNP_HOTPATH.sql`

The other ten dropped names were not in the repo. `idx_business_connections_requester` and `idx_business_connections_requestee` are also not created here. B7 skips a pair when both names are absent, and it still refuses to drop a duplicate whose kept twin is missing or not an exact match. A fresh database therefore does not gain those two business-connection indexes; production already had them before this rollout.

## B5 and B6 on a fresh database

B5 rewrites the 11 policies created by `20261014_tradegraph.sql`. The guard accepts either the original stored text or the wrapped text.

B6 revokes EXECUTE when the function exists. The three `sa_nsnp_*` functions come from `20260905` and `20260906`. `user_has_access_to_profile`, `get_current_user_id`, `rls_auto_enable` and the `ensure_rls` event trigger are not created by this repo. If `rls_auto_enable` is present, `ensure_rls` must still be enabled, matching production.

`20260905`, `20260906` and `RUN_NSNP_HOTPATH.sql` still grant `authenticated` EXECUTE on the three `sa_nsnp_*` functions. Ordered replay ends with B6, which revokes that grant. Pasting those older files again after B6 opens the grant again.

## How to verify

Static check, no database:

```text
npx --yes tsx lib/db/brief122-duplicate-indexes.test.ts
```

Scratch Postgres only (the test refuses any host other than localhost and refuses the production project ref). Database name must be `brief122rollout`:

```text
BRIEF122_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/brief122rollout \
  npx --yes tsx lib/db/brief122-rollout-db.test.ts
```

That applies the four files twice, checks 113 indexes and `pg_trgm` in `extensions`, checks the 17 names stay dropped, checks the 11 policies wrap, and checks the B6 grants. CI runs the same test against a local Postgres service.
