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

## Recipients

- Profile `email` / `contact_email` / `phone` / `contact_phone` / `whatsapp`
- Active `business_users` with roles owner/admin/finance/ops
- Optional `TWILIO_WHATSAPP_TO_DEFAULT=whatsapp:+27…` for sandbox testing

## Twilio sandbox

1. Create Twilio account → Messaging → Try WhatsApp
2. From: `whatsapp:+14155238886` (sandbox)
3. Join sandbox from your phone
4. Set env on Vercel and redeploy

```bash
TWILIO_ACCOUNT_SID=AC…
TWILIO_AUTH_TOKEN=…
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
TWILIO_WHATSAPP_TO_DEFAULT=whatsapp:+27XXXXXXXXX
```

## Code

- `lib/notifications/email-alerts.ts`
- `lib/notifications/twilio-whatsapp.ts`
