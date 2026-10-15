# FleetAdvisor® foundation (Brief 114)

FleetAdvisor® is registered as module `fleetgraph`, pack `logistics_fleet`, table prefix `fg_`. It is off until a company turns it on. This brief is the hardened core: the register, jobs, the cost-per-kilometre engine, an honest fleet-map shell, and the owner desk. Live tracking is not built.

## What shipped

- One expandable group in the core sidebar: Command, Fleet map, Vehicles, Drivers, Jobs, CPK, Settings.
- Migration `supabase/migrations/20261019_fleetgraph_a.sql` (written, not applied to any database by this change).
- Pure cost engine in `lib/fleet/cpk.ts`. The worked example for vehicle SAMPLE 01 is the unit test `brief114-cpk.test.ts`.
- Staff route `GET/POST /api/fleet/fleetgraph`. The company id is the `x-fleet-company` header, then `requireCompanyPermission` checks membership. It is never read from the query string or the body.
- Signed-out preview at `/preview/fleetgraph` with an in-memory illustration book.

## Apply the migration by hand

1. Open the Supabase SQL editor for a test project.
2. Paste `supabase/migrations/20261019_fleetgraph_a.sql` and run it. It is safe to run again.
3. Confirm forced row security and the function and sequence locks:

```sql
SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname LIKE 'fg\_%' ESCAPE '\';

SELECT p.proname, has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname LIKE 'fg\_%' ESCAPE '\';

SELECT c.relname, has_sequence_privilege('anon', c.oid, 'USAGE') AS anon_usage
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'S' AND c.relname LIKE 'fg\_%' ESCAPE '\';
```

`relforcerowsecurity` must be true. `anon_exec` and `anon_usage` must be false.

## Roles

Company role comes from the existing permission matrix. It is not a second list.

| Company role | FleetAdvisor® role |
|---|---|
| owner | owner |
| admin | manager |
| member, operations | dispatcher |
| finance | office |
| viewer, sales | viewer |
| sales_contractor | none |

Dispatchers do not see job prices unless the owner turns that switch on. They do not see cost profiles, ledger rows, overhead or cost per kilometre. Office can read costs and prices. Driver pay stays off that view. Admin is a manager: costs yes, invoicing and the real-data switch no.

## Cost per kilometre, in plain language

A period is a half-open range of calendar dates in South African Standard Time. Running costs are ledger rows on the day they happened. Standing costs and capital accrue from the vehicle profile for every day the vehicle is in the fleet, including workshop days. Overhead is a monthly pool shared across vehicles. Tyre cost is either an accrual or a ledger row, never both. VAT that can be claimed is left out of the cost.

Distance prefers trip odometer deltas, then odometer readings, then GPS-derived distance. Planned kilometres are never used. If the distance is missing the screen says "Not enough data". If it is under the company minimum it says "Not enough distance". A partial result names what is still missing. Targets are the company's own. There is no external benchmark.

The method is specified in the design notes, section 8.5.

## Real-data gate

`fg_workspaces.real_data_enabled` defaults to false. While it is false the desk shows a demo-data banner and the staff route refuses driver and stop contact details. An owner confirms by typing ENABLE REAL DATA. That write is audit-logged. The preview does not call this gate.

## Not built in this brief

Live positions, map tiles, telematics, GPS import, driver phone tracking, dispatch, trips, quotes, proof of delivery, files, invoicing, reminders, and a public route. The fleet map says "Launching soon" for every source except a manual odometer reading. Ship is unchanged.

## Field labels that still need a human check

Licence disc, roadworthy, operator card, PrDP and medical labels are field names only. The product does not state them as legal advice. Durations are whatever date the company enters.
