import { test, expect } from '@playwright/test';

const pages = ['', '/map', '/vehicles', '/drivers', '/jobs', '/cpk', '/settings'];

test.describe('FleetAdvisor preview', () => {
  test('walks every desk screen signed out', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    for (const path of pages) {
      await page.goto(`/preview/fleetgraph${path}?reset=1`);
      await expect(page.locator('[data-book-ready="1"]')).toBeVisible();
      await expect(page.getByText('Illustration · sample data').first()).toBeVisible();
    }
    expect(errors).toEqual([]);
  });

  test('adds a vehicle, driver, date, odometer and cost and the CPK moves', async ({ page }) => {
    await page.goto('/preview/fleetgraph/cpk?reset=1');
    await expect(page.locator('[data-book-ready="1"]')).toBeVisible();
    const before = await page.getByTestId('fleet-cpk-value').innerText();

    await page.goto('/preview/fleetgraph/vehicles');
    await page.getByTestId('fleet-add-vehicle').click();
    await page.getByTestId('fleet-reg').fill('SAMPLE 03');
    await page.getByTestId('fleet-save-vehicle').click();
    await expect(page.getByTestId('fleet-open-SAMPLE-03')).toBeVisible();

    await page.goto('/preview/fleetgraph/drivers');
    await page.getByTestId('fleet-add-driver').click();
    await page.getByTestId('fleet-driver-name').fill('Sample Driver D');
    await page.getByTestId('fleet-save-driver').click();
    await page.getByRole('button', { name: 'Sample Driver D' }).click();
    await page.getByTestId('fleet-compliance-expiry').fill('2027-03-12');
    await page.getByTestId('fleet-save-compliance').click();

    await page.goto('/preview/fleetgraph/vehicles');
    await page.getByTestId('fleet-open-SAMPLE-01').click();
    await page.getByTestId('fleet-odometer-km').fill('18100');
    await page.getByTestId('fleet-save-odometer').click();
    await page.getByTestId('fleet-cost-amount').fill('250000');
    await page.getByTestId('fleet-save-cost').click();

    await page.goto('/preview/fleetgraph/cpk');
    await expect(page.getByTestId('fleet-cpk-value')).not.toHaveText(before);
  });

  test('mobile layout does not scroll sideways and buttons are at least 44px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/preview/fleetgraph?reset=1');
    await expect(page.locator('[data-book-ready="1"]')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await page.getByTestId('fleet-menu').click();
    await expect(page.getByTestId('fleet-sidebar')).toBeVisible();
    const buttons = page.locator('button');
    const count = await buttons.count();
    for (let index = 0; index < count; index += 1) {
      const box = await buttons.nth(index).boundingBox();
      if (!box) continue;
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    expect(await page.locator('aside').count()).toBe(1);
  });

  test('the fleet map does not call another origin', async ({ page }) => {
    // Root layout analytics may call Vercel. Loopback aliases are this app, not a map tile.
    const foreign: string[] = [];
    const base = new URL(process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000');
    const loopback = (host: string) => host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
    page.on('request', (request) => {
      const target = new URL(request.url());
      const sameApp =
        target.origin === base.origin ||
        (loopback(target.hostname) && loopback(base.hostname) && target.port === (base.port || '80'));
      if (sameApp) return;
      if (/vercel|speed-insights|va\.vercel-scripts/i.test(target.hostname)) return;
      foreign.push(request.url());
    });
    await page.goto('/preview/fleetgraph/map?reset=1');
    await expect(page.getByTestId('fleet-map')).toBeVisible();
    expect(foreign).toEqual([]);
  });
});
