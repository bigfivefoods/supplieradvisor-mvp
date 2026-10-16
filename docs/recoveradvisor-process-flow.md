# RecoverAdvisor® process flow

The Command page shows one diagram of the collection desk, from the creditor and the mandate through to the audit trail. The same card is on the signed-out Harbour preview. RecoverAdvisor® gives no legal advice.

## Ten steps, four phases

| Step | Phase | Status | Opens | Count |
|---|---|---|---|---|
| 1 Creditor onboarding | Set up the work | Live | Creditors | `counts.creditors` |
| 2 Mandate | Set up the work | Live | Mandates | `counts.mandates`, plus active NCA-regulated mandates |
| 3 Import and placement of accounts | Set up the work | Live | Imports | `book.placedCount`, plus assigned and unassigned. An agent sees only `assignedCount` for their own accounts |
| 4 Debtor tracing and contact verification | Reach the debtor | Partly live | Accounts | No count. Contact points can be recorded on the account now |
| 5 First contact and letter of demand (section 129 notice where the NCA applies) | Reach the debtor | Launching soon | No link | No count |
| 6 Promise to pay and payment arrangement | Agree and collect | Partly live | Accounts filtered to arrangement | `book.arrangementCount` |
| 7 Payments and reconciliation | Agree and collect | Partly live | Accounts filtered to paid | `book.paidCount` |
| 8 Escalation or closure | Close and account | Partly live | Accounts filtered to recalled | `book.recalledCount` and `book.closedCount`. No legal-matter count |
| 9 Remittance and statement to the creditor | Close and account | Launching soon | No link | No count |
| 10 Reporting and audit | Close and account | Launching soon | No link | No count |

A foundation card sits above step 1. It opens Team and registrations for an owner or a manager and shows `counts.staff`. It records that a Council registration is stored. It does not say who must hold one.

A "Where it runs" row sits in the footer. It opens Portals and install. The owner app, the workers app, and the client app are launching soon.

`book.closedCount` is accounts in state `closed` only. It does not include `prescribed` or `stopped`.

## What a later brief turns into a link

| Step | Later brief |
|---|---|
| 4 Tracing and verification | J, the compliance centre |
| 5 Letters, notices, and the section 129 notice | C workflow, D templates, H attorney pack |
| 6 Promises and schedules | E arrangements and receipts |
| 7 Receipting and reconciliation | E and F, the trust ledger |
| 8 Legal hand-over | H attorney pack. Recall and close already open |
| 9 Trust ledger and settlement statements | F and G, the creditor portal |
| 10 Reports and the compliance centre | I reports and J compliance centre |

Section 129 timings, the delivery method, and the consequences are not encoded here. ⚖ VERIFY.

## Who sees what

| Role | Diagram |
|---|---|
| Owner, manager | All ten steps, all counts, all links, the foundation card, and the install row. Open on arrival |
| Agent | The whole picture. No creditor, mandate, staff, or workspace totals. Step 3 shows only the accounts assigned to them. Steps 4, 6, 7, and 8 open their own accounts. Collapsed on arrival |
| Finance | Counts the payload includes for steps 1, 2, 3, 6, 7, and 8. Links to creditors, mandates, and accounts. No link to imports or team. Remittance is marked "You". The placed balance stays on the command card, as it did before this diagram. The diagram shows no money |
| Compliance | Same read-only shape as finance. Reporting is marked "You" |
| Viewer | Placed count, and links to creditors, mandates, and accounts. No assigned, arrangement, paid, recalled, or closed count |

An agent does not receive creditor, mandate, or staff counts. A viewer does not receive assigned, arrangement, or paid counts.

## Live page and signed-out preview

Both use `RecoverProcessFlow` inside `RecoverCommand`. The live page reads `GET /api/recovery/recovergraph` once. The preview reads the fictional desk already on the page. The diagram does not fetch.

Signed out, `?book=harbour` uses the Harbour memory book. Importing, assigning, or recalling in that session changes the counts. `?book=sample` shows the illustration counts that already exist, and steps 6 to 8 show no book count. `?book=empty` shows zeros. `?book=pending` shows titles and statuses only.

While the workspace is in demo-data mode, the header says "Demo data". The Harbour preview says "Demo data. No messages are sent."

## Counts

Head-counts are exact: placed, assigned, unassigned, arrangement, paid, recalled, and closed. A book can pass 2,000 accounts because each import file may hold 2,000 rows and files can be imported again.

`placedBalanceCents` is still the sum of active balances on the first 2,000 rows returned. The diagram does not display it.

No migration.

## How to change a step

Edit `lib/recovery/process-flow.ts` only, then the Brief 117 tests. Do not copy the step text into the component.

## ⚖ VERIFY

RecoverAdvisor® gives no legal advice. The diagram names a section 129 notice where the National Credit Act applies. It does not state a timing, a delivery method, or a consequence.
