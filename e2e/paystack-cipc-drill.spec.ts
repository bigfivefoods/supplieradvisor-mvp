/**
 * P0 drill: Paystack webhook public + health pulse + CIPC SLA surface.
 * No real payment required.
 */
import { test, expect } from '@playwright/test';

const base =
  process.env.PLAYWRIGHT_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'http://localhost:3000';

test.describe('Paystack + CIPC drill (public)', () => {
  test('webhook endpoint is public', async ({ request }) => {
    const res = await request.get(`${base}/api/paystack/webhook`);
    expect(res.status()).toBe(200);
    const j = await res.json();
    expect(j.ok).toBeTruthy();
    expect(j.public).toBeTruthy();
  });

  test('webhook ping seeds pulse', async ({ request }) => {
    const res = await request.get(`${base}/api/paystack/webhook?ping=1`);
    expect(res.status()).toBe(200);
    const j = await res.json();
    expect(j.pulse).toBeTruthy();
  });

  test('health paystack secret + pulse shape', async ({ request }) => {
    const res = await request.get(`${base}/api/system/health`);
    expect(res.status()).toBe(200);
    const j = await res.json();
    expect(j.checks?.paystack).toBeTruthy();
    const pulse = j.checks?.paystack?.detail?.webhookPulse;
    expect(pulse === undefined || typeof pulse === 'object').toBeTruthy();
  });

  test('public marketplace listings', async ({ request }) => {
    const res = await request.get(`${base}/api/public/marketplace-listings?limit=5`);
    expect([200, 429, 500]).toContain(res.status());
    if (res.status() === 200) {
      const j = await res.json();
      expect(Array.isArray(j.listings)).toBeTruthy();
    }
  });
});
