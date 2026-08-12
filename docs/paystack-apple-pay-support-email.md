# Paystack support email — Apple Pay domain registration

Copy everything below the line into your email or Paystack support ticket.

---

**To:** support@paystack.com (or your Paystack account manager)

**Subject:** Apple Pay domain registration fails — association cert expired (www.supplieradvisor.com)

---

Hi Paystack Support,

We need help completing **Apple Pay domain registration** for our live merchant account.

### Domains to register

- `www.supplieradvisor.com`
- `supplieradvisor.com`

### Error from your dashboard

> Domain could not be registered on Apple Pay. Please verify that the correct file is hosted at  
> https://www.supplieradvisor.com/.well-known/apple-developer-merchantid-domain-association

### Hosting verification (our side looks correct)

The association file is publicly available and returns:

| Check | Result |
|--------|--------|
| URL | https://www.supplieradvisor.com/.well-known/apple-developer-merchantid-domain-association |
| HTTP status | **200** (no redirect) |
| Content-Type | **application/text** |
| Body | Starts with `{"pspId":"4BE8DFE7…"}` |
| Apex host | Same behaviour on https://supplieradvisor.com/.well-known/… |

Quick check you can run:

```bash
curl -sS -D- -o /tmp/ap.txt \
  https://www.supplieradvisor.com/.well-known/apple-developer-merchantid-domain-association | head -20
```

We also host the same path for the apex domain.

### Root cause we identified

The association file’s PKCS#7 `signature` embeds Apple broker certificate:

- **CN:** `ecc-smp-broker-sign_UC4-PROD`
- **notBefore:** 18 May 2019 GMT
- **notAfter:** **16 May 2024 GMT (expired)**

Apple validates this certificate during domain registration. With an expired broker cert, registration fails even when the URL, content-type, and JSON body are correct.

This certificate is part of the **Paystack platform association payload** (not a file we generate ourselves). We have already:

1. Enabled Apple Pay under Preferences and accepted the terms  
2. Hosted the verification file exactly as documented  
3. Confirmed HTTPS and `application/text` responses on production (Vercel)

### What we need from you

1. A **renewed Apple Pay domain association file** (new `signature` with a **non-expired** signing certificate), **or**  
2. Your team to **re-register / re-verify** these domains on Apple Pay on your side once a valid file is issued.

Please also confirm whether we should register both `www.supplieradvisor.com` and `supplieradvisor.com` separately for our live public key.

### Our integration (for context)

- Paystack **InlineJS v2** (`https://js.paystack.co/v2/inline.js`)
- Checkout with `apple_pay` in channels
- Live environment (`pk_live` / production site)

Happy to jump on a call or provide screenshots of the dashboard error and curl output if useful.

Thank you,  
[Your name]  
[Your role / company]  
[Merchant email on the Paystack account]  
[Paystack business / account name if different]  
[Phone]

---

## Short version (optional)

**Subject:** Apple Pay domain verify fails — expired association cert

Hi — Apple Pay domain verify fails for www.supplieradvisor.com with “Domain could not be registered on Apple Pay” even though  
https://www.supplieradvisor.com/.well-known/apple-developer-merchantid-domain-association  
returns HTTP 200, Content-Type application/text, and a valid `{"pspId":…}` body.

The file’s signature embeds cert `ecc-smp-broker-sign_UC4-PROD` with **notAfter 2024-05-16 (expired)**. Please reissue a renewed domain association file and/or re-register the domain for our live account (also supplieradvisor.com). Thanks.

[Your name]
