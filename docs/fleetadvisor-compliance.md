# FleetAdvisor® compliance

Brief 115 adds the compliance centre, reminder rules, permits, CSV and Ship import, trailer hitches, and assignability reasons. The migration file is `supabase/migrations/20261020_fleetgraph_b.sql`. **Written, not applied to any live database. Craig approves first.**

## Manual apply

1. Open the Supabase SQL editor for a **test** company project. Do not run this against a live company book until the catalog checks below pass on that test project.
2. Pre-flight. Where `btree_gist` lives, and who owns it:

```sql
SELECT e.extname, n.nspname AS schema, r.rolname AS owner
FROM pg_extension e
JOIN pg_namespace n ON n.oid = e.extnamespace
JOIN pg_roles r ON r.oid = e.extowner
WHERE e.extname = 'btree_gist';
```

3. Paste the whole migration and run it once. It is re-runnable. Run it a second time and expect the same success.
4. Post-apply. Forced row security on every `fg_%` table:

```sql
SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname LIKE 'fg_%'
ORDER BY 1;
```

Both flags must be true on every row.

5. No function, table, or sequence grant for `PUBLIC`, `anon`, `authenticated`, or `fleet_portal`:

```sql
SELECT p.proname
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname LIKE 'fg_%'
  AND (
    has_function_privilege('public', p.oid, 'EXECUTE')
    OR has_function_privilege('anon', p.oid, 'EXECUTE')
    OR has_function_privilege('authenticated', p.oid, 'EXECUTE')
    OR has_function_privilege('fleet_portal', p.oid, 'EXECUTE')
  );
```

That query must return zero rows. Repeat the idea with `has_table_privilege` and `has_sequence_privilege` over `pg_class` for `fg_%`. `TRUNCATE` must also be absent, including on `fg_reminder_log`.

6. `btree_gist` is in `extensions`, and both exclusion constraints exist:

```sql
SELECT n.nspname FROM pg_extension e
JOIN pg_namespace n ON n.oid = e.extnamespace
WHERE e.extname = 'btree_gist';

SELECT conname FROM pg_constraint
WHERE contype = 'x' AND conname IN ('fg_cost_profiles_no_overlap', 'fg_trailer_links_no_overlap');
```

The extension schema must be `extensions`. If the first query shows a different owner and the migration printed a notice that it skipped the move, stop and move the extension manually as that owner: `ALTER EXTENSION btree_gist SET SCHEMA extensions;`

## btree_gist

`btree_gist` is relocatable. `ALTER EXTENSION btree_gist SET SCHEMA extensions` moves its functions, operator classes, and operator families together. The exclusion index on `fg_cost_profiles` stores the operator class by OID, so the constraint keeps enforcing after the move. Later `EXCLUDE USING gist` clauses, including the trailer hitch, resolve the operator class by type rather than by `search_path`.

Brief 114's file starts with `CREATE EXTENSION IF NOT EXISTS btree_gist`. Once the extension exists in any schema, that statement is a no-op, so re-running Brief 114 does not put it back in `public`.

The migration creates schema `extensions` if needed, then: absent → create in `extensions`; present in `public` → move; already in `extensions` → do nothing. The move is `ALTER EXTENSION btree_gist SET SCHEMA extensions` inside a block that catches `insufficient_privilege`. A non-superuser who owns the extension can still move it. A session that is not allowed to alter the extension, including a Supabase `postgres` role that is not the owner, skips the move with a notice and the rest of the file still runs. Membership of the owner role is not treated as permission to move it. Any other error aborts the file. Move it manually as the owner when the notice appears: `ALTER EXTENSION btree_gist SET SCHEMA extensions;`

`lib/fleet/brief115-db.test.ts` proves the move on Postgres 16: the extension is in `extensions`, no `pg_depend` deptype `e` object remains in `public`, the cost-profile exclusion still rejects an overlap with `23P01` and still accepts an adjacent range, the trailer exclusion does the same, the file applies twice, A→B→A→B stays in `extensions`, and a database that created the extension in `extensions` first is a no-op.

## Reminders

A reminder fires once per item, expiry date, threshold, channel, and recipient. The database unique index on claimed rows is the lock. The daily cron claims before it sends. A lost claim sends nothing.

Only the nearest threshold that has already been reached is sent. Higher thresholds that were also reached are recorded as skipped, so a missed day does not send a burst.

Threshold `0` fires on the expiry day and after it, once. A renewal changes `expires_on`, which changes the key, so the next cycle can send again.

The cron pages through every workspace, 100 at a time. While demo-data mode is on, it writes one skip audit only when a rule would have sent a reminder (`plan.due` is not empty). A workspace with nothing due writes no audit row. It writes no per-item log row in demo mode. Email is also skipped while the workspace email flag is off. Web push is skipped while it is not configured. Superseded rows are recorded from the reminder log itself, paged up to 5,000 keys, so a capped desk view cannot cause the same skip to be inserted again the next day.

A failed send is not retried for that same threshold. The failure is visible in the reminder log. The next threshold can still fire.

## Import from Ship

Import is owner-initiated, one-way, and idempotent. FleetAdvisor® reads `distribution_vehicles` and `distribution_drivers` with an explicit column list: vehicles `id, code, plate_number, make_model, vehicle_type, capacity_kg, status`; drivers `id, code, full_name, phone, email, license_class, status`. `license_number` is not selected, mapped, or stored. Nothing in `lib/fleet` or `app/api/fleet` inserts, updates, or deletes a `distribution_*` row.

A repeated commit of the same source hash returns already imported and adds no register rows.

## Thresholds are not advice

Expected date kinds and the PrDP GVM figure are company settings. The PrDP field is labelled as the company's own threshold and tells the reader to check with their licensing authority. Empty disables that warning. The product does not state a rule of law, a fee, or a limit.

## Roles

| Company role | Module role | Reminders | Ship import | CSV import | Export | Trailers |
| --- | --- | --- | --- | --- | --- | --- |
| owner | owner | yes | yes | yes | yes | yes |
| admin | manager | yes | no | yes | yes | yes |
| member, operations | dispatcher | no | no | no | no | yes |
| finance | office | no | no | no | yes | no |
| sales, viewer | viewer | no | no | no | no | no |
| other | none | no | no | no | no | no |

Roles without reminder access do not receive the member list, the import author, recipient ids, or the reminder log. Owner and manager do.

## Labels and ⚖ VERIFY

SCOPE §4 is the source of the field labels: licence disc, operator card, roadworthy, insurance, driving licence, PrDP category, medical review, cross-border countries, and abnormal-load province, route text, conditions, and escort. Those labels are records of what the user types. The product states none of them as advice. Operator card grace periods, which vehicles need a card, medical validity, PrDP validity, and abnormal-load limits are not encoded.
