# Apple Pay / Paystack domain verification

Per [Paystack Apple Pay docs](https://paystack.com/docs/payments/apple-pay/):

1. Enable Apple Pay under Dashboard → Preferences
2. Register domain under Settings → Apple Pay → Web Domains
3. Host verification file at:

   `/.well-known/apple-developer-merchantid-domain-association`

4. Click **Verify Domain** in the dashboard

**Content-Type must be `application/text`** (not `text/plain`).

**Live source of truth:** `lib/billing/apple-pay-domain-association.ts`, served by
`app/.well-known/apple-developer-merchantid-domain-association/route.ts`.

Static copy also in this folder. Optional env override:
`APPLE_PAY_DOMAIN_ASSOCIATION` or `PAYSTACK_APPLE_PAY_DOMAIN_FILE`.

Domains (both serve the same verification file over HTTPS):

- `https://supplieradvisor.com/.well-known/apple-developer-merchantid-domain-association`
- `https://www.supplieradvisor.com/.well-known/apple-developer-merchantid-domain-association`

In Paystack: Settings → Apple Pay → add each domain → **Verify Domain**.
Do not put the file under a different path; Apple/Paystack only check
`/.well-known/apple-developer-merchantid-domain-association`.
