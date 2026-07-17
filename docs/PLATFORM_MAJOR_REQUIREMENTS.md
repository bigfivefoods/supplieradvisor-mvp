# Platform major requirements (ops + product)

Seven requirements for a production-ready SupplierAdvisor trade OS.

## 1. Production parity

- [x] Code: deploy identity on `/api/system/health` (`deploy.commitShort`)
- [x] Ops habit: one production deploy at a time (cancel stale builds)
- [ ] **Live check:** tip SHA == `deploy.commitShort` after each ship
- [ ] After env changes: **one** redeploy

```bash
curl -sS "https://www.supplieradvisor.com/api/system/health" | jq '{ok,degraded,deploy,paystack:.checks.paystack,twilio:.checks.twilio_whatsapp}'
curl -sS "https://www.supplieradvisor.com/api/system/trade-loop-smoke" | jq '{ok,criticalFail,hint}'
```

## 2. Money & verification (Paystack)

| Env | Required | Status |
|-----|----------|--------|
| `PAYSTACK_SECRET_KEY` | **Yes** (server) | **Ops: set in Vercel Production** |
| `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | Yes (browser checkout) | Usually already set |

| Webhook | Events |
|---------|--------|
| `https://www.supplieradvisor.com/api/paystack/webhook` | `charge.success` |

- [x] Code: health paystack check + webhook path + paid≠badge queue
- [ ] **Ops:** secret key + webhook → `checks.paystack.ok === true`
- Ops: paid≠badge → `/dashboard/my-business/verifications` queue
- Migrations: see `docs/OPS_MIGRATIONS.md` (`verification_payment_ref`, etc.)

## 3. Document delivery (WhatsApp PDF)

| Env | Purpose | Status |
|-----|---------|--------|
| `TWILIO_ACCOUNT_SID` | WhatsApp API | **Ops optional** |
| `TWILIO_AUTH_TOKEN` | Auth | **Ops optional** |
| `TWILIO_WHATSAPP_FROM` | e.g. `whatsapp:+1…` | **Ops optional** |

- [x] Code: Twilio document attach + mobile share / PDF URL fallback + delivery-mode UI
- [ ] **Ops (optional):** full Twilio → automatic PDF file in chat
- Without Twilio: mobile share sheet or PDF document URL + supplieradvisor.com

## 4. Trade loop reliability

Path: **discover → connect → PO → invoice (`source_po_id`) → pay → rate**

```bash
curl -sS "$APP_URL/api/system/trade-loop-smoke" | jq .
```

- [x] Code: public smoke endpoint (schema + env), fromPo invoice, next-action, rating prompts
- Seller: Customers → Inbound PO → Create invoice from PO
- Buyer: POs → receive OTIFEF → rate

## 5. Collections / AR

- [x] Invoices: **Mark paid** supports **partial** amounts (status `partial` until full)
- [x] **AR aging**: `/dashboard/customers/ar` (current / 1–30 / 31–60 / 61–90 / 90+)
- [x] Overdue: email + WhatsApp resend from invoices list

## 6. Network quality (verify + rate)

- [x] Profile CIPC self-serve mismatch fix
- [x] Rating prompts: customers hub + dashboard banner + post-invoice-paid / post-OTIFEF
- [x] Ops queue for stuck verification (`/dashboard/my-business/verifications`)

## 7. SEO growth

- [x] Public `/directory`, industry / city / country hubs, `/c/{slug}-{id}`
- [x] Profile **Search visibility** checklist (city, logo, blurb)
- [x] Directory convert CTAs (list company / sign in)
- [ ] **Ops:** Google Search Console → submit `https://www.supplieradvisor.com/sitemap.xml`

## Deploy checklist (single ship)

1. Fix env secrets in Vercel Production  
2. Cancel any stale production builds  
3. Deploy tip once  
4. Re-check health + trade-loop-smoke  
5. Spot-check: directory, fromPo invoice, WhatsApp PDF, AR aging  
