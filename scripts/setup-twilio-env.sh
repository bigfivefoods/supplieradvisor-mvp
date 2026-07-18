#!/usr/bin/env bash
# Add Twilio WhatsApp env to Vercel Production (and optional Preview).
# Usage:
#   bash scripts/setup-twilio-env.sh
# Or non-interactive:
#   TWILIO_ACCOUNT_SID=ACxx TWILIO_AUTH_TOKEN=xx TWILIO_WHATSAPP_FROM=whatsapp:+14155238886 \
#   TWILIO_WHATSAPP_TO_DEFAULT=whatsapp:+27… bash scripts/setup-twilio-env.sh
set -euo pipefail

echo "=== Twilio WhatsApp → Vercel Production ==="
echo "Get values from https://console.twilio.com"
echo "  Account SID + Auth Token: console home"
echo "  WhatsApp sandbox From: Messaging → Try it out → WhatsApp → Sandbox"
echo "  Default From for sandbox is always: whatsapp:+14155238886"
echo

if ! command -v vercel >/dev/null 2>&1; then
  echo "Install Vercel CLI: npm i -g vercel"
  exit 1
fi

read_var() {
  local name="$1" default="${2:-}"
  local val="${!name:-}"
  if [[ -n "$val" ]]; then
    echo "$val"
    return
  fi
  if [[ -n "$default" ]]; then
    read -r -p "$name [$default]: " val
    echo "${val:-$default}"
  else
    read -r -p "$name: " val
    echo "$val"
  fi
}

SID=$(read_var TWILIO_ACCOUNT_SID)
TOKEN=$(read_var TWILIO_AUTH_TOKEN)
FROM=$(read_var TWILIO_WHATSAPP_FROM "whatsapp:+14155238886")
TO_DEFAULT="${TWILIO_WHATSAPP_TO_DEFAULT:-}"
if [[ -z "$TO_DEFAULT" ]]; then
  read -r -p "TWILIO_WHATSAPP_TO_DEFAULT (your phone whatsapp:+27…, optional): " TO_DEFAULT || true
fi

if [[ -z "$SID" || -z "$TOKEN" || -z "$FROM" ]]; then
  echo "Need SID, TOKEN, and FROM"
  exit 1
fi

# Normalize from
if [[ "$FROM" != whatsapp:* ]]; then
  FROM="whatsapp:${FROM#+}"
  FROM="whatsapp:+${FROM#whatsapp:}"
  FROM=$(echo "$FROM" | sed 's/whatsapp:whatsapp:/whatsapp:/')
fi

echo
echo "Writing Production env (and Preview)…"

# Remove old keys if present so we can re-add cleanly (ignore errors)
for key in TWILIO_ACCOUNT_SID TWILIO_AUTH_TOKEN TWILIO_WHATSAPP_FROM TWILIO_WHATSAPP_TO_DEFAULT; do
  vercel env rm "$key" production --yes 2>/dev/null || true
  vercel env rm "$key" preview --yes 2>/dev/null || true
done

printf '%s' "$SID" | vercel env add TWILIO_ACCOUNT_SID production
printf '%s' "$SID" | vercel env add TWILIO_ACCOUNT_SID preview
printf '%s' "$TOKEN" | vercel env add TWILIO_AUTH_TOKEN production
printf '%s' "$TOKEN" | vercel env add TWILIO_AUTH_TOKEN preview
printf '%s' "$FROM" | vercel env add TWILIO_WHATSAPP_FROM production
printf '%s' "$FROM" | vercel env add TWILIO_WHATSAPP_FROM preview

if [[ -n "${TO_DEFAULT:-}" ]]; then
  if [[ "$TO_DEFAULT" != whatsapp:* ]]; then
    TO_DEFAULT="whatsapp:+${TO_DEFAULT#whatsapp:}"
    TO_DEFAULT="${TO_DEFAULT/whatsapp:+whatsapp:/whatsapp:}"
  fi
  printf '%s' "$TO_DEFAULT" | vercel env add TWILIO_WHATSAPP_TO_DEFAULT production
  printf '%s' "$TO_DEFAULT" | vercel env add TWILIO_WHATSAPP_TO_DEFAULT preview
fi

echo
echo "Redeploying production…"
vercel --prod --yes

echo
echo "After deploy, test:"
echo "  export CRON_SECRET=\$(grep CRON_SECRET .env.local 2>/dev/null | cut -d= -f2-)"
echo "  curl -sS -H \"Authorization: Bearer \$CRON_SECRET\" \\"
echo "    https://www.supplieradvisor.com/api/system/twilio-smoke | jq ."
echo "  curl -sS -X POST -H \"Authorization: Bearer \$CRON_SECRET\" -H 'Content-Type: application/json' \\"
echo "    -d '{\"to\":\"$TO_DEFAULT\"}' \\"
echo "    https://www.supplieradvisor.com/api/system/twilio-smoke | jq ."
echo
echo "Sandbox: on your phone WhatsApp, send the join code to the Twilio sandbox number first."
echo "Done."
