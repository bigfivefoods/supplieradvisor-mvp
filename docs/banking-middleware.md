# Bank middleware (SupplierAdvisor)

Hybrid bank feeds: **live open-banking style (BankLink / FNB)** + **PDF/CSV statements** land in the same `bank_transactions` pipeline for allocation.

## Architecture

```
Connect bank | Upload PDF/CSV
        ↓
  CanonicalTxn + ingestCanonicalTxns()
        ↓
  bank_transactions (deduped)
        ↓
  Allocate / mass allocate / match AR-AP
```

## Providers

| Provider   | Status                         | How |
|-----------|--------------------------------|-----|
| `pdf`/`csv` | Live                         | Existing import → ingest |
| `sandbox` | Live without keys              | Demo FNB sample lines |
| `banklink`| Live with `BANKLINK_API_KEY`   | Link + sync + webhook |

## Environment

```bash
BANKLINK_API_KEY=sk_test_...          # or sk_live_...
BANKLINK_API_BASE=https://api.banklink.co.za/v1
BANKLINK_WEBHOOK_SECRET=optional_hmac
BANKLINK_SANDBOX=1                    # force sandbox even if key set
```

## API

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/banking/connections` | List connections + provider status |
| DELETE | `/api/banking/connections` | Revoke connection |
| POST | `/api/banking/connect` | `action: start \| complete` |
| POST | `/api/banking/sync` | Pull + ingest for a connection |
| POST | `/api/banking/webhooks/banklink` | Pulse destination |
| GET | `/api/banking/webhooks/banklink` | Health |

Webhook URL (production):

`https://www.supplieradvisor.com/api/banking/webhooks/banklink`

## Migration

Run:

`supabase/migrations/20260711_bank_middleware.sql`

Creates `bank_connections`, `bank_sync_runs`, `bank_match_rules`, and provider columns on `bank_transactions`.

## UI

**Accounting → Bank & allocation**

- **Connect bank** — sandbox completes in-page; live redirects to BankLink hosted link
- **Sync feed** — manual pull
- **Import PDF/CSV** — still first-class; uses same ingest middleware

## Next steps

1. Apply migration in Supabase production.
2. Create BankLink account + sandbox key; set env on Vercel.
3. Point a Pulse webhook at `/api/banking/webhooks/banklink`.
4. Harden match rules UI (table exists; engine can expand).
5. Add FNB direct / multi-bank adapters behind the same interface.
