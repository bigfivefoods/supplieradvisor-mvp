# Dual-tenant settle dry-run (connect → quote → claim → ledger)

Use **two signed-up companies**: Seller S and Buyer B on production (or local with both sessions).

Goal: prove **quote/invoice before connect accept**, then claim → confirm → ledger, with optional WhatsApp.

## Prerequisites

- [ ] Both companies registered and switchable (or two browsers)
- [ ] S has bank details on **My business → Profile → Banking**
- [ ] S has at least one sellable product (for line items)
- [ ] `GET /api/system/health` → `ok: true`, P0 readiness green
- [ ] Optional: Twilio WhatsApp env set (see `docs/alerts-whatsapp.md`)

## Path A — Pending connection (pre-accept)

### 1. Seller S — send connection request

1. Company = **S**
2. Connections → Discover (or directory) → find **B**
3. **Connect / Request**

**Expect**

- Edge appears under Connections → **Sent** (pending)
- Decision desk shows: **Quote · Invoice · WhatsApp bank**
- CRM customer for B appears with **Invited** (no re-add)

### 2. Seller S — quote or invoice while pending

1. Click **Invoice** (or Quotes) from the Sent card  
   → `/dashboard/customers/invoices?buyerProfileId=<B>`
2. Customer pre-selected · add lines · save draft
3. **Email** and/or **WhatsApp PDF** (Twilio attaches PDF if configured; else wa.me + link)
4. Optional: **WhatsApp bank** from Connections Sent card

**Expect**

- Doc saved with `customer_id` linked to B’s CRM row
- Buyer portal share may wait for accept — email/WhatsApp still works offline

### 3. Buyer B — accept connection (optional for email path)

1. Company = **B**
2. Connections → Incoming → **Accept**

**Expect**

- Edge accepted; books sync both ways
- Shared docs become readable if visibility=shared

### 4. Buyer B — claim payment (if invoice shared / paid offline)

1. Buyer Money / claims path for the invoice
2. Submit claim + POP if available

### 5. Seller S — Money hub settle

1. Company = **S** → **Customers → Money**
2. Claim inbox opens (top claim auto-drawer once per session)
3. Bank match preview loads for top claim
4. **Confirm** or **Confirm + apply bank match**

**Expect**

- Ledger payment posted
- High-confidence bank line linked when available
- First-trade strip may prompt **Rate partner** + **Invite next**

## Path B — API dual-tenant E2E (automated)

```bash
export PLAYWRIGHT_BASE_URL=https://www.supplieradvisor.com
export E2E_ACCESS_TOKEN=…          # seller
export E2E_COMPANY_ID=…
export E2E_BUYER_TOKEN=…
export E2E_BUYER_COMPANY_ID=…
export E2E_MUTATE=1
# optional: E2E_INVOICE_ID=… E2E_CONFIRM_CLAIM=1

npx playwright test e2e/claim-settle-dual.spec.ts e2e/quote-before-accept-smoke.spec.ts
```

## Pass criteria

| Check | Pass |
|-------|------|
| Pending outbound shows Quote / Invoice / WhatsApp bank | ☐ |
| CRM customer exists for peer without duplicate after accept | ☐ |
| Invoice/quote creatable with `buyerProfileId` preselect | ☐ |
| WhatsApp bank text includes account + reference (if bank set) | ☐ |
| Money hub claim Confirm posts ledger | ☐ |
| Bank suggest appears when bank txns exist | ☐ |
| First-trade strip after paid: rate + invite next | ☐ |
| Health Twilio green **or** documented soft-skip | ☐ |

## Related

- `docs/trade-loop-dry-run.md` — catalogue PO path  
- `docs/alerts-whatsapp.md` — Twilio setup  
- `docs/ops-checklist.md` — post-deploy ops  
- `e2e/claim-settle-dual.spec.ts` — mutate claim → ledger  
