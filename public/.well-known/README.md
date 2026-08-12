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

## If Paystack says "Could not verify domain / Domain could not be registered on Apple Pay"

1. **Hosting is fine** when curl returns HTTP 200 + `application/text` + body starts with `{"pspId":`.
2. **Check the signature cert inside the file** (Paystack platform cert, same for all merchants):

   ```bash
   # extract signature hex → DER → cert validity
   python3 -c "import json; print(json.load(open('public/.well-known/apple-developer-merchantid-domain-association'))['createdOn'])"
   ```

   Decode the signing cert dates from `signature` (UTCTime in the PKCS#7). The
   broker cert in Paystack’s association payload has historically used
   **notAfter 2024-05-16** (`ecc-smp-broker-sign_UC4-PROD`). After that date Apple
   can reject domain registration even when the URL is perfect.

3. **Action:** If verify still fails after a successful curl, contact **Paystack
   Support** for a **renewed** association file (non-expired broker cert). When
   they send hex or JSON, replace:

   - `lib/billing/apple-pay-domain-association.ts`
   - `public/.well-known/apple-developer-merchantid-domain-association`

   Then redeploy, re-test curl, then **Verify Domain** again in Paystack
   (register **both** apex and `www` if either host takes payments).
