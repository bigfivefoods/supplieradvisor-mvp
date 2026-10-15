# RecoverAdvisor® foundation

Brief A registers the RecoverAdvisor® module, the permission matrix, the schema skeleton, and the role-aware shell. Later briefs add the book, the workflow, and the portals. This change does not load a company, enable the module for a live company, or apply the migration.

## What this brief adds

- Module id `recovergraph`, pack id `recovery`, permission resources `recovery` and `recovery_trust`.
- Sidebar group only. There is no second sidebar on the page.
- Pages: command centre, queue, creditors, mandates, team and registrations, portals.
- Signed-out shells for creditor, debtor, and attorney. They do not read a token and they do not call an API.
- Migration `supabase/migrations/20261018_recovergraph_a.sql`.

`company_id` is `bigint` because `profiles.id` and `customers.id` are `bigint` in this database. RecoverAdvisor® row ids are `uuid`. There is no workspace-wide public token.

## Role and permission matrix

Company role decides the desk, unless an active staff row says otherwise. The company owner is always the owner, even with a collector staff row. Sales roles have no access.

| Company role | No staff row | Collector staff | Finance staff | Compliance staff | Manager staff |
| --- | --- | --- | --- | --- | --- |
| Owner | Owner | Owner | Owner | Owner | Owner |
| Admin | Manager | Agent | Finance | Compliance | Manager |
| Finance | Finance | Agent | Finance | Compliance | Manager |
| Operations | Viewer | Agent | Finance | Compliance | Manager |
| Member | Viewer | Agent | Finance | Compliance | Manager |
| Viewer | Viewer | Agent | Finance | Compliance | Manager |
| Sales | No access | No access | No access | No access | No access |

| Desk role | recovery | recovery_trust | Queues | Settings | Staff | Real data |
| --- | --- | --- | --- | --- | --- | --- |
| Owner | Admin | Admin | All queues | Yes | Yes | Yes |
| Manager (admin company role) | Write | View | All queues | Yes | Yes | No |
| Finance | View | Write | Queue | No | No | No |
| Operations | Write | None | Queue | No | No | No |
| Member | View | None | Queue | No | No | No |
| Viewer | View | None | Queue | No | No | No |
| Sales | None | None | Hidden | No | No | No |

An agent sees Overview and Work only. An agent does not see other staff, creditor rows, mandate rows, or trust configuration.

## Defaults

- Programme: collections only (`recovery`). Managed repayment is reserved in the schema and is not selectable.
- Trust mode: `trust`.
- Demo-data mode: `real_data_enabled` is false until the company owner types `ENABLE REAL DATA`. Debtor records stay in London (`eu-west-2`) and must not be loaded before that sign-off.

While demo-data mode is on, the shell shows: “RecoverAdvisor® is in demo-data mode until data-location and operator-agreement sign-off is complete.”

`assertRealDataAllowed(workspace)` in `lib/recovery/real-data-guard.ts` throws that same sentence when the flag is false. Later briefs that ingest debtor data call it first.

## Apply the migration

File: `supabase/migrations/20261018_recovergraph_a.sql`.

Not applied to any live database — awaiting Craig's approval.

1. Open the Supabase SQL editor for the London project.
2. Paste the file and run it once. The script is idempotent; a second run is safe.
3. Verify forced row security:

```sql
SELECT c.relname
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname LIKE 'recover_%'
  AND c.relkind = 'r'
  AND c.relrowsecurity
  AND c.relforcerowsecurity;
```

Expect ten tables. `anon`, `authenticated`, and `recover_portal` have no table grants. `service_role` can read and write.

4. Confirm `recover_workspaces` has no public token column, `real_data_enabled` defaults to false, and `comms_flags` defaults to email, WhatsApp, and SMS all false.

Rollback, only after review, is the comment block at the top of the migration. Drop the functions first, then the tables, then the `recover_portal` role.

## Portal security later briefs must keep

- No workspace-wide public token. Credentials are per person, hashed, expiring, and revocable.
- `recover_portal` is `NOLOGIN` and has zero table grants. Forced row security has no policy for `anon` or `authenticated`.
- Security definer functions use an empty `search_path` and are owned by the migration role. A function owned by `recover_portal` could not read a session, because that role has no grants and row security is forced. Execute is granted only to `service_role`.
- `recover_portal_call` whitelists `ping` only and returns no company or subject data. Every other outcome is the same `{ "ok": false }`.
- Compare codes with `recover_verify_code_ct`. Check `recover_portal_is_throttled` before the compare. Five wrong tries burn the code. More than 10 email failures or 50 workspace failures in 15 minutes locks. Errors lock.
- Company id comes from the verified membership or the session, never from the body or the query.
- Portal pages never echo the token. `Cache-Control: private, no-store`. `noindex, nofollow`.
- `recover_audit_log` rejects update and delete. Corrections are new rows.
- A missing table returns `ready: false`, not a 500 and not a weaker fallback.

## What later briefs add

- B — creditors, mandates, debtors, import, and the fictional seed.
- C — workflow, queue logic, and diary.
- D — templates, PDFs, and communications.
- E — arrangements, receipts, and the debtor portal.
- F — trust ledger, commission, VAT, and statements.
- G — creditor portal.
- H — attorney and legal hand-over.
- I — reports.
- J — compliance, POPIA, and verification.
- K — the industry page and the preview.
