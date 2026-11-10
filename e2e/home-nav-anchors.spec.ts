import { expect, test } from '@playwright/test';

const PRIMARY = [
  { label: 'Product', href: '/product', h1: 'Product' },
  { label: 'Modules', href: '/modules', h1: 'Modules' },
  { label: 'Industries', href: '/industries', h1: 'Sector-ready depth on one OS' },
  { label: 'Pricing', href: '/pricing', h1: 'Transparent company pricing from R299/month' },
  { label: 'ROI', href: '/roi', h1: 'ROI calculator' },
] as const;

const MORE = [
  { label: 'SA Member', href: '/sa-member', h1: 'SA Member' },
  { label: 'Why SA', href: '/why-supplieradvisor', h1: 'Why SupplierAdvisor®' },
  { label: 'How it fits', href: '/how-it-fits', h1: 'How it fits' },
  { label: 'Trust', href: '/trust', h1: 'Trust' },
  { label: 'Catalogues', href: '/catalogues', h1: 'Catalogues' },
] as const;

test.describe('homepage nav page links', () => {
  test('desktop nav items open pages with one h1', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    for (const item of PRIMARY) {
      await page.getByRole('link', { name: item.label }).first().click();
      await expect(page).toHaveURL(new RegExp(`${item.href}$`));
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.getByRole('heading', { level: 1 })).toContainText(item.h1);
      await page.goto('/');
    }

    await page.getByRole('button', { name: 'Open more navigation' }).click();
    for (const item of MORE) {
      await page.getByRole('menuitem', { name: item.label }).click();
      await expect(page).toHaveURL(new RegExp(`${item.href.replace('/', '\\/')}`));
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.getByRole('heading', { level: 1 })).toContainText(item.h1);
      await page.goto('/');
      await page.getByRole('button', { name: 'Open more navigation' }).click();
    }
  });

  test('mobile drawer lists nav items and routes', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Open menu' }).click();

    await page.getByRole('link', { name: 'Product' }).click();
    await expect(page).toHaveURL(/\/product$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Product');
  });

  test('legacy home hashes redirect to new pages', async ({ page }) => {
    await page.goto('/#roi');
    await expect(page).toHaveURL(/\/roi$/);

    await page.goto('/#modules');
    await expect(page).toHaveURL(/\/modules$/);

    await page.goto('/#trust');
    await expect(page).toHaveURL(/\/trust$/);
  });
});
