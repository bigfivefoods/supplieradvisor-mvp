# Platform major requirements (ops + product)

Seven requirements for a production-ready SupplierAdvisor trade OS.

## 1. Production parity

- [ ] `main` tip matches Vercel Production deploy (`/api/system/health` → `deploy.commitShort`)
- [ ] One production deploy at a time (cancel stale builds)
- [ ] After env changes: **one** redeploy

```bash
curl -sS "https://www.supplieradvisor.com/api/system/health" | jq '{ok,degraded,deploy,paystack:.checks.paystack,twilio:.checks.twilio_whatsapp}'
curl -sS "https://www.supplieradvisor.com/api/system/trade-loop-smoke" | jq '{ok,criticalFail,hint}'
```

## 2. Money & verification (Paystack)

| Env | Required |
|-----|----------|
| `PAYSTACK_SECRET_KEY` | **Yes** (server) |
| `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | Yes (browser checkout) |

| Webhook | Events |
|---------|--------|
| `https://www.supplieradvisor.com/api/paystack/webhook` | `charge.success` |

- Health: `checks.paystack.ok` must be **true**
- Ops: paid≠badge → `/dashboard/my-business/verifications` queue
- Migrations: see `docs/OPS_MIGRATIONS.md` (`verification_payment_ref`, etc.)

## 3. Document delivery (WhatsApp PDF)

| Env | Purpose |
|-----|---------|
| `TWILIO_ACCOUNT_SID` | WhatsApp API |
| `TWILIO_AUTH_TOKEN` | Auth |
| `TWILIO_WHATSAPP_FROM` | e.g. `whatsapp:+1…` |

- With Twilio: PDF attaches as **document** in chat + SupplierAdvisor link in body
- Without: mobile share sheet or PDF document URL + supplieradvisor.com
- UI: invoice **WhatsApp PDF** shows delivery mode (sent file / shared file / link)

## 4. Trade loop reliability

Path: **discover → connect → PO → invoice (`source_po_id`) → pay → rate**

```bash
curl -sS "$APP_URL/api/system/trade-loop-smoke" | jq .
```

- Seller: Customers → Inbound PO → Create invoice from PO
- Buyer: POs → receive OTIFEF → rate
- Dashboard next-action + rating prompts after pay/delivery

## 5. Collections / AR

- Invoices: **Mark paid** supports **partial** amounts (status `partial` until full)
- **AR aging**: `/dashboard/customers/ar` (current / 1–30 / 31–60 / 61–90 / 90+)
- Overdue: email + WhatsApp resend from invoices list

## 6. Network quality (verify + rate)

- Profile CIPC self-serve mismatch fix
- Rating prompts: dashboard banner + post-invoice-paid / post-OTIFEF
- Ops queue for stuck verification

## 7. SEO growth

- Public `/directory`, industry / city / country hubs, `/c/{slug}-{id}`
- Profile **Search visibility** checklist (city, logo, blurb)
- Google Search Console: submit `https://www.supplieradvisor.com/sitemap.xml`

## Deploy checklist (single ship)

1. Fix env secrets in Vercel Production  
2. Cancel any stale production builds  
3. Deploy tip once  
4. Re-check health + trade-loop-smoke  
5. Spot-check: directory, fromPo invoice, WhatsApp PDF, AR aging  
