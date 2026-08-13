# Apple Pay / Paystack domain verification

Per [Paystack Apple Pay docs](https://paystack.com/docs/payments/apple-pay/):

1. Enable Apple Pay under Dashboard → Preferences (accept Apple terms)
2. Settings → Apple Pay → Web Domains → **Add new domain**
3. Host verification file at the path below (already done in this repo)
4. Click **Verify Domain**

## Exact URL Apple checks

```
https://www.supplieradvisor.com/.well-known/apple-developer-merchantid-domain-association
https://supplieradvisor.com/.well-known/apple-developer-merchantid-domain-association
```

No trailing slash. No file extension. Content-Type: **application/text**.

## How we host it

| Layer | Path |
|-------|------|
| Source of truth | `lib/billing/apple-pay-domain-association.ts` |
| Static copy | `public/.well-known/apple-developer-merchantid-domain-association` |
| Edge route | `app/.well-known/.../route.ts` + `app/api/public/apple-pay-domain` |
| Vercel rewrites | both paths (with/without trailing slash) → API route (HTTP 200) |

## Live check (hosting) — re-verified 2026-08-12

```bash
curl -sS -D- -o /tmp/ap.txt \
  https://www.supplieradvisor.com/.well-known/apple-developer-merchantid-domain-association | head -20

# Full ops diagnostic (includes cert expiry + optional ?register=1)
curl -sS 'https://www.supplieradvisor.com/api/system/apple-pay-domain-status' | jq .
```

Expected:

- `HTTP/2 200` (not 301/302/404)
- `content-type: application/text`
- Body matches `APPLE_PAY_DOMAIN_ASSOCIATION_BODY` exactly (no extra newline)

**Current file (Paystack hex, createdOn 2026-08-12):** 114-byte JSON
`{"version":1,"pspId":"4BE8…","createdOn":1786546082458}`. After deploy,
register both domains via `POST https://api.paystack.co/apple-pay/domain`.

### Do not

- Pretty-print or add a trailing newline
- Serve as `application/json` (Paystack requires **`application/text`**)
- Host only on apex or only on `www` if you charge on both hosts
