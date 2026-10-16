import { expect, test } from '@playwright/test';

test('catalogues page lists fifteen downloads', async ({ page }) => {
  await page.goto('/catalogues');
  await expect(page.getByRole('heading', { level: 1, name: 'Catalogues' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Download PDF' })).toHaveCount(15);
  await expect(page.locator('article')).toHaveCount(15);
});

test('trade download redirects to the public catalogue file', async ({ request }) => {
  const response = await request.get('/catalogues/trade/download', { maxRedirects: 0 });
  expect(response.status()).toBe(302);
  const location = response.headers().location || '';
  expect(location).toMatch(/\.public\.blob\.vercel-storage\.com\//);
  expect(location.endsWith('/trade-advisor-catalogue.pdf?download=1&v=20261015')).toBe(true);
});

test('unknown catalogue id returns 404', async ({ request }) => {
  const response = await request.get('/catalogues/not-a-catalogue/download', { maxRedirects: 0 });
  expect(response.status()).toBe(404);
});

test('trades industry page links the catalogue', async ({ page }) => {
  await page.goto('/industries/trades');
  await expect(page.getByRole('link', { name: /Download the catalogue/ })).toBeVisible();
});

test('home footer links catalogues and first HTML omits the section', async ({ page, request }) => {
  const html = await (await request.get('/')).text();
  expect(html).not.toContain('id="catalogues"');
  expect(html).not.toContain('Download the catalogue for your industry.');
  expect(html).toContain('>Catalogues<');

  await page.goto('/');
  await expect(page.locator('footer').getByRole('link', { name: 'Catalogues' })).toBeVisible();
});

for (const width of [1280, 768, 375]) {
  test(`catalogue layouts do not overflow at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/catalogues');
    await expect(page.getByRole('heading', { level: 1, name: 'Catalogues' })).toBeVisible();
    const cataloguesFit = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    );
    expect(cataloguesFit).toBe(true);

    await page.goto('/');
    const sentinel = page.locator('[data-home-below-fold]');
    await sentinel.scrollIntoViewIfNeeded();
    await expect(page.locator('#catalogues')).toBeVisible({ timeout: 20_000 });
    await page.locator('#catalogues').scrollIntoViewIfNeeded();
    const homeFit = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    );
    expect(homeFit).toBe(true);
  });
}
