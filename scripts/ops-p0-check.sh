#!/usr/bin/env bash
# P0 ops-live check — tip SHA, Paystack, settle tables, OPS_ALERT.
# Usage:
#   APP_URL=https://www.supplieradvisor.com bash scripts/ops-p0-check.sh
# Optional:
#   EXPECT_COMMIT=$(git rev-parse --short HEAD)
#   CRON_SECRET=…  (ops-board deep check)
set -euo pipefail

APP_URL="${APP_URL:-https://www.supplieradvisor.com}"
APP_URL="${APP_URL%/}"
EXPECT_COMMIT="${EXPECT_COMMIT:-}"

echo "=== P0 ops-live check · $APP_URL ==="

HEALTH=$(curl -sS "$APP_URL/api/system/health" || true)
if [[ -z "$HEALTH" ]]; then
  echo "FAIL  health unreachable"
  exit 1
fi

python3 - <<'PY' "$HEALTH" "$EXPECT_COMMIT"
import json, sys
raw, expect = sys.argv[1], sys.argv[2]
d = json.loads(raw)
p0 = d.get("p0Readiness") or {}
deploy = d.get("deploy") or {}
commit = deploy.get("commitShort") or deploy.get("commit") or ""
print(f"deploy.commitShort = {commit or '—'}")
if expect:
    ok = commit.startswith(expect) or expect.startswith(str(commit)[:7])
    print(f"tip match EXPECT_COMMIT={expect}: {'OK' if ok else 'FAIL'}")
    if not ok:
        sys.exit(2)

print(f"ok={d.get('ok')} degraded={d.get('degraded')}")
print(f"p0Readiness.ok = {p0.get('ok')}")
blockers = p0.get("blockers") or []
warnings = p0.get("warnings") or []
for b in blockers:
    print(f"BLOCKER  {b}")
for w in warnings:
    print(f"WARN     {w}")
settle = p0.get("settleMissing") or d.get("settleMissing") or []
if settle:
    print("Settle missing tables:")
    for s in settle:
        print(f"  - {s}")
checks = d.get("checks") or {}
for k in ("paystack", "cron_secret", "ops_alert", "resend", "verifynow"):
    c = checks.get(k) or {}
    print(f"check.{k}.ok = {c.get('ok')}  {c.get('error') or ''}")

if blockers:
    sys.exit(1)
print("\nP0 blockers clear (warnings may remain).")
PY

echo
echo "=== settle-smoke ==="
SETTLE=$(curl -sS "$APP_URL/api/system/settle-smoke" || true)
if [[ -z "$SETTLE" ]]; then
  echo "FAIL  settle-smoke unreachable"
else
  python3 - <<'PY' "$SETTLE"
import json, sys
d = json.loads(sys.argv[1])
if d.get("code") == "UNAUTHORIZED" or d.get("error", "").startswith("Authentication"):
    print("FAIL  settle-smoke returns 401 — deploy tip that public-paths includes /api/system/settle-smoke")
    sys.exit(3)
print(f"settleLive = {d.get('settleLive')}  ok = {d.get('ok')}")
for b in d.get("blockers") or []:
    print(f"BLOCKER  {b}")
for w in d.get("warnings") or []:
    print(f"WARN     {w}")
checks = d.get("checks") or {}
bad = [k for k, v in checks.items() if isinstance(v, dict) and v.get("ok") is False]
if bad:
    print("failed checks:", ", ".join(bad[:12]))
if d.get("blockers"):
    sys.exit(1)
print("settle-smoke OK" if d.get("settleLive") or d.get("ok") else "settle-smoke soft issues")
PY
fi

if [[ -n "${CRON_SECRET:-}" ]]; then
  echo
  echo -n "ops-board readiness… "
  curl -sS -H "Authorization: Bearer $CRON_SECRET" \
    "$APP_URL/api/system/ops-board" | python3 -c "
import sys,json
d=json.load(sys.stdin)
b=d.get('board') or {}
r=b.get('readiness') or {}
print('ok=', r.get('ok'), 'blockers=', r.get('blockers'))
print('analytics=', b.get('analytics'))
print('settleLive=', b.get('settleLive'))
" 2>/dev/null || echo "(parse failed)"
else
  echo
  echo "HINT  Set CRON_SECRET to also probe /api/system/ops-board"
fi

echo
echo "=== remaining ops (not auto-fixable without your secrets) ==="
echo "1. Vercel env OPS_ALERT_EMAIL=you@company.com  (then redeploy)"
echo "2. Paystack webhook → $APP_URL/api/paystack/webhook  (charge.success)"
echo "3. Optional Twilio: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM"
echo "Done. UI: $APP_URL/dashboard/my-business/ops · docs/OPS_MIGRATIONS.md"
