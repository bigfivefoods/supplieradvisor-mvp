# RecoverAdvisor® book

Brief B records creditors, mandates, debtors, contact points, accounts, and a CSV book import. It does not send messages. RecoverAdvisor® gives no legal advice.

## What this brief ships

Creditors and mandates can be recorded in demo-data mode. Debtors, contact points, identity numbers, and accounts from a user-supplied file are refused until real debtor data is enabled. The fictional Harbour demo book is loaded only while that flag is off, and every demo row is marked so it can be cleared. Stop flags are recorded with a reason and shown on the account. Nothing in RecoverAdvisor® contacts a debtor yet.

## Apply the migration manually

File: `supabase/migrations/20261021_recovergraph_b.sql`.

Written, not applied to any live database. Craig approves first. Paste the file into the Supabase SQL editor for a test company and run it. It is safe to run twice. Do not run it against a company that already holds real debtor data you have not reviewed.

After it runs, these catalog checks should hold:

- every `recover_%` table has forced row level security
- `anon`, `authenticated`, and `recover_portal` have no execute on `recover_%` functions and no table or sequence privilege
- the previous RecoverAdvisor® desk still opens if this file has not been applied yet; new screens then say that database setup is pending for that feature

## Keys

Generate both keys with `openssl rand -hex 32`. Store them as `RECOVER_PII_ENC_KEY` and `RECOVER_PII_HMAC_KEY` in the server environment only. Do not put them in the repo, a migration, or a browser bundle. Do not rotate either key without a re-encryption plan. If a key is missing or malformed, identity numbers are not stored.

## Who sees what

| Role | Accounts | Contacts | Import | Clear demo | Reveal an identity number |
|---|---|---|---|---|---|
| Owner | all | yes | yes | yes | yes, and the view is logged |
| Manager | all | yes | yes | no | yes, and the view is logged |
| Agent | assigned or team only | on those accounts | no | no | no |
| Finance | all, masked | no | no | no | no |
| Compliance | all, masked | no | no | no | no |
| Viewer | counts only | no | no | no | no |

## Demo book

Load the fictional Harbour demo book while real debtor data is off. Enabling real debtor data is refused while any demo row remains: clear the demo book first. Clear demo book removes only demo rows. An owner does that. A manager can load, import, and roll back, and cannot clear the demo book.

## Stop flags

Debt review, deceased estate, insolvency, represented, dispute, and do-not-contact are stored with a reason. An owner or a manager sets or clears a flag from the account page. The account shows a calm banner. Nothing in RecoverAdvisor® contacts a debtor yet, so the flag does not send or block a message.

## CSV

UTF-8, comma or semicolon, up to 2 MiB and 2,000 rows. Required columns: account reference, debtor name (or first and last name, or a company name), and principal. A fictional header row:

```
account number,debtor name,principal,phone,email
DEMO-1,Sample Debtor,1234.56,0100000001,sample.debtor@demo.example
```

Excel (.xlsx) is deferred. The pinned spreadsheet package has published prototype-pollution and ReDoS advisories, so this brief does not parse it.

## Installable apps

| App | Route | This brief | Later |
|---|---|---|---|
| Owner | `/work/recovergraph` | Command, accounts, creditors, imports, bottom bar | Queue scoring, trust money |
| Workers | `/crew/recovergraph/[token]` | Shell only; signed-in agents use their own accounts | Invite links and the field app |
| Clients | `/customer/recovergraph/[token]` | Shell only, no token lookup | Creditor portal |

Later briefs C through K carry the same three-app requirement.

## ⚖ VERIFY

The product records what an operator enters. It does not state these items as legal advice. ⚖ VERIFY who must hold a Council registration, how a section 129 notice is delivered, and the debt-review and in-duplum consequences before a later brief encodes them. Allocation order on a mandate is recorded and labelled ⚖ VERIFY. RecoverAdvisor® gives no legal advice.

## Later briefs

C adds the workflow and clocks. D adds templates. E adds arrangements and receipts. F adds the trust ledger. G adds the creditor portal. H adds the attorney pack. I adds reports. J adds the compliance centre. K adds the marketing page.
