# Alerts: Email + WhatsApp

## Channels

| Channel | Provider | Env |
|---------|----------|-----|
| Email | Resend | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` |
| WhatsApp | Twilio | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` |

Both are **soft-fail** — missing config never breaks the primary API.

## Events

| Event | Email | WhatsApp |
|-------|-------|----------|
| QA inspection open/failed | ✓ | ✓ |
| PO escrow funded | ✓ | ✓ |
| Accounting period lock/unlock | ✓ | ✓ |
| Ship blocked by QA hold | ✓ | ✓ |
| Regulatory / recall pack export | ✓ | ✓ |
| Bank sync failure | ✓ | ✓ |
| Buyer payment claim (seller) | ✓ | ✓ |
| Payment claim confirmed/rejected (buyer) | ✓ | ✓ |

## Recipients

- Profile `email` / `contact_email` / `phone` / `contact_phone` / `whatsapp`
- Active `business_users` with roles owner/admin/finance/ops
- Optional `TWILIO_WHATSAPP_TO_DEFAULT=whatsapp:+27…` for sandbox testing

## Twilio sandbox (fastest path to green health)

### 1. Twilio console (5 minutes)

1. Sign up / log in: https://console.twilio.com  
2. Copy **Account SID** and **Auth Token** from the home page  
3. Go to **Messaging → Try it out → Send a WhatsApp message** (Sandbox)  
4. Note the sandbox **From** number — almost always `whatsapp:+14155238886`  
5. On **your phone**, open WhatsApp and send the sandbox join code  
   (e.g. `join <word-word>`) to that number — required before any message arrives  

### 2. Set Vercel env (one command)

```bash
# From repo root (logged into vercel CLI as the project owner)
export TWILIO_ACCOUNT_SID=ACxxxxxxxx
export TWILIO_AUTH_TOKEN=your_auth_token
export TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
export TWILIO_WHATSAPP_TO_DEFAULT=whatsapp:+27XXXXXXXXX   # your phone

bash scripts/setup-twilio-env.sh
```

Or manually: Vercel → Project → Settings → Environment Variables → Production:

| Name | Example |
|------|---------|
| `TWILIO_ACCOUNT_SID` | `ACxxxxxxxx` |
| `TWILIO_AUTH_TOKEN` | secret |
| `TWILIO_WHATSAPP_FROM` | `whatsapp:+14155238886` |
| `TWILIO_WHATSAPP_TO_DEFAULT` | `whatsapp:+27…` (optional test target) |

Then **Redeploy** Production.

### 3. Smoke test

```bash
export CRON_SECRET=…   # same as Vercel Production

# Config check
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  https://www.supplieradvisor.com/api/system/twilio-smoke | jq .

# Send test WhatsApp to your phone
curl -sS -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H 'Content-Type: application/json' \
  -d '{"to":"whatsapp:+27XXXXXXXXX"}' \
  https://www.supplieradvisor.com/api/system/twilio-smoke | jq .
```

Health should show `checks.twilio_whatsapp.ok: true`:

```bash
curl -sS https://www.supplieradvisor.com/api/system/health | jq '.checks.twilio_whatsapp'
```

### Common failures

| Symptom | Fix |
|---------|-----|
| Health still `ok: false` | Vars only on Preview — set **Production**, redeploy |
| `sent: 0` / Twilio error 63007 | Phone has not joined sandbox — send join code |
| 401 on twilio-smoke | Wrong `CRON_SECRET` |
| Messages to other numbers fail | Sandbox only talks to joined numbers — apply for WhatsApp Business for production |

## Code

- `lib/notifications/email-alerts.ts`
- `lib/notifications/twilio-whatsapp.ts`
- `app/api/system/twilio-smoke/route.ts`
- `scripts/setup-twilio-env.sh`
