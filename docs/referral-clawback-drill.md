# Referral refund clawback — staging drill

Prove that a **Paystack refund/reversal** claws back unpaid supply-chain referral earnings.

## Prerequisites

- Staging (or prod with care) company that paid subscription via Paystack
- L1 referrer earned fees on that payment (`supply_chain_referral_earnings` with `source_ref` = Paystack reference)
- Earnings still `pending` or `approved` (not yet `paid`)
- Ops auth: root company owner **or** `REFERRAL_OPS_SECRET` / `CRON_SECRET`

## Steps

### 1. Note the payment reference

From Billing last payment ref, or Paystack dashboard transaction reference:

```text
PAYSTACK_REF=sa-co-sub-...
```

### 2. Confirm earnings exist

```sql
SELECT id, earner_profile_id, level, commission_amount_zar, status, source_ref
FROM supply_chain_referral_earnings
WHERE source_ref = 'PAYSTACK_REF'
ORDER BY level;
```

Expect rows with status `pending` or `approved`.

### 3. Trigger clawback (API)

```bash
curl -X POST "$APP_URL/api/business/referrals" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $REFERRAL_OPS_SECRET" \
  -d '{
    "companyId": EARNE_R_OR_ANY,
    "action": "void",
    "sourceRef": "PAYSTACK_REF",
    "reason": "Staging refund drill"
  }'
```

Or subscription refund path if wired:

```bash
curl -X POST "$APP_URL/api/business/subscription" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "companyId": COMPANY_ID,
    "action": "clawback_referral",
    "paystackReference": "PAYSTACK_REF",
    "reason": "Paystack refund"
  }'
```

(Also exercise Paystack webhook `charge.refund` / reverse if configured.)

### 4. Verify

```sql
SELECT id, status, notes, commission_amount_zar
FROM supply_chain_referral_earnings
WHERE source_ref = 'PAYSTACK_REF';
```

Expect `void` (or clawed status) for unpaid rows. **Already paid** earnings should **not** auto-void — note ops exception process.

### 5. Pass criteria

| Check | Expected |
|-------|----------|
| Unpaid L1–L3 on that ref | Voided / clawed |
| Company cannot mark paid | Still ops-only |
| Audit log | `referral` clawback / void action |

## Notes

- Hold period exists so refunds during hold never auto-pay referrers.
- Self-referral and KYC rules still apply on new earnings.
- See `docs/referral-trust-runbook.md` for full workflow.
