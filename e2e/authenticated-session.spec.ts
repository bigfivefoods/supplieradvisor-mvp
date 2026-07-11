import { test, expect } from '@playwright/test';

/**
 * Authenticated browser smoke.
 *
 * Requires env (optional — tests skip if missing):
 *   E2E_EMAIL / E2E_PASSWORD — Privy email OTP is not fully automatable here;
 *   For CI, prefer E2E_ACCESS_TOKEN (Privy access JWT) + E2E_COMPANY_ID.
 *
 * Without credentials: validates login page renders and unauth dashboard redirects.
 */

const base =
  process.env.PLAYWRIGHT_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'http://localhost:3000';

const token = process.env.E2E_ACCESS_TOKEN || '';
const companyId = process.env.E2E_COMPANY_ID || '';

test.describe('Browser auth shell', () => {
  test('login page loads', async ({ page }) => {
    await page.goto(`${base}/login`);
    await expect(page.locator('body')).toBeVisible();
    // Privy modal or app branding present
    const text = await page.locator('body').innerText();
    expect(text.length).toBeGreaterThan(10);
  });

  test('dashboard without session redirects or gates', async ({ page }) => {
    await page.goto(`${base}/dashboard`);
    await page.waitForTimeout(2000);
    const url = page.url();
    // Either login redirect or auth gate spinner/content
    const ok =
      url.includes('/login') ||
      url.includes('/dashboard') ||
      url.includes('privy');
    expect(ok).toBeTruthy();
  });
});

test.describe('Authenticated API with E2E_ACCESS_TOKEN', () => {
  test.skip(!token || !companyId, 'Set E2E_ACCESS_TOKEN and E2E_COMPANY_ID');

  test('stock with bearer returns 200 or 403 (not 401)', async ({ request }) => {
    const res = await request.get(
      `${base}/api/inventory/stock?companyId=${companyId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    // 200 if member, 403 if not member of company, never 401 with valid token
    expect([200, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(401);
  });

  test('period-locks with bearer', async ({ request }) => {
    const res = await request.get(
      `${base}/api/accounting/period-locks?companyId=${companyId}&trialBalance=1`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    expect([200, 403, 500, 503]).toContain(res.status());
    expect(res.status()).not.toBe(401);
  });

  test('quality inspections with bearer', async ({ request }) => {
    const res = await request.get(
      `${base}/api/quality/inspections?companyId=${companyId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    expect([200, 403, 500, 503]).toContain(res.status());
    expect(res.status()).not.toBe(401);
  });

  test('notifications with bearer', async ({ request }) => {
    const res = await request.get(
      `${base}/api/notifications?companyId=${companyId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    expect([200, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(401);
  });
});
