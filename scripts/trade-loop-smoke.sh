#!/usr/bin/env bash
# Production / staging dry-run smoke (no secrets required for public checks).
# Optional: CRON_SECRET, E2E_ACCESS_TOKEN, E2E_COMPANY_ID
set -euo pipefail

APP_URL="${APP_URL:-https://www.supplieradvisor.com}"
APP_URL="${APP_URL%/}"

echo "=== Trade loop smoke against $APP_URL ==="

echo -n "Health… "
HEALTH=$(curl -sS "$APP_URL/api/system/health" || true)
echo "$HEALTH" | python3 -c "import sys,json; d=json.load(sys.stdin); print('ok=',d.get('ok'),'cron=',d.get('checks',{}).get('cron_secret',{}).get('ok'),'resend=',d.get('checks',{}).get('resend',{}).get('ok'))" 2>/dev/null || echo "$HEALTH" | head -c 200

echo -n "Founding slots… "
curl -sS "$APP_URL/api/public/founding-waitlist" | python3 -c "import sys,json; d=json.load(sys.stdin); print('limit',d.get('limit'),'remaining',d.get('remaining'),'full',d.get('full'))" 2>/dev/null || true

echo -n "SAM GET… "
curl -sS -o /tmp/sam.json -w "HTTP %{http_code}\n" "$APP_URL/api/sam/chat" || true

echo -n "Catalogue unauth… "
curl -sS -o /dev/null -w "HTTP %{http_code} (expect 401)\n" \
  "$APP_URL/api/suppliers/catalogue?companyId=1&supplierId=1" || true

if [[ -n "${CRON_SECRET:-}" ]]; then
  echo -n "Subscription cron… "
  curl -sS -H "Authorization: Bearer $CRON_SECRET" \
    "$APP_URL/api/business/subscription/cron" | head -c 200
  echo
  echo -n "Rating prompts cron… "
  curl -sS -H "Authorization: Bearer $CRON_SECRET" \
    "$APP_URL/api/business/rating-prompts/cron" | head -c 200
  echo
else
  echo "Skip crons (set CRON_SECRET to smoke)"
fi

if [[ -n "${E2E_ACCESS_TOKEN:-}" && -n "${E2E_COMPANY_ID:-}" ]]; then
  H="Authorization: Bearer $E2E_ACCESS_TOKEN"
  CID="$E2E_COMPANY_ID"
  echo -n "Subscription (auth)… "
  curl -sS -H "$H" "$APP_URL/api/business/subscription?companyId=$CID&autoTrial=0" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print('status',d.get('subscription',{}).get('status'),'founding',d.get('founding'))" 2>/dev/null || true
  echo -n "Inbound POs… "
  curl -sS -o /dev/null -w "HTTP %{http_code}\n" -H "$H" \
    "$APP_URL/api/customers/purchase-orders?companyId=$CID" || true
  echo -n "Outbound POs… "
  curl -sS -o /dev/null -w "HTTP %{http_code}\n" -H "$H" \
    "$APP_URL/api/suppliers/purchase-orders?companyId=$CID" || true
else
  echo "Skip authed APIs (set E2E_ACCESS_TOKEN + E2E_COMPANY_ID)"
fi

echo "=== Done. Full UI dry-run: docs/trade-loop-dry-run.md ==="
