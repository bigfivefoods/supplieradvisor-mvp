import { test, expect } from '@playwright/test';

/**
 * Signed-out ConstructionAdvisor® portal probes.
 * Unknown and bad tokens look the same. Staff book stays closed.
 */
const base =
  process.env.PLAYWRIGHT_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'http://localhost:3000';

const zeros = `cgp_${'0'.repeat(64)}`;

test.describe('ConstructionAdvisor portal links', () => {
  test('unknown portal token is a private 404', async ({ request }) => {
    const res = await request.get(`${base}/api/public/constructiongraph?token=${zeros}`);
    expect(res.status()).toBe(404);
    expect(res.headers()['cache-control'] || '').toContain('no-store');
    const body = await res.json();
    expect(body).toEqual({ error: 'Portal not found' });
  });

  test('a short token has the same 404 body', async ({ request }) => {
    const res = await request.get(`${base}/api/public/constructiongraph?token=a`);
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ error: 'Portal not found' });
  });

  test('posting an unknown token is a 404', async ({ request }) => {
    const res = await request.post(`${base}/api/public/constructiongraph`, {
      data: { token: `cgp_${'f'.repeat(64)}`, action: 'claim', paymentId: 'pay_2' },
    });
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ error: 'Portal not found' });
  });

  test('staff book stays closed when signed out', async ({ request }) => {
    const res = await request.get(`${base}/api/construction/constructiongraph?companyId=1`);
    expect([401, 403]).toContain(res.status());
    const body = await res.text();
    expect(body).not.toContain('"store"');
  });
});
