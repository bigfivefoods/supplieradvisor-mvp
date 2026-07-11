import { test, expect } from '@playwright/test';

/**
 * Tier-1 auth smoke tests (no real Privy login required).
 * Asserts unauthenticated API access is rejected for protected routes.
 */
const base = process.env.PLAYWRIGHT_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

test.describe('Tier-1 API auth', () => {
  test('public health is open', async ({ request }) => {
    const res = await request.get(`${base}/api/system/health`);
    // health may 200 even if deps partial
    expect([200, 503]).toContain(res.status());
  });

  test('inventory stock without token → 401', async ({ request }) => {
    const res = await request.get(`${base}/api/inventory/stock?companyId=1`);
    expect(res.status()).toBe(401);
    const json = await res.json();
    expect(json.code || json.error).toBeTruthy();
  });

  test('accounting summary without token → 401', async ({ request }) => {
    const res = await request.get(`${base}/api/accounting/summary?companyId=1`);
    expect(res.status()).toBe(401);
  });

  test('manufacturing summary without token → 401', async ({ request }) => {
    const res = await request.get(`${base}/api/manufacturing/summary?companyId=1`);
    expect(res.status()).toBe(401);
  });

  test('spoofed privyUserId without token → 401', async ({ request }) => {
    const res = await request.post(`${base}/api/inventory/scan`, {
      data: {
        companyId: 1,
        privyUserId: 'did:privy:attacker',
        raw: 'TEST',
        action: 'lookup',
      },
    });
    expect(res.status()).toBe(401);
  });

  test('fx rates remain public', async ({ request }) => {
    const res = await request.get(`${base}/api/fx/rates`);
    expect([200, 500, 502]).toContain(res.status());
  });
});
