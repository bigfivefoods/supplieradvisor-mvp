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

## Full UI login

Privy email OTP is hard to automate. Options for later CI:

- Privy test accounts / headless OTP intercept
- Storage-state seed: save `storageState` after manual login once

```bash
# After manual login session saved:
npx playwright codegen --save-storage=e2e/.auth.json
```
