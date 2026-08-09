# Apple Pay / Paystack domain verification

Hosted at:

  /.well-known/apple-developer-merchantid-domain-association

**Live source of truth:** `lib/billing/apple-pay-domain-association.ts`, served by
`app/.well-known/apple-developer-merchantid-domain-association/route.ts`.

A static copy also lives in this folder for fallback / inspection.

Optional override: set env `APPLE_PAY_DOMAIN_ASSOCIATION` (or
`PAYSTACK_APPLE_PAY_DOMAIN_FILE`) to replace the body without a deploy.

After deploy, verify the domain in **Paystack Dashboard → Settings → Apple Pay**.
Domain must be HTTPS (`www.supplieradvisor.com`).
