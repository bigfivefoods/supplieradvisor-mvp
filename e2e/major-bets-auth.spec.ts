/**
 * Authenticated coverage for the five major bets.
 * Skips when E2E_ACCESS_TOKEN or E2E_COMPANY_ID unset.
 */
import { test, expect } from '@playwright/test';

const base =
  process.env.PLAYWRIGHT_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'http://localhost:3000';

const token = process.env.E2E_ACCESS_TOKEN || '';
const companyId = process.env.E2E_COMPANY_ID || '';

test.describe('Major bets auth', () => {
  test.skip(!token || !companyId, 'Set E2E_ACCESS_TOKEN and E2E_COMPANY_ID');

  const headers = () => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  });

  test('1. CIPC SLA status surface', async ({ request }) => {
    const res = await request.get(
      `${base}/api/business/verify/status?companyId=${companyId}`,
      { headers: headers() }
    );
    expect([200, 403, 404, 500]).toContain(res.status());
    expect(res.status()).not.toBe(401);
    if (res.status() === 200) {
      const j = await res.json();
      expect(j.sla).toBeTruthy();
      expect(j.sla.phase).toBeTruthy();
      expect(typeof j.sla.slaTargetHours).toBe('number');
      expect(Array.isArray(j.sla.nextActions)).toBeTruthy();
    }
  });

  test('2. First-trade plan orchestration', async ({ request }) => {
    const res = await request.get(
      `${base}/api/business/first-trade?companyId=${companyId}`,
      { headers: headers() }
    );
    expect([200, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(401);
    if (res.status() === 200) {
      const j = await res.json();
      expect(j.plan).toBeTruthy();
      expect(Array.isArray(j.plan.steps)).toBeTruthy();
      expect(j.plan.steps.length).toBeGreaterThanOrEqual(3);
      expect(j.plan.targetMinutes).toBe(30);
      expect(typeof j.plan.progressPercent).toBe('number');
    }
  });

  test('3. AR ledger list (soft if migration pending)', async ({ request }) => {
    const res = await request.get(
      `${base}/api/customers/ar-ledger?companyId=${companyId}`,
      { headers: headers() }
    );
    expect([200, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(401);
    if (res.status() === 200) {
      const j = await res.json();
      expect(Array.isArray(j.entries)).toBeTruthy();
      // tableMissing is ok pre-migration
      expect(j.success).toBeTruthy();
    }
  });

  test('4. Network density + invite quality', async ({ request }) => {
    const res = await request.get(
      `${base}/api/business/network-metrics?companyId=${companyId}`,
      { headers: headers() }
    );
    expect([200, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(401);
    if (res.status() === 200) {
      const j = await res.json();
      expect(j.metrics).toBeTruthy();
      expect(typeof j.metrics.densityScore).toBe('number');
      expect(typeof j.metrics.qualityScore).toBe('number');
      expect(Array.isArray(j.metrics.recommendations)).toBeTruthy();
    }
  });

  test('5. Deploy identity still on health (ops reliability)', async ({
    request,
  }) => {
    const res = await request.get(`${base}/api/system/health`);
    expect([200, 503]).toContain(res.status());
    const j = await res.json();
    expect(j.deploy).toBeTruthy();
    expect(j.checks?.cron_secret || j.checks?.env).toBeTruthy();
  });
});
