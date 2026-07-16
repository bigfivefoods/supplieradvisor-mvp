# Authenticated E2E (Playwright)

## Unauthenticated (always)

```bash
npm run test:e2e:auth
npx playwright test e2e/happy-path-api.spec.ts
```

Expect **401** on protected company APIs without a token.

## With Privy access token

1. Log into https://www.supplieradvisor.com in Chrome.
2. DevTools → Application / Network → capture Privy access token  
   (or run in console after login if you expose it):

   ```js
   // From app context after usePrivy().getAccessToken()
   ```

3. Export:

```bash
export E2E_ACCESS_TOKEN="eyJ..."
export E2E_COMPANY_ID="123"
export PLAYWRIGHT_BASE_URL="https://www.supplieradvisor.com"
npm run test:e2e:session
```

Tests assert valid Bearer → not 401 (200/403/500 ok depending on membership).

### Trust loop + QA hold

```bash
export E2E_ACCESS_TOKEN="eyJ..."
export E2E_COMPANY_ID="123"
# Optional for full PO → rating_prompts chain:
export E2E_SUPPLIER_PROFILE_ID="456"   # other on-platform company
# Optional for ship-block 409 assertion:
export E2E_TRANSFER_ID="789"          # draft transfer with held lot

npx playwright test e2e/po-rating-prompt.spec.ts e2e/qa-ship-hold.spec.ts
```

- `po-rating-prompt` always exercises `POST/GET rating-prompts`; completes a PO when supplier id is set.
- `qa-ship-hold` creates an open inspection; with `E2E_TRANSFER_ID` asserts `code: QA_HOLD`.

### Fixture pack (recommended for hard assertions)

| Variable | How to obtain |
|----------|----------------|
| `E2E_ACCESS_TOKEN` | Logged-in session → Privy access JWT |
| `E2E_COMPANY_ID` | Buyer company id (member of token user) |
| `E2E_SUPPLIER_PROFILE_ID` | Another on-platform company (accepted connection ideal) |
| `E2E_TRANSFER_ID` | Create draft transfer with lot; create open QA inspection on that lot; use transfer id |

**One-time setup script (manual UI or API):**

1. Company A (buyer) + Company B (supplier) connected.
2. Receive stock with lot `E2E-QA-DEMO`.
3. Quality → inspection **open** on `E2E-QA-DEMO`.
4. Inventory → draft transfer lines with that lot → note transfer id.
5. Run session tests with all four env vars set.

```bash
export E2E_ACCESS_TOKEN=... E2E_COMPANY_ID=... \
  E2E_SUPPLIER_PROFILE_ID=... E2E_TRANSFER_ID=...
npm run test:e2e:trust
```

### CI secrets (recommended)

| Secret | Purpose |
|--------|---------|
| `E2E_ACCESS_TOKEN` | Short-lived Privy JWT from a test user |
| `E2E_COMPANY_ID` | Stable test company |
| `E2E_SUPPLIER_PROFILE_ID` | Peer company for PO rating chain |
| `E2E_TRANSFER_ID` | Optional; recreate each night if transfers complete |

Store as GitHub Actions secrets; rotate tokens weekly. Without supplier/transfer, tests soft-skip rather than fail.

## Full UI login (storageState)

Privy email OTP is hard to automate. Prefer a one-time browser seed:

```bash
npx playwright codegen --save-storage=e2e/.auth.json \
  https://www.supplieradvisor.com/login
# Complete login, wait for dashboard, close the browser.

export PLAYWRIGHT_BASE_URL=https://www.supplieradvisor.com
npm run test:e2e:storage
```

`e2e/.auth.json` is gitignored. For CI, store it as a secret file artifact and set `E2E_STORAGE_STATE`.

Optional: `E2E_USE_STORAGE=1` attaches storageState to **all** Playwright tests via `playwright.config.ts`.
