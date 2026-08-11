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

## Test before clicking Verify

```bash
curl -sS -D- -o /tmp/ap.txt \
  https://www.supplieradvisor.com/.well-known/apple-developer-merchantid-domain-association | head -20
# Expect: HTTP/2 200, content-type: application/text, body starts with {"pspId":
```

Register **both** `www.supplieradvisor.com` and `supplieradvisor.com` if you take payments on either host.
