# Apple Pay / Paystack domain verification

Host the Paystack Apple Pay domain association file as:

  /.well-known/apple-developer-merchantid-domain-association

Preferred: set env `APPLE_PAY_DOMAIN_ASSOCIATION` to the file contents
(served by `app/.well-known/apple-developer-merchantid-domain-association/route.ts`).

Or place the downloaded file here as:
  public/.well-known/apple-developer-merchantid-domain-association

Then verify the domain in Paystack Dashboard → Settings → Apple Pay.
