import { test, expect } from '@playwright/test';

const base = process.env.PLAYWRIGHT_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const locales = ['fr', 'ar', 'pt', 'sw', 'zu'] as const;

for (const locale of locales) {
  test(`/${locale} locale metadata + hero`, async ({ page }) => {
    const res = await page.goto(`/${locale}`);
    expect(res?.status()).toBe(200);

    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    if (locale === 'ar') {
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    } else {
      await expect(page.locator('html')).not.toHaveAttribute('dir', 'rtl');
    }

    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${base}/${locale}`);
    await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(7);
    await expect(page.locator('h1')).not.toContainText("The world's most trusted");
    await expect(page.getByText('SupplierAdvisor®').first()).toBeVisible();
  });
}

test('/fr/demo redirects to /demo', async ({ request }) => {
  const response = await request.get(`${base}/fr/demo`, { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(response.headers().location).toBe('/demo');
});

test('switcher on / lists native names + esc + navigate to /fr', async ({ page }) => {
  await page.goto('/');

  const trigger = page.getByRole('button', { name: /EN/i }).first();
  await trigger.click();

  for (const nativeName of ['English', 'Français', 'العربية', 'Português', 'Kiswahili', 'isiZulu']) {
    await expect(page.getByRole('link', { name: nativeName })).toBeVisible();
  }

  await page.keyboard.press('Escape');
  await expect(page.getByRole('link', { name: 'Français' })).toBeHidden();
  await expect(trigger).toBeFocused();

  await trigger.click();
  await page.getByRole('link', { name: 'Français' }).click();
  await expect(page).toHaveURL(/\/fr$/);
});
