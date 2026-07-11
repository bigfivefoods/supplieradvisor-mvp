import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/**
 * Session via Playwright storageState (manual login once, then CI reuse).
 *
 * Setup:
 *   1. npx playwright codegen --save-storage=e2e/.auth.json https://www.supplieradvisor.com/login
 *   2. Complete Privy login in the browser window
 *   3. Close codegen when dashboard loads
 *   4. export PLAYWRIGHT_BASE_URL=https://www.supplieradvisor.com
 *   5. npm run test:e2e:storage
 *
 * storageState file is gitignored (contains session cookies).
 */

const base =
  process.env.PLAYWRIGHT_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'http://localhost:3000';

const authPath = process.env.E2E_STORAGE_STATE || path.join(__dirname, '.auth.json');
const hasStorage = fs.existsSync(authPath);

test.describe('Authenticated UI via storageState', () => {
  test.skip(!hasStorage, `Missing ${authPath} — run playwright codegen --save-storage`);

  test.use({ storageState: authPath });

  test('dashboard loads for signed-in user', async ({ page }) => {
    await page.goto(`${base}/dashboard`);
    await page.waitForTimeout(2500);
    const url = page.url();
    // Should not bounce to marketing home forever; login page is also failure
    const body = await page.locator('body').innerText();
    expect(body.length).toBeGreaterThan(20);
    expect(url.includes('/login') && !url.includes('dashboard')).toBeFalsy();
  });

  test('quality hub reachable', async ({ page }) => {
    await page.goto(`${base}/dashboard/quality`);
    await page.waitForTimeout(2000);
    const text = await page.locator('body').innerText();
    expect(text.length).toBeGreaterThan(10);
  });

  test('accounting settings reachable', async ({ page }) => {
    await page.goto(`${base}/dashboard/accounting/settings`);
    await page.waitForTimeout(2000);
    const text = await page.locator('body').innerText();
    expect(text.length).toBeGreaterThan(10);
  });
});
