#!/usr/bin/env bash
# Ops live week — one command after deploy.
# Usage:
#   APP_URL=https://www.supplieradvisor.com bash scripts/ops-live-week.sh
# Optional: CRON_SECRET=… EXPECT_COMMIT=$(git rev-parse --short HEAD)
set -euo pipefail

APP_URL="${APP_URL:-https://www.supplieradvisor.com}"
APP_URL="${APP_URL%/}"
EXPECT_COMMIT="${EXPECT_COMMIT:-}"

echo "=== Ops live week · $APP_URL ==="

echo
echo "1) Health + P0"
HEALTH=$(curl -sS "$APP_URL/api/system/health")
echo "$HEALTH" | python3 -c "
import json,sys
d=json.load(sys.stdin)
p0=d.get('p0Readiness') or {}
dep=d.get('deploy') or {}
print('deploy', dep.get('commitShort') or dep.get('commit'))
print('p0.ok', p0.get('ok'), 'cronOk', p0.get('cronOk'), 'settleTablesOk', p0.get('settleTablesOk'))
for b in p0.get('blockers') or []: print('BLOCKER', b)
for w in p0.get('warnings') or []: print('WARN', w)
expect='${EXPECT_COMMIT}'
c=str(dep.get('commitShort') or '')
if expect and c and not (c.startswith(expect) or expect.startswith(c[:7])):
    print('TIP_MISMATCH expected', expect, 'got', c)
    sys.exit(2)
"

echo
echo "2) Settle smoke"
curl -sS "$APP_URL/api/system/settle-smoke" | python3 -c "
import json,sys
d=json.load(sys.stdin)
if d.get('code')=='UNAUTHORIZED':
    print('FAIL settle-smoke 401 — deploy public-paths fix')
    sys.exit(3)
print('settleLive', d.get('settleLive'), 'ok', d.get('ok'))
for b in d.get('blockers') or []: print('BLOCKER', b)
"

echo
echo "3) Paystack webhook public + pulse seed"
curl -sS "$APP_URL/api/paystack/webhook" | python3 -c "
import json,sys
d=json.load(sys.stdin)
print('webhook GET ok', d.get('ok'), 'public', d.get('public'))
"
curl -sS "$APP_URL/api/paystack/webhook?ping=1" | python3 -c "
import json,sys
d=json.load(sys.stdin)
p=d.get('pulse') or {}
print('pulse status', p.get('status'), 'lastAt', p.get('lastAt'), 'stale', p.get('stale'))
"

if [[ -n "${CRON_SECRET:-}" ]]; then
  echo
  echo "4) Ops board + crons (CRON_SECRET)"
  curl -sS -H "Authorization: Bearer $CRON_SECRET" -H "x-cron-secret: $CRON_SECRET" \
    "$APP_URL/api/system/ops-board" | python3 -c "
import json,sys
d=json.load(sys.stdin)
b=d.get('board') or d
r=(b.get('readiness') or {})
print('ops readiness ok', r.get('ok'))
print('settleLive', b.get('settleLive'))
print('schema', b.get('schema'))
" 2>/dev/null || echo "ops-board parse soft-fail"

  for path in \
    /api/system/paystack-pulse-cron \
    /api/system/activation-digest-cron
  do
    code=$(curl -sS -o /tmp/cron-out.json -w "%{http_code}" \
      -H "Authorization: Bearer $CRON_SECRET" -H "x-cron-secret: $CRON_SECRET" \
      "$APP_URL$path" || echo err)
    echo "cron $path → HTTP $code"
  done
else
  echo
  echo "4) Skip ops-board/crons (set CRON_SECRET to exercise)"
fi

echo
echo "5) Surfaces"
for path in /dashboard/customers/money /dashboard/settle /dashboard/escrow /dashboard/buyer/money /marketplace; do
  code=$(curl -sS -o /dev/null -w "%{http_code}" "$APP_URL$path" || echo err)
  echo "  $path → $code"
done

echo
echo "Done. Manual: first-trade → buyer POP claim → seller confirm on Money hub."
echo "Docs: docs/NEXT_DEPLOY_CHECKLIST.md · docs/PAYSTACK_WEBHOOK.md"
