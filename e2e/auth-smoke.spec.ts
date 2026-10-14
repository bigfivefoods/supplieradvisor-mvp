import { test, expect, type Page, type Request } from '@playwright/test';

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

  test('retired directory invite does not send mail', async ({ request }) => {
    const res = await request.post(`${base}/api/public/directory-invite`, {
      data: { email: 'x' },
    });
    expect([404, 405]).toContain(res.status());
  });

  test('retired bulk directory invite does not send mail', async ({ request }) => {
    const res = await request.post(`${base}/api/public/directory-invite/bulk`, {
      data: { emails: [] },
    });
    expect([404, 405]).toContain(res.status());
  });

  test('real trade quote PDF stays closed when signed out', async ({ request }) => {
    const res = await request.get(
      `${base}/api/public/tradegraph/quote-pdf?token=tg_real_probe_108&quote=tq_probe`
    );
    expect(res.status()).not.toBe(200);
    const body = await res.text();
    expect(body).not.toContain('%PDF');
    expect(body).not.toContain('BEGIN:VCALENDAR');
  });

  test('real trade calendar stays closed when signed out', async ({ request }) => {
    const res = await request.get(`${base}/api/public/tradegraph/ics?token=tg_real_probe_108`);
    expect(res.status()).not.toBe(200);
    const body = await res.text();
    expect(body).not.toContain('BEGIN:VCALENDAR');
    expect(body).not.toContain('%PDF');
  });
});

test.describe('Login return query', () => {
  async function openLogin(page: Page, path: string) {
    const privyRequests: string[] = [];
    const onRequest = (req: Request) => {
      if (/privy/i.test(req.url())) privyRequests.push(req.url());
    };
    page.on('request', onRequest);
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    return {
      privyRequests,
      async settled() {
        await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);
      },
      stop() {
        page.off('request', onRequest);
      },
    };
  }

  test('/login?next=/me shows SA Member and does not load Privy before a click', async ({ page }) => {
    const watch = await openLogin(page, '/login?next=/me');
    await expect(page.locator('h1')).toHaveText('SA Member');
    await watch.settled();
    expect(watch.privyRequests).toEqual([]);
    watch.stop();
  });

  test('/login?claimed=1 shows Account ready and does not load Privy before a click', async ({ page }) => {
    const watch = await openLogin(page, '/login?claimed=1');
    await expect(page.getByText('Account ready', { exact: false })).toBeVisible();
    await watch.settled();
    expect(watch.privyRequests).toEqual([]);
    watch.stop();
  });

  test('contractor invite pre-fills the operator banner and does not load Privy before a click', async ({
    page,
  }) => {
    const watch = await openLogin(
      page,
      '/login?next=/contractor/invite?token=t&email=a@b.co'
    );
    await expect(page.getByText('Operator invite — sign in with a@b.co')).toBeVisible();
    await watch.settled();
    expect(watch.privyRequests).toEqual([]);
    watch.stop();
  });
});
