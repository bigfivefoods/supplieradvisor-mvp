/**
 * Smoke for the five major product bets (unauth gates + public surfaces).
 * Authenticated coverage lives in golden-path-auth + major-bets-auth.
 */
import { test, expect } from '@playwright/test';

const base =
  process.env.PLAYWRIGHT_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'http://localhost:3000';

test.describe('Major bets smoke (unauth)', () => {
  test('health includes deploy + paystack detail', async ({ request }) => {
    const res = await request.get(`${base}/api/system/health`);
    expect([200, 503]).toContain(res.status());
    const j = await res.json();
    expect(j.deploy?.commitShort || j.deploy?.commit).toBeTruthy();
    expect(j.checks).toBeTruthy();
    // paystack check object present (ok may be false without secret)
    expect(j.checks.paystack).toBeTruthy();
  });

  test('verify status requires auth', async ({ request }) => {
    const res = await request.get(
      `${base}/api/business/verify/status?companyId=1`
    );
    expect([401, 403]).toContain(res.status());
  });

  test('first-trade requires auth', async ({ request }) => {
    const res = await request.get(
      `${base}/api/business/first-trade?companyId=1`
    );
    expect([401, 403]).toContain(res.status());
  });

  test('network-metrics requires auth', async ({ request }) => {
    const res = await request.get(
      `${base}/api/business/network-metrics?companyId=1`
    );
    expect([401, 403]).toContain(res.status());
  });

  test('ar-ledger requires auth', async ({ request }) => {
    const res = await request.get(
      `${base}/api/customers/ar-ledger?companyId=1`
    );
    expect([401, 403]).toContain(res.status());
  });

  test('CIPC verify still no free path', async ({ request }) => {
    const res = await request.post(`${base}/api/business/verify`, {
      data: { companyId: 1, consent: true },
    });
    expect([401, 402, 403, 404]).toContain(res.status());
  });

  test('buyer payment claim requires auth', async ({ request }) => {
    const res = await request.post(`${base}/api/buyer/payment-claim`, {
      data: {
        buyerCompanyId: 1,
        supplierProfileId: 2,
        invoiceId: 1,
        amount: 100,
      },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('seller payment-claims requires auth', async ({ request }) => {
    const res = await request.get(
      `${base}/api/customers/payment-claims?companyId=1`
    );
    expect([401, 403]).toContain(res.status());
  });

  test('installments API requires auth', async ({ request }) => {
    const res = await request.get(
      `${base}/api/customers/installments?companyId=1&invoiceId=1`
    );
    expect([401, 403]).toContain(res.status());
  });

  test('verification SLA page is public', async ({ request }) => {
    const res = await request.get(`${base}/verification-sla`);
    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(html.toLowerCase()).toContain('cipc');
  });

  test('first-trade requires auth', async ({ request }) => {
    const res = await request.post(`${base}/api/business/first-trade`, {
      data: { companyId: 1, action: 'send' },
    });
    expect([401, 403]).toContain(res.status());
  });
});
