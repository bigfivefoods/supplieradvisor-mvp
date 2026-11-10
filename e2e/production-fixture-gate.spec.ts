import { expect, test } from '@playwright/test';

const base =
  process.env.PLAYWRIGHT_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'http://localhost:3000';

const PUBLIC_PAGES = ['/', '/pricing', '/industries/trades'] as const;

test.describe('Production fixture-route gate coverage', () => {
  test('public pages do not emit demo/preview fixture hrefs', async ({ request }) => {
    for (const path of PUBLIC_PAGES) {
      const res = await request.get(`${base}${path}`);
      expect(res.status(), `${path} should be reachable`).toBe(200);
      const html = await res.text();
      expect(html).not.toContain('href="/demo"');
      expect(html).not.toContain('href="/preview/');
    }
  });

  test('hydrated public pages keep live href targets', async ({ page }) => {
    for (const path of PUBLIC_PAGES) {
      await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
      const fixtureHrefs = await page.evaluate(() =>
        Array.from(document.querySelectorAll<HTMLAnchorElement>('a'))
          .map((node) => node.getAttribute('href') || '')
          .filter((href) => href === '/demo' || href.startsWith('/preview/'))
      );
      expect(fixtureHrefs, `${path} should not hydrate to fixture hrefs`).toEqual([]);
    }
  });

  test('tour/demo CTAs resolve to live 200 pages', async ({ page, request }) => {
    await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
    const hrefs = await page.evaluate(() => {
      const candidates = Array.from(document.querySelectorAll<HTMLAnchorElement>('a')).filter((node) => {
        const id = (node.id || '').toLowerCase();
        const text = (node.textContent || '').trim().toLowerCase();
        return id === 'guided-tour' || text.includes('guided tour') || text.includes('interactive demo');
      });
      return candidates.map((node) => node.getAttribute('href') || '').filter(Boolean);
    });
    const internal = Array.from(
      new Set(
        hrefs.filter((href) => href.startsWith('/')).map((href) => href.split('#')[0] || '/')
      )
    );

    expect(internal.length).toBeGreaterThan(0);
    for (const href of internal) {
      const res = await request.get(`${base}${href}`);
      expect(res.status(), `${href} should resolve for public CTA`).toBe(200);
    }
  });

  test('/demo and /preview/dashboard remain gated in production', async ({ request }) => {
    const demo = await request.get(`${base}/demo`);
    const preview = await request.get(`${base}/preview/dashboard`);
    expect(demo.status()).toBe(404);
    expect(preview.status()).toBe(404);
  });
});
