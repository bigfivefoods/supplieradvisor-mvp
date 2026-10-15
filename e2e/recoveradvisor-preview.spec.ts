import { test, expect } from '@playwright/test';

const views = ['', '/creditors', '/mandates', '/accounts', '/account', '/imports', '/queue', '/team', '/installed'];

test.describe('RecoverAdvisor preview', () => {
  test('walks the fictional book signed out', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const alien: string[] = [];
    // The root layout already mounts Vercel Analytics. This spec does not edit that layout.
    await page.route('https://va.vercel-scripts.com/**', (route) => route.abort());
    page.on('request', (request) => {
      const url = new URL(request.url());
      const here = new URL(page.url() || 'http://localhost:3000').origin;
      if (url.origin === here || url.origin === 'http://localhost:3000' || url.origin === 'http://127.0.0.1:3000') return;
      if (url.origin === 'https://va.vercel-scripts.com') return;
      alien.push(url.origin);
    });
    for (const view of views) {
      await page.goto(`/preview/recovergraph${view}?book=harbour&role=owner`);
      await expect(page.locator('[data-book-ready="1"]')).toBeVisible();
      await expect(page.getByText('Demo data. No messages are sent.').first()).toBeVisible();
    }
    expect(errors).toEqual([]);
    expect(alien).toEqual([]);
  });

  test('imports a sample file and rolls it back', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/preview/recovergraph/imports?reset=1&role=owner');
    await expect(page.locator('[data-book-ready="1"]')).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByTestId('recover-csv').fill('account number,debtor name,principal\nDEMO-900,Sample Debtor,1234.56\n');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Run dry run' }).click();
    await expect(page.getByTestId('recover-dry-errors')).toBeVisible();
    await page.getByTestId('recover-commit').click();
    await expect(page.getByTestId('recover-commit-result')).toBeVisible();
    await page.goto('/preview/recovergraph/accounts?book=harbour&role=owner');
    await expect(page.getByText('Sample Debtor')).toBeVisible();
    await expect(page.getByText('RC-').first()).toBeVisible();
    await page.goto('/preview/recovergraph/imports?book=harbour&role=owner');
    await page.getByTestId('recover-rollback-upload').click();
    await page.goto('/preview/recovergraph/accounts?book=harbour&role=owner');
    await expect(page.getByText('Sample Debtor')).toHaveCount(0);
    await expect(page.getByText('RC-').first()).toBeVisible();
  });

  test('viewer sees counts and the phone layout stays inside the screen', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/preview/recovergraph/accounts?book=harbour&role=viewer');
    await expect(page.getByTestId('recover-accounts-counts')).toBeVisible();
    const scroll = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
    expect(scroll).toBe(true);
    await page.goto('/preview/recovergraph/installed?book=harbour&role=owner');
    await expect(page.getByTestId('recover-bottom-nav')).toBeVisible();
  });
});
