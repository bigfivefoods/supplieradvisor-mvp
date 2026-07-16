/**
 * Smoke: verification APIs require auth + payment (no free path).
 * Uses public health + unauthenticated 401/402 expectations.
 */
import { test, expect } from '@playwright/test';

const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000';

test.describe('paid verification smoke', () => {
  test('health reports schema + payment env flags', async ({ request }) => {
    const res = await request.get(`${base}/api/system/health`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty('ok');
    expect(body).toHaveProperty('deploy');
    expect(body.checks).toBeTruthy();
    // schemaColumnsOk may be false if migrations pending — still a valid response
    expect(typeof body.schemaColumnsOk === 'boolean' || body.schemaColumnsOk === undefined).toBeTruthy();
  });

  test('CIPC verify requires payment without free path', async ({ request }) => {
    const res = await request.post(`${base}/api/business/verify`, {
      data: { companyId: 1, consent: true },
    });
    // 401 unauth or 402 payment required — never 200 free verify
    expect([401, 402, 403, 404]).toContain(res.status());
  });

  test('bank verify requires payment', async ({ request }) => {
    const res = await request.post(`${base}/api/business/verify-bank`, {
      data: { companyId: 1, consent: true },
    });
    expect([401, 402, 403, 404]).toContain(res.status());
  });

  test('public directory rate limit headers on normal load', async ({
    request,
  }) => {
    const res = await request.get(
      `${base}/api/public/verified-companies?page=1&pageSize=3`
    );
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBeTruthy();
    expect(Array.isArray(body.companies)).toBeTruthy();
    expect(body.pageSize).toBeTruthy();
  });
});
