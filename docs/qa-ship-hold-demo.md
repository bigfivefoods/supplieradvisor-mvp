# QA ship-hold demo (5 minutes)

Prove that **open/failed inspections block stock ship** until disposition.

## Prerequisites

- Company selected with Inventory + Quality access
- Migration `20260711_quality_inspections.sql` applied
- At least one product + warehouse with stock (or receive first)

## Steps

### 1. Receive with a lot

1. **Inventory → Scan** (or stock receive)
2. Receive product with a clear `lot_number`, e.g. `DEMO-LOT-001`

### 2. Open a QA hold

1. **Quality → Inspections → New inspection**
2. Set **lot number** = `DEMO-LOT-001`
3. Status = **open** or **failed**
4. Save

You should see the amber **Ship block demo** callout on the inspections page.

### 3. Build a transfer that uses that lot

1. **Inventory → Stock transfers**
2. Create a draft transfer from source → destination
3. Add a line with the **same lot number**
4. Save draft

### 4. Ship → expect block

1. Expand the draft → **Ship transfer**
2. Confirm ship

**Expected:**

- HTTP **409**
- Toast: QA hold message
- Action button: **Open inspections**
- JSON shape (API):

```json
{
  "error": "QA hold: lot(s) DEMO-LOT-001 have open or failed inspections...",
  "code": "QA_HOLD",
  "lots": ["DEMO-LOT-001"],
  "holds": [
    {
      "lot_number": "DEMO-LOT-001",
      "inspection_id": 123,
      "status": "open"
    }
  ],
  "resolve_href": "/dashboard/quality/inspections"
}
```

### 5. Clear and re-ship

1. Open inspections → mark inspection **passed** (or disposition that removes open/failed)
2. Ship again → **200**, stock leaves source

### Optional: override

Owners/admins can check **Override QA hold** on the ship panel. Override is **audited** (`override.qa_hold`). Prefer clear holds for demos.

## API reference

| Call | Notes |
|------|--------|
| `POST /api/quality/inspections` | Create open/failed on lot |
| `POST /api/inventory/transfers` `{ action: "ship", id }` | Returns 409 + `QA_HOLD` when held |
| Hold helper | `lib/quality/holds.ts` → `qaHoldErrorPayload` |

## Reseller draw stock

Same gate applies when drawing stock to a verified reseller if lines include
`lot_number` (`POST /api/containers/resellers/transfer`). Expect **409 `QA_HOLD`**
until inspections are cleared (owner/admin override optional).

## Pre-ship check API

```
GET /api/quality/holds?companyId=123&lots=DEMO-LOT-001,LOT-2
→ { blocked, holds, lots, resolve_href, code }
```

Stock Transfers UI calls this when you expand a draft with lot lines and shows an amber warning before ship.

## Related

- Guide curriculum: Quality → “Release path”
- Ops checklist §5: “Ship transfer with held lot”
- Marketing: compliance as a control (homepage / LandingConversion)

