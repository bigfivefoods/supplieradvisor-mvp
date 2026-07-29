import { test, expect } from '@playwright/test';

/**
 * NSNP schools golden-path smoke (unauthenticated).
 * Guards API surfaces used by Sprints A–C + priority improvements.
 */
const base =
  process.env.PLAYWRIGHT_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'http://localhost:3000';

test.describe('NSNP schools smoke (public)', () => {
  test('schools ops without auth → 401', async ({ request }) => {
    const res = await request.get(
      `${base}/api/schools/ops?companyId=1&view=path`
    );
    expect(res.status()).toBe(401);
  });

  test('schools orders without auth → 401', async ({ request }) => {
    const res = await request.get(
      `${base}/api/schools/orders?companyId=1`
    );
    expect(res.status()).toBe(401);
  });

  test('schools deliveries without auth → 401', async ({ request }) => {
    const res = await request.get(
      `${base}/api/schools/deliveries?companyId=1`
    );
    expect(res.status()).toBe(401);
  });

  test('schools claims without auth → 401', async ({ request }) => {
    const res = await request.get(
      `${base}/api/schools/claims?companyId=1`
    );
    expect(res.status()).toBe(401);
  });

  test('schools today board without auth → 401', async ({ request }) => {
    const res = await request.get(
      `${base}/api/schools/ops?companyId=1&view=today`
    );
    expect(res.status()).toBe(401);
  });

  test('demo seed without auth → 401', async ({ request }) => {
    const res = await request.post(`${base}/api/schools/demo-seed`, {
      data: { companyId: 1, action: 'status' },
    });
    expect(res.status()).toBe(401);
  });

  test('OTIF alerts cron without secret → 401/403/503', async ({
    request,
  }) => {
    const res = await request.get(
      `${base}/api/schools/otif-alerts/cron`
    );
    expect([401, 403, 503]).toContain(res.status());
  });

  test('schools dashboard page responds', async ({ request }) => {
    const res = await request.get(`${base}/dashboard/schools`);
    // Redirect to login or 200 shell
    expect([200, 302, 307, 401]).toContain(res.status());
  });
});
