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

## Live check (hosting) — as of last verify

```bash
curl -sS -D- -o /tmp/ap.txt \
  https://www.supplieradvisor.com/.well-known/apple-developer-merchantid-domain-association | head -20
```

Expected:

- `HTTP/2 200` (not 301/302/404)
- `content-type: application/text`
- Body starts with `{"pspId":`
- Body length **4559** (current clean PKCS#7 payload)

**Our hosting matches this.** The failure is not a missing file.

## Why Paystack still says “Domain could not be registered on Apple Pay”

Apple does not only fetch the URL — it validates the **cryptographic signature**
inside the JSON (`signature` field = PKCS#7 / CMS).

The payload Paystack distributes embeds Apple broker cert:

```
CN = ecc-smp-broker-sign_UC4-PROD
notBefore = May 18 2019 GMT
notAfter  = May 16 2024 GMT   ← EXPIRED
```

After that date Apple rejects domain registration even when the URL is perfect.
A hand-edited / re-typed hex blob can also corrupt the signature (odd-length hex,
broken OCSP URI) and make things worse — only install the exact file Paystack
gives you.

### What you must ask Paystack Support

Send them something like:

> Our domain association file is publicly available:
>
> `https://www.supplieradvisor.com/.well-known/apple-developer-merchantid-domain-association`
>
> curl: HTTP 200, Content-Type: application/text, body starts with `{"pspId":...}`.
>
> Apple still returns: “Domain could not be registered on Apple Pay.”
>
> The signature embeds `ecc-smp-broker-sign_UC4-PROD` with **notAfter 2024-05-16**
> (expired). Please provide a **renewed** Apple Pay domain association file /
> re-enable domain registration for `www.supplieradvisor.com` and
> `supplieradvisor.com` with a non-expired broker certificate.

When they send a new download (file, hex, or JSON), replace:

1. `lib/billing/apple-pay-domain-association.ts`
2. `public/.well-known/apple-developer-merchantid-domain-association`

Redeploy → re-curl → **Verify Domain** again in Paystack (register **both** apex
and `www` if either host takes payments).

### Do not

- Pretty-print / re-encode the JSON (breaks the signature)
- Add a trailing newline unless the download has one
- Serve as `application/json` (Paystack requires **`application/text`**)
- Host only on apex or only on `www` if you charge on both hosts
