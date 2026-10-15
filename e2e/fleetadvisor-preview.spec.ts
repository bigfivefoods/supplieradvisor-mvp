import { test, expect } from '@playwright/test';

const pages = ['', '/map', '/vehicles', '/drivers', '/compliance', '/jobs', '/cpk', '/import', '/settings'];

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
    await page.getByTestId('fleet-cost-date').fill('2024-06-15');
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

  test('compliance centre renews, bulk-enters, imports and hitches', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/preview/fleetgraph/compliance?reset=1');
    await expect(page.locator('[data-book-ready="1"]')).toBeVisible();
    await page.getByTestId('fleet-kpi-expired').click();
    await page.getByTestId('fleet-row-comp-disc').click();
    await page.getByTestId('fleet-renew-date').fill('2027-03-12');
    await page.getByTestId('fleet-renew').click();
    await expect(page.getByText('12 Mar 2027').first()).toBeVisible();

    await page.getByTestId('fleet-bulk').click();
    await page.getByTestId('fleet-bulk-date-sample-02').fill('2027-04-01');
    await page.getByTestId('fleet-bulk-date-sample-tr').fill('2027-05-01');
    await expect(page.getByTestId('fleet-bulk-count')).toContainText('2 rows changed');
    await page.getByTestId('fleet-bulk-save').click();

    await page.goto('/preview/fleetgraph/import');
    await page.getByTestId('fleet-csv').fill('reg_no,kind\nSAMPLE 99,rigid\n');
    await page.getByTestId('fleet-dry-run').click();
    await expect(page.getByTestId('fleet-dry-result')).toContainText('Create 1');
    await page.getByTestId('fleet-commit').click();
    await page.getByTestId('fleet-commit').click();
    await expect(page.getByTestId('fleet-already')).toBeVisible();

    await page.goto('/preview/fleetgraph/vehicles/sample-01');
    await expect(page.getByTestId('fleet-timeline')).toBeVisible();
    await page.getByTestId('fleet-hitch').click();
    await expect(page.getByTestId('fleet-hitch-error')).toBeVisible();

    await page.goto('/preview/fleetgraph/compliance?role=dispatcher');
    await expect(page.getByTestId('fleet-export')).toBeDisabled();
    await page.goto('/preview/fleetgraph/compliance?role=owner&reset=1');
    await expect(page.getByTestId('fleet-export')).toBeEnabled();
    expect(errors).toEqual([]);
  });

  test('compliance pages stay on this origin at phone width', async ({ page }) => {
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
    await page.setViewportSize({ width: 375, height: 812 });
    for (const path of ['/compliance', '/import', '/vehicles/sample-01', '/drivers/driver-a', '/settings']) {
      await page.goto(`/preview/fleetgraph${path}?reset=1`);
      await expect(page.locator('[data-book-ready="1"]')).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    }
    await page.getByTestId('fleet-menu').click();
    await expect(page.getByTestId('fleet-sidebar')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Compliance' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Import' })).toBeVisible();
    const buttons = page.locator('button:visible');
    const count = await buttons.count();
    for (let index = 0; index < count; index += 1) {
      const box = await buttons.nth(index).boundingBox();
      if (!box) continue;
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    expect(await page.locator('aside').count()).toBe(1);
    expect(foreign).toEqual([]);
  });
});
