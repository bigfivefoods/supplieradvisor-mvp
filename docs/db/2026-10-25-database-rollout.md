# Database rollout, 26 Oct 2026

SupplierAdvisor® database items from the 26 Oct 2026 improvement review. This note is the production order. It does not apply anything. Do not run these commands against production Supabase `onkklullmgrdqoertngp` until Craig has approved the step that needs his approval. Do not run them against company 110 (VUKA). This change does not read or write VUKA rows.

Staging `wpchtkfkaavcjyfgmktn` was not written. Timings below are from scratch Postgres 16, database `improve26`, loaded with a production-like volume. The same checks run in CI as `improve26 database`.

Versions `20261040`–`20261044` are not calendar days. They sort after `20261039`. A file named `20261025_*.sql` would sort before `20261032`.

## What needs Craig's approval

**20261043 only.** It changes two `SECURITY DEFINER` helpers:

- `public.get_current_user_id()`
- `public.user_has_access_to_profile(bigint)`

Signed-in and anonymous roles lose `EXECUTE` on the public copies, so PostgREST stops exposing them at `/rest/v1/rpc/`. Copies in schema `app_private` keep `EXECUTE` for `anon`, `authenticated`, and `service_role`, and any row level security policy that named the public functions is rewritten to `app_private` before the revoke. `service_role` still has `EXECUTE` on the public functions.

This is database privilege and policy text. It does not change Privy, JWT verification, the content security policy, or application auth code. Do not add `app_private` to the project's exposed Data API schemas. If it is exposed, the helpers are callable over the API again.

Stop after step 4 and wait for Craig before step 5.

The other steps (analyze, indexes, the explore function, the module-store merge) do not change who can call a security definer function. They still go to production only as this ordered rollout, not from CI.

## Measured gain

Cause of the slow site insights report, read from production `pg_stat_statements` on 25 Oct 2026 (no `EXPLAIN ANALYZE` was run on production):

| function | calls | mean | max | shared buffer hits / call |
|---|---:|---:|---:|---:|
| `site_insights_explore` | 31 | 3791.9 ms | 7148.6 ms | about 2,269,089 |
| `sa_put_module_store` | 53 | 1340.5 ms | 6641.4 ms | about 2,622, plus about 809 KB WAL / call |

`site_insights_events` was about 9,400 live rows and 295 pages. The buffer hits match a nested-loop sequential scan of that heap once per visitor id, against an unanalyzed temp table inside the new-versus-returning section. Missing indexes on the heap were not the cause. A stored first-seen summary was rejected: `site_insights_retain` deletes events older than 14 months, and a stored first timestamp would disagree with `min(ts)` of the rows that remain.

`sa_put_module_store` rewrites one jsonb document. The live GymAdvisor® book is that shape (bookings, sessions, clients, and the other id-arrays in one column). The merge copied the whole document with `jsonb_set` once per id-array key, including empty named arrays. Readers select `company_module_stores.data` directly, so the column stays one document.

Scratch Postgres 16, database `improve26`, 12,000 events across the three sites and a 25-day window (same order of magnitude as production). `lib/db/improve26-db.test.ts` prints `EXPLAIN (ANALYZE, BUFFERS)` and these timings. p95 below is the slowest sample (5 samples before, 7 after).

| check | before | after |
|---|---:|---:|
| `site_insights_explore` p95, 12,000 events | 1865.2 ms (1804.9, 1865.2, 1815.2, 1825.9, 1863.4) | 150.9 ms (138.1, 137.7, 139.4, 138.8, 150.9, 144.3, 139.6) |
| no-op `sa_merge_module_store_data`, 817 KB text (2,000 bookings, 800 sessions, 200 clients) | 36.0 ms | 20.1 ms |
| one booking changed inside that document | | 27.6 ms |
| `sa_put_module_store` of the same document, unchanged | 38.5 ms, and the row is rewritten | 21.0 ms, and `updated_at` stays put |
| `sa_put_module_store` of the whole document with one booking changed | 42.2 ms | 32.5 ms |

The explore JSON matched the previous function for the three-site window and for a one-site UTC window. A standalone `EXPLAIN (ANALYZE, BUFFERS)` of the new hash join over those 12,000 rows was a hash join, execution about 9.6 ms, 421 shared buffer hits. The production figure of about 2,269,089 hits is the nested loop inside the old function, not this plan.

This VM is faster than production, and the scratch document compresses more than the live GymAdvisor® book (about 2.4 MB of text, 395 KB stored). The production mean of 1340.5 ms lines up with repeating `jsonb_set` on that book. The new function leaves an unchanged id-array in place and skips the row update when the merged document and token are unchanged, which is the about 809 KB of WAL on a no-op save. A real edit still rewrites the changed array and the row.

A growth load of 132,000 events and 15,000 visitor ids, same machine, was slower than the production-like load. The old function's first call was 9761.8 ms and a second call was cancelled after several minutes. The new function was about 1.1 s (1075–1187 ms) after the content spark was one grouped pass. That is under the old time and above the 500 ms target. Production volume is the target. At about 13 times today's event count the report needs another pass.

`ANALYZE public.profiles` is a rollout step even though autoanalyze ran on 24 Oct 2026. `n_mod_since_analyze` was 248 on 25 Oct. Do not hide that `ANALYZE` inside a migration file that production will mark applied without executing.

## Order

Run one step, confirm it, then the next. Index builds are one statement at a time, outside a transaction.

### 1. Analyze

```sql
ANALYZE public.profiles;
ANALYZE public.site_insights_events;
ANALYZE public.site_insights_vitals;
```

Rollback: none. Run `ANALYZE` again if a later step is undone. This step must actually run. `supabase migration repair` does not analyze anything.

### 2. Pageview index

Run only the first statement in `docs/db/2026-10-25-indexes-concurrently.sql`, with autocommit, and wait until it finishes:

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS site_insights_events_pageview_vid_ts_idx
  ON public.site_insights_events (site, vid, ts)
  WHERE kind = 'pageview' AND vid IS NOT NULL;
```

Then record the repo version without executing `supabase/migrations/20261040_site_insights_pageview_vid_index.sql`. That file takes a lock until its transaction commits.

```text
supabase migration repair --status applied 20261040
```

Rollback:

```sql
DROP INDEX CONCURRENTLY IF EXISTS public.site_insights_events_pageview_vid_ts_idx;
```

If the repair was already recorded, leave the history row. A dropped index can be rebuilt with the same `CREATE INDEX CONCURRENTLY`.

### 3. Site insights function

Execute `supabase/migrations/20261041_site_insights_explore_speed.sql`. It replaces `site_insights_explore`. It does not lock `site_insights_events` for the build. Grants stay `service_role` only.

Rollback: execute `docs/db/2026-10-25-rollback-site-insights-explore.sql`. That restores the 25 Oct 2026 nested-loop body. It does not drop indexes.

### 4. Module store merge

Execute `supabase/migrations/20261042_module_store_merge_speed.sql`.

The merge result is the same: incoming id wins, incoming order first, then existing ids that were not sent, tombstones and `removed_ids` dropped, nested objects recurse, scalars overwrite. An unchanged id-array is not rebuilt, and a no-op save does not bump `company_module_stores.updated_at`. The stored jsonb is unchanged. `p_if_updated_at` is still accepted and not enforced, matching the function installed on production on 25 Oct 2026. `20260920_brief52_merge_speed_and_409_fix.sql` raises `stale_module_store`. Turning that check back on would 409 the second save from a tab that still holds the page-load timestamp.

Rollback: execute `docs/db/2026-10-25-rollback-module-store.sql`. That restores the live merge and a `sa_put_module_store` that updates the row on every save.

### 5. Security definer helpers — Craig's approval required

Do not run this step until Craig approves it.

Execute `supabase/migrations/20261043_definer_helper_lockdown.sql`.

On 25 Oct 2026 no policy, view, or other function called these two helpers. The migration still rewrites any policy that names them, then revokes `anon`, `authenticated`, and `PUBLIC`. It raises if a view or another function references either name, so those are fixed before this file is applied.

Rollback, if the public functions must be callable by signed-in users again:

```sql
GRANT EXECUTE ON FUNCTION public.get_current_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_access_to_profile(bigint) TO authenticated;
```

Policies already point at `app_private` and keep working while `app_private` grants remain. To point them back at `public`, replace `app_private.get_current_user_id` and `app_private.user_has_access_to_profile` in those policy expressions and recreate the policies. Leave `app_private` out of the exposed schemas either way.

### 6. Six foreign-key indexes

Run statements 2 through 7 of `docs/db/2026-10-25-indexes-concurrently.sql` one at a time. Wait for each. Do not execute `supabase/migrations/20261044_unindexed_fk_indexes.sql` on production. That file locks each table until commit. A missing table is skipped when the repo file runs on a fresh database.

```text
supabase migration repair --status applied 20261044
```

Indexes:

| statement | index | column |
|---|---|---|
| 2 | `idx_industries_parent_id` | `industries.parent_id` |
| 3 | `idx_nsnp_isp_sla_school_profile_id` | `nsnp_isp_sla.school_profile_id` |
| 4 | `idx_nsnp_prize_awards_period_id` | `nsnp_prize_awards.period_id` |
| 5 | `idx_nsnp_prize_certificates_period_id` | `nsnp_prize_certificates.period_id` |
| 6 | `idx_onchain_attestations_attested_by` | `onchain_attestations.attested_by` |
| 7 | `idx_products_category_id` | `products.category_id` |

`idx_nsnp_prize_awards_school_profile_id` already exists from N2. `period_id` is the missing one.

Rollback, one statement at a time:

```sql
DROP INDEX CONCURRENTLY IF EXISTS public.idx_industries_parent_id;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_nsnp_isp_sla_school_profile_id;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_nsnp_prize_awards_period_id;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_nsnp_prize_certificates_period_id;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_onchain_attestations_attested_by;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_products_category_id;
```

### 7. Migration history from PR #299

These commands were already written in `docs/db/2026-10-19-production-rollout.md`. They are repeated here so the 19 Oct repo versions and the 26 Oct index versions are one list. Do not execute `20261032`–`20261039` on production. Do not run `supabase db push` against production as a substitute.

```text
supabase migration repair --status applied 20261032
supabase migration repair --status applied 20261033
supabase migration repair --status applied 20261034
supabase migration repair --status applied 20261035
supabase migration repair --status applied 20261036
supabase migration repair --status applied 20261037
supabase migration repair --status applied 20261038
supabase migration repair --status applied 20261039
supabase migration repair --status applied 20261040
supabase migration repair --status applied 20261044
```

`20261040` and `20261044` are also in steps 2 and 6. Run each repair once, after the matching `CREATE INDEX CONCURRENTLY` has succeeded.

`20261041`, `20261042`, and `20261043` must be executed (steps 3, 4, and 5). Marking them applied with `migration repair` without executing the file leaves the old function body and the old grants in place.

Never run `supabase migration repair --status reverted` on a production-only version. That includes `20261019091525` (`site_insights_report_archive`) and every other 14-digit row already in `supabase_migrations.schema_migrations`. Clearing those rows makes `supabase db push` try to apply the repo migration files, about 190 of them, to production.

## Unused indexes

The advisor reported 723 unused indexes. A read of `pg_stat_user_indexes` on 25 Oct 2026 found 781 non-unique, non-primary indexes with `idx_scan = 0`, about 11.6 MB, across 323 tables. `stats_reset` was null, and traffic is too low to trust a zero. None are dropped. The list is `docs/db/2026-10-25-unused-index-audit.md`.

## Behaviour notes

- `site_insights_explore` keeps the same arguments, site whitelist, 400-day cap, 30-minute session gap, and JSON shape. `site_insights_channel` is not replaced.
- A no-op module save no longer moves `updated_at`. A real change still sets `updated_at` to `now()`.
- `p_if_updated_at` stays unenforced.
- `sa_put_module_store` stays executable by `service_role` only.
- `sa_merge_module_store_data` and `sa_module_store_merge_id_array` keep their existing grants. This rollout does not revoke them.
- `app_private` is not an exposed schema. Do not add it to the Data API schema list.
