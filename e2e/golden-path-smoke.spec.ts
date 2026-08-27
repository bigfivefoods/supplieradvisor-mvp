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
  test('system health liveness is public (no secret leak)', async ({ request }) => {
    const res = await request.get(`${base}/api/system/health`);
    expect([200, 503]).toContain(res.status());
    const j = await res.json();
    expect(j).toHaveProperty('ok');
    expect(j.checks).toBeFalsy();
    expect(j.deploy).toBeFalsy();
  });

  test('trade-loop-smoke is not public', async ({
    request,
  }) => {
    const res = await request.get(`${base}/api/system/trade-loop-smoke`);
    expect([401, 403, 503]).toContain(res.status());
  });

  test('retired directory redirects home', async ({ request }) => {
    const res = await request.get(`${base}/directory`, { maxRedirects: 0 });
    // Permanent redirect away from public directory
    expect([301, 302, 307, 308]).toContain(res.status());
    const loc = res.headers()['location'] || '';
    expect(loc === '/' || loc.endsWith('/') || loc.includes(base)).toBeTruthy();
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
    expect(j.ok !== undefined).toBeTruthy();
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

  // ── Sprint A–D auth gates ──────────────────────────────────────────────
  test('stuck-stage alerts without cron secret → 401/403/503', async ({
    request,
  }) => {
    const res = await request.post(`${base}/api/system/stuck-stage-alerts`, {
      data: { limit: 1 },
    });
    expect([401, 403, 503]).toContain(res.status());
  });

  test('intelligence actions without auth → 401', async ({ request }) => {
    const res = await request.post(`${base}/api/intelligence/actions`, {
      data: {
        companyId: 1,
        action: 'activity',
        insight: { id: 'test', title: 't', detail: 'd', domain: 'ops' },
      },
    });
    expect(res.status()).toBe(401);
  });

  test('leadership progress without auth → 401', async ({ request }) => {
    const res = await request.get(
      `${base}/api/intelligence/leadership?companyId=1`
    );
    expect(res.status()).toBe(401);
  });

  test('board-pack POST without auth → 401', async ({ request }) => {
    const res = await request.post(`${base}/api/business/board-pack`, {
      data: { companyId: 1, email: false },
    });
    expect(res.status()).toBe(401);
  });

  test('escrow hub page open (client auth gate)', async ({ request }) => {
    const res = await request.get(`${base}/dashboard/escrow`);
    expect([200, 307, 308]).toContain(res.status());
  });

  test('leadership development page open (client auth gate)', async ({
    request,
  }) => {
    const res = await request.get(
      `${base}/dashboard/intelligence/leadership-development`
    );
    expect([200, 307, 308]).toContain(res.status());
  });
});
