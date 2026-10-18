# Staging seed (E2)

`node scripts/loadtest/seed.mjs` loads a synthetic company dataset into **one named staging database**. `node scripts/loadtest/seed-teardown.mjs` deletes that batch.

CI must not run either script. There is no npm script for them. Do not add a workflow step that executes them.

## Refusal

The process exits 1 before `psql` starts unless all of these are true:

- `SEED_TARGET_PROJECT_REF` is set
- `LOADTEST_EXPECT_PROJECT_REF` is set and equal to it
- neither value is the production Supabase project ref
- `SEED_DATABASE_URL` is set, its host is on `LOADTEST_ALLOWED_HOSTS`, and the URL does not contain the production ref
- the host is not a production domain (the allow-list cannot override that)

`DATABASE_URL` and `NEXT_PUBLIC_SUPABASE_URL` are ignored, so an app env pointed at production is not a target.

`--dry-run` prints the plan and does not connect. If any target variable is set and the guard fails, dry-run still exits 1.

A real run with no target exits 1.

The SQL files do not contain the guard. Do not pipe them to `psql` yourself.

## Commands

```bash
node scripts/loadtest/seed.mjs
node scripts/loadtest/seed.mjs --apply --expect-ref <staging-ref> --profile s1 --batch s1
node scripts/loadtest/seed.mjs --apply --expect-ref <staging-ref> --profile s2 --batch s2
node scripts/loadtest/seed-teardown.mjs --batch s1
```

The default is a dry run and does not connect. A write needs `--apply` and `--expect-ref`. That argument must match `SEED_TARGET_PROJECT_REF`, `LOADTEST_EXPECT_PROJECT_REF`, and the project ref decoded from `SEED_DATABASE_URL` (`postgres.<ref>` or `db.<ref>.supabase.co`). Percent-encoding, trailing dots, uppercase, and surrounding spaces are normalised before the check. The process refuses when `CI` or `VERCEL` is set.

`--profile` is `s1` or `s2` (default `s1`). `--batch` defaults to the profile name. Use a distinct batch for s2 so it does not collide with an s1 seed. A second successful run of the same batch is a no-op (exit 0). A partial batch exits 1 and tells you to tear down first.

`psql` must be on `PATH`. The URL is passed as libpq variables, not printed. If `psql` is missing the process exits 1 and nothing is seeded.

## What the rows look like

5,000 company profiles, 500 peer profiles (10%), and `business_users` at 5, 8, or 20 per company. Median is 8, minimum is 5, and 250 companies (5%) have 20 users. That shape is **36,250 users**. S1 `activity_log` is about **107.9 million** rows. The brief said 25,000 users for S1 and 100,000 for S2. Those figures cannot be true at the same time as median 8, minimum 5, and 5% at 20 across 5,000 companies. This generator follows the shape the unit tests name and does not force 25,000 or 100,000. Craig must sign off before anyone runs it. S1 and S2 use the same user shape. S2 scales transactional volumes (x3, with a heavy tail at x10 of the S1 base, and four whales at 100x that profile's typical volume).

Emails are only `*@loadtest.invalid`. Phones use the unassigned `+999` prefix. Names are generated. No production rows are copied.

Every row is marked with the batch id (`metadata.loadtest`, invoice notes, or `profile_id` / `company_id` for tables that have no metadata). Teardown deletes that batch only.

`ANALYZE` runs before commit. After commit the script prints table, heap, and index sizes.

Geo rows and a full chart-of-accounts template need the D1 dump, which is not in this repo. The seed writes four synthetic accounts per company (codes 1000, 2000, 3000, 4000) so journal lines balance. It does not read production.

## What was not verified

This change did not execute the seed or the teardown against a database. There is no staging project in this environment. Activity-log volume alone is on the order of 100 million rows for S1, so a full run was not attempted locally. The "under 30 minutes on a Large staging DB" check is not recorded.

Column lists are taken from migrations in the repo, not from a live schema dump. The assessment notes drift between applied migrations and files. A staging run can fail on a missing or extra NOT NULL column. The script is one transaction, so that failure rolls back. Do not treat a green unit test as a completed seed.

`bank_transactions.bank_account_id` is NOT NULL in the migration that creates the table, so the seed also inserts one marked `bank_accounts` row per company.
