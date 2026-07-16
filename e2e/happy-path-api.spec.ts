import { test, expect } from '@playwright/test';

/**
 * Happy-path API smoke (unauthenticated → 401 on protected company routes).
 * Full browser login e2e requires PRIVY test credentials in CI later.
 */
const base =
  process.env.PLAYWRIGHT_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'http://localhost:3000';

const protectedGets = [
  '/api/inventory/stock?companyId=1',
  '/api/inventory/lots?companyId=1',
  '/api/manufacturing/summary?companyId=1',
  '/api/distribution/summary?companyId=1',
  '/api/accounting/summary?companyId=1',
  '/api/accounting/period-locks?companyId=1',
  '/api/quality/inspections?companyId=1',
  '/api/quality/holds?companyId=1&lots=DEMO',
  '/api/quality/traceability-graph?companyId=1',
  '/api/quality/regulatory-pack?companyId=1',
  '/api/containers/summary?companyId=1',
  '/api/projects?companyId=1',
  '/api/intelligence/forecasts?companyId=1',
  '/api/notifications?companyId=1',
  '/api/suppliers/discover?companyId=1',
  '/api/suppliers/otifef?companyId=1',
];

test.describe('Happy-path protected APIs', () => {
  for (const path of protectedGets) {
    test(`401 without token: ${path.split('?')[0]}`, async ({ request }) => {
      const res = await request.get(`${base}${path}`);
      expect(res.status(), path).toBe(401);
    });
  }

  test('spoofed body on journal create → 401', async ({ request }) => {
    const res = await request.post(`${base}/api/accounting/journals`, {
      data: {
        companyId: 1,
        privyUserId: 'did:privy:attacker',
        status: 'posted',
        lines: [
          { account_id: 1, debit: 100, credit: 0 },
          { account_id: 2, debit: 0, credit: 100 },
        ],
      },
    });
    expect(res.status()).toBe(401);
  });

  test('period lock without token → 401', async ({ request }) => {
    const res = await request.post(`${base}/api/accounting/period-locks`, {
      data: { companyId: 1, period_key: '2026-01', locked: true },
    });
    expect(res.status()).toBe(401);
  });
});
