/**
 * Growth-that-settles smoke (P0–P3 surfaces).
 * Mutating paths skip unless E2E_MUTATE=1 and auth secrets set.
 */
import { test, expect } from '@playwright/test';

const base =
  process.env.PLAYWRIGHT_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'http://localhost:3000';

const token = process.env.E2E_ACCESS_TOKEN || '';
const companyId = process.env.E2E_COMPANY_ID || '';
const mutate = process.env.E2E_MUTATE === '1';

test.describe('Growth settles — public / unauth', () => {
  test('health deploy + paystack + P0 readiness shape', async ({ request }) => {
    const res = await request.get(`${base}/api/system/health`);
    expect([200, 503]).toContain(res.status());
    const j = await res.json();
    expect(j.deploy?.commitShort || j.deploy?.commit).toBeTruthy();
    expect(j.checks?.paystack).toBeTruthy();
    // p0Readiness is public ops gate (may have blockers in non-prod)
    if (j.p0Readiness) {
      expect(typeof j.p0Readiness.ok).toBe('boolean');
      expect(Array.isArray(j.p0Readiness.blockers)).toBeTruthy();
      expect(Array.isArray(j.p0Readiness.warnings)).toBeTruthy();
    }
  });

  test('verification-sla public', async ({ request }) => {
    const res = await request.get(`${base}/verification-sla`);
    expect(res.status()).toBe(200);
  });

  test('invite-track public endpoint accepts shape', async ({ request }) => {
    const res = await request.post(`${base}/api/public/invite-track`, {
      data: { ref: 1, email: 'e2e-smoke@example.com', event: 'opened' },
    });
    // 200 ok or 500 if DB soft — never 404
    expect([200, 400, 500]).toContain(res.status());
    expect(res.status()).not.toBe(404);
  });

  test('ops-board requires auth', async ({ request }) => {
    const res = await request.get(`${base}/api/system/ops-board`);
    expect([401, 403]).toContain(res.status());
  });
});

test.describe('Growth settles — auth', () => {
  test.skip(!token || !companyId, 'Set E2E_ACCESS_TOKEN and E2E_COMPANY_ID');

  const headers = () => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  });

  test('network invites + funnel', async ({ request }) => {
    const res = await request.get(
      `${base}/api/business/network-invites?companyId=${companyId}`,
      { headers: headers() }
    );
    expect([200, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(401);
    if (res.status() === 200) {
      const j = await res.json();
      expect(Array.isArray(j.invites)).toBeTruthy();
      expect(Array.isArray(j.funnel) || j.funnel === undefined).toBeTruthy();
    }
  });

  test('network metrics', async ({ request }) => {
    const res = await request.get(
      `${base}/api/business/network-metrics?companyId=${companyId}`,
      { headers: headers() }
    );
    expect([200, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(401);
  });

  test('first-trade plan', async ({ request }) => {
    const res = await request.get(
      `${base}/api/business/first-trade?companyId=${companyId}`,
      { headers: headers() }
    );
    expect([200, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(401);
  });

  test('payment claims list', async ({ request }) => {
    const res = await request.get(
      `${base}/api/customers/payment-claims?companyId=${companyId}&status=pending`,
      { headers: headers() }
    );
    expect([200, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(401);
  });

  test('trust surface', async ({ request }) => {
    const res = await request.get(
      `${base}/api/business/trust?companyId=${companyId}`,
      { headers: headers() }
    );
    expect([200, 403, 404, 500]).toContain(res.status());
    expect(res.status()).not.toBe(401);
  });

  test('mutate first-trade plan only when E2E_MUTATE=1', async ({
    request,
  }) => {
    test.skip(!mutate, 'Set E2E_MUTATE=1 for write path');
    // Dry bootstrap only when mutate — may create customer; acceptable on E2E company
    const res = await request.post(`${base}/api/business/first-trade`, {
      headers: headers(),
      data: {
        companyId: Number(companyId),
        action: 'plan',
      },
    });
    expect([200, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(401);
  });
});
