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
