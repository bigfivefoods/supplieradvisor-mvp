# GymAdvisor® Netcash debit orders

Scope for the per-company debit order and member invoicing flow inside SupplierAdvisor®. The first intended gym is VUKA Fitness. The build is multi-tenant: every company has its own Netcash settings. This pull request does not read or change company 110, and it does not apply SQL to production.

## What the gym owner gets

1. **Netcash settings** at GymAdvisor® → Netcash. Merchant account, Debit Order service key, Test/Live. The key is sealed with `GYM_NETCASH_ENC_KEY` and is never returned to the browser. Test mode is the default. Live mode is stored but this build refuses every live call.
2. **Mandates.** A member signs bank, account type, branch, account holder, debit day, amount, and consent. The server records the time and IP. Account validation uses the in-process Netcash test double. The owner activates a valid mandate, which uploads a masterfile batch.
3. **Billing runs.** One schedule per company (monthly, weekly, or fortnightly). Preview shows totals and the action date before submit. Submit is one idempotent job. A second submit returns the same batch.
4. **Action dates.** Weekends and South African public holidays are skipped. A Sunday holiday is also observed on Monday. The default cut-off is 14:00 Africa/Johannesburg, two business days before the action date.
5. **Results.** Polling the test double marks each line paid, unpaid, or reversed with a BankServ-style reason code. Retryable codes (02, 22, 99) can be submitted again up to the configured attempts. Optional late fee on the next run. Optional GymAdvisor® access hold, which check-in treats as blocked.
6. **Invoices.** Each billable member gets a VAT invoice on the existing `customer_invoices` book: plan, add-ons, pro-rata first month, discount. Numbers come from a per-company sequence (`GYM-00001`). Email uses the existing mailer when it is configured. WhatsApp is a share link, not a send. A reversed collection raises a credit note (`GCN-00001`). Paid collections are marked paid and handed to the finance settlement path (bank against accounts receivable).
7. **Collections.** Expected versus collected, unpaid rate, reason mix, upcoming run, member statement, CSV and PDF export.

Navigation is four items in the existing GymAdvisor® group: Collections, Debit orders, Billing runs, Netcash. There is no second in-page sidebar. The process diagram on each screen starts collapsed.

## Architecture

```
Browser (owner/admin)                Member portal token
        |                                    |
        v                                    v
app/api/fitness/netcash/*          app/api/public/fitgraph/debit-order
        |                                    |
        +-------- lib/fitness/netcash/service.ts
                            |
          +-----------------+------------------+
          |                 |                  |
     memory/tests      Supabase repo      Netcash client
                       migration          test double only
                       20261046
```

Pure rules (calendar, VAT, batch file, reasons, retries, journals) do not touch the network or the database. The service is the same code the API calls. Tests drive it with an in-memory repository and company id 901.

The Netcash client has no HTTP transport. `fetch` is not used. A live mode client returns an error. `GYM_NETCASH_ALLOW_NETWORK` does not turn the network on in this build.

## Netcash setup the gym owner does

1. Open a Netcash merchant account.
2. Ask Netcash to activate the **Debit Order** service (this build is the batch / NIWS debit-order load, not DebiCheck).
3. Copy the Debit Order service key into GymAdvisor® → Netcash. Do not paste it into chat, email, or a ticket.
4. Confirm the merchant account number on the same screen.
5. Leave the mode on **Test** until the go-live checklist below is signed.
6. Ask members to sign a mandate from their GymAdvisor® link (`/member/fitgraph/<token>/debit-order`).
7. Activate valid mandates so the masterfile batch is recorded.
8. Preview a billing run. Read the action date. Submit only when the totals are right.
9. After Netcash would have returned a statement, use Fetch results. In this build that calls the test double.

The batch file layout is tab-separated: `H` header, `T` transaction (reference, holder, account type 1/2/3, branch, account, cents), `F` footer. Confirm the column order against the gym's current Netcash service guide before any live file is produced. This build stores the file sealed and writes only the hash, count, and total to the audit log.

## Environment variables

Documented only. None of these are set by this pull request.

| Name | Purpose |
| --- | --- |
| `GYM_NETCASH_ENC_KEY` | 64 hex characters (32 bytes). Required before a service key or account number can be stored. |
| `GYM_NETCASH_VENDOR_KEY` | Reserved for the Netcash software vendor key on a future live file header. Not read by this build. |
| `GYM_NETCASH_ALLOW_NETWORK` | Reserved. This build still does not open a socket when it is set. |
| `GYM_NETCASH_ALLOW_COMPANY_110` | Set to `1` only at go-live to lift the lock on company 110. Leave unset until then. |
| `CRON_SECRET` | Already used by SupplierAdvisor®. The debit-order cron at `/api/fitness/netcash/cron` requires it. Do not create a second secret. |

## Migration

`supabase/migrations/20261046_gym_netcash_debit_orders.sql`

Do not apply it to production project `onkklullmgrdqoertngp`. Staging project `wpchtkfkaavcjyfgmktn` is the only database a human may apply it to, after reading the file.

Tables:

| Table | What it stores |
| --- | --- |
| `gym_netcash_settings` | One row per company. Service key column is not granted to signed-in users. |
| `gym_debit_mandates` | Mandates. Account number column is not granted to signed-in users. One open mandate per member. |
| `gym_billing_runs` | Preview and submitted runs. Unique per company and period. |
| `gym_billing_lines` | One row per member per attempt. Indexed for thousands of members. |
| `gym_netcash_batches` | Every masterfile and debit batch. File body sealed. Hash and counts readable. |
| `gym_netcash_audit` | Append-only audit. No secrets. |
| `gym_netcash_jobs` | Idempotent claims. A succeeded key is not run again. |
| `gym_invoice_sequences` | Per-company invoice and credit-note numbers. |
| `gym_member_access_holds` | Optional floor hold after a failed debit. |

Row level security is forced. `anon` is denied. `authenticated` may select only when `app_private.gym_netcash_owner_admin` matches an active owner or admin on that company. The service role is what the API uses, after the same owner/admin check.

`gym_netcash_next_number(company_id, name)` allocates the next invoice number. Execute is granted to `service_role` only.

## Money rules in this version

- Prices are VAT-inclusive at 15% unless the gym changes it. Membership revenue is 4400, VAT output 2120, bank 1110, receivables 1180, fee income 4300. The existing customer-invoice sync posts the real journals when the books are available.
- Pro-rata applies in the start month only: remaining days over days in the month.
- Packs, drop-ins, and annual plans are not put on the debit run.
- A failed debit fee is off until the gym sets an amount. It is added to the next invoice, not to the retry of the same debit.
- Retryable unpaid codes are 02, 22, and 99. Closed accounts, stopped payments, and no-authority codes are not retried.
- Auto-submit is off. The daily cron (06:15 SAST) prepares the preview and polls open batches. It submits only when the gym turns auto-submit on.
- Company 110 is refused by `companyAllowed` until `GYM_NETCASH_ALLOW_COMPANY_110=1`.

## Go-live checklist

- [ ] Migration applied on staging and checked. Not applied on production until Craig says so.
- [ ] `GYM_NETCASH_ENC_KEY` set in the host. Never printed.
- [ ] Confirm with Netcash that the product is Debit Order batch, not DebiCheck.
- [ ] Confirm the batch column order against the current Netcash guide.
- [ ] A real sandbox transport is still to be written. This build must not be pointed at live money.
- [ ] Craig decides auto-submit, the late fee, and whether unpaid debits suspend floor access.
- [ ] Craig sets `GYM_NETCASH_ALLOW_COMPANY_110=1` only when VUKA Fitness is allowed to use it.
- [ ] Run one test-mode preview for a non-production company and read the audit log.
- [ ] Do not load VUKA production members into a test.

## Tests

`npx tsx lib/fitness/netcash/netcash.test.ts`

Covers the calendar, VAT, pro-rata, encryption, the mock Netcash outcomes, idempotent submit, retries, access holds, credit notes, balanced journals, the company 110 lock, navigation, the collapsed process diagram, and a 3 000 member preview.
