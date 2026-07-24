import { test, expect } from '@playwright/test';

/**
 * Golden-path production smoke (unauthenticated).
 * Run on every main deploy via CI: health, trade-loop, SEO, auth gates.
 */
const base =
  process.env.PLAYWRIGHT_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'http://localhost:3000';

test.describe('Golden path smoke (public)', () => {
  test('system health returns deploy identity', async ({ request }) => {
    const res = await request.get(`${base}/api/system/health`);
    expect([200, 503]).toContain(res.status());
    const j = await res.json();
    expect(j).toHaveProperty('ok');
    expect(j.deploy).toBeTruthy();
    expect(j.deploy.commitShort || j.deploy.commit).toBeTruthy();
    expect(j.checks).toBeTruthy();
  });

  test('trade-loop-smoke is public and reports schema path', async ({
    request,
  }) => {
    const res = await request.get(`${base}/api/system/trade-loop-smoke`);
    expect(res.status()).toBe(200);
    const j = await res.json();
    expect(j).toHaveProperty('ok');
    expect(j.deploy?.commitShort || j.deploy?.commit).toBeTruthy();
    expect(j.path).toMatch(/discover/i);
    expect(j.checks).toBeTruthy();
    // Schema tables should pass even if env secrets missing
    if (j.checks?.table_profiles) {
      expect(j.checks.table_profiles.ok).toBe(true);
    }
  });

  test('SEO directory page open', async ({ request }) => {
    const res = await request.get(`${base}/directory`);
    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(html.toLowerCase()).toMatch(/director|supplier|company/);
  });

  test('sitemap.xml present', async ({ request }) => {
    const res = await request.get(`${base}/sitemap.xml`);
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toMatch(/urlset|url/i);
  });

  test('robots.txt present', async ({ request }) => {
    const res = await request.get(`${base}/robots.txt`);
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body.toLowerCase()).toMatch(/user-agent|sitemap/);
  });

  test('protected invoice docs without auth → 401', async ({ request }) => {
    const res = await request.get(
      `${base}/api/customers/docs?companyId=1&type=invoice`
    );
    expect(res.status()).toBe(401);
  });

  test('protected AR aging without auth → 401', async ({ request }) => {
    const res = await request.get(
      `${base}/api/customers/ar-aging?companyId=1`
    );
    expect(res.status()).toBe(401);
  });

  test('AR digest cron without secret → 401/403/503', async ({ request }) => {
    const res = await request.get(`${base}/api/customers/ar-digest/cron`);
    expect([401, 403, 503]).toContain(res.status());
  });

  test('promise-to-pay cron without secret → 401/403/503', async ({
    request,
  }) => {
    const res = await request.get(
      `${base}/api/customers/docs/promise-to-pay-cron`
    );
    expect([401, 403, 503]).toContain(res.status());
  });

  test('overdue cron without secret → 401/403/503', async ({ request }) => {
    const res = await request.get(`${base}/api/customers/docs/overdue-cron`);
    expect([401, 403, 503]).toContain(res.status());
  });

  test('golden-loop health probe present', async ({ request }) => {
    const res = await request.get(`${base}/api/system/health`);
    expect([200, 503]).toContain(res.status());
    const j = await res.json();
    // When service role available, golden_loop block is included
    if (j.golden_loop) {
      expect(j.golden_loop).toHaveProperty('ok');
      expect(Array.isArray(j.golden_loop.missing) || j.golden_loop.ok).toBeTruthy();
    }
    expect(j.checks?.purchase_orders || j.ok !== undefined).toBeTruthy();
  });

  test('golden-path without auth → 401', async ({ request }) => {
    const res = await request.get(
      `${base}/api/business/golden-path?companyId=1`
    );
    expect(res.status()).toBe(401);
  });

  test('board-pack without auth → 401', async ({ request }) => {
    const res = await request.get(
      `${base}/api/business/board-pack?companyId=1`
    );
    expect(res.status()).toBe(401);
  });

  test('intelligence summary without auth → 401', async ({ request }) => {
    const res = await request.get(
      `${base}/api/intelligence/summary?companyId=1`
    );
    expect(res.status()).toBe(401);
  });

  test('settle page open (auth gate client-side)', async ({ request }) => {
    const res = await request.get(`${base}/dashboard/settle`);
    // HTML shell always 200; client AuthGate handles login
    expect([200, 307, 308]).toContain(res.status());
  });
});
