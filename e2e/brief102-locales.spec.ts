import { test, expect } from '@playwright/test';

const base = process.env.PLAYWRIGHT_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const locales = ['fr', 'ar', 'pt', 'sw', 'zu'] as const;
const navLocales = ['en', 'fr', 'sw', 'zu', 'ar'] as const;
const navWidths = [1024, 1280, 1440] as const;
const referralL1ByLocale: Record<(typeof locales)[number], string> = {
  fr: 'Invitation directe (L1)',
  ar: 'دعوة مباشرة (L1)',
  pt: 'Convite direto (L1)',
  sw: 'Mwito wa moja kwa moja (L1)',
  zu: 'Isimemo esiqondile (L1)',
};
const footerGroupByLocale: Record<(typeof locales)[number], { product: string; network: string; trust: string; apps: string }> = {
  fr: { product: 'Produit', network: 'Réseau', trust: 'Confiance', apps: 'Applications' },
  ar: { product: 'المنتج', network: 'الشبكة', trust: 'الثقة', apps: 'التطبيقات' },
  pt: { product: 'Produto', network: 'Rede', trust: 'Confiança', apps: 'Aplicações' },
  sw: { product: 'Bidhaa', network: 'Mtandao', trust: 'Uaminifu', apps: 'Programu' },
  zu: { product: 'Umkhiqizo', network: 'Inethiwekhi', trust: 'Ukwethembeka', apps: 'Ama-app' },
};

test('raw HTML for /fr includes lang and localized h1', async ({ request }) => {
  const response = await request.get(`${base}/fr`);
  expect(response.status()).toBe(200);
  const html = await response.text();
  expect(html).toContain('<html lang="fr"');
  expect(html).toContain('Le conseil fournisseur le plus fiable');
});

test('raw HTML for /ar includes lang and rtl dir', async ({ request }) => {
  const response = await request.get(`${base}/ar`);
  expect(response.status()).toBe(200);
  const html = await response.text();
  expect(html).toContain('<html lang="ar" dir="rtl"');
});

test('localized /pricing pages include translated body copy and tier labels', async ({ request }) => {
  const frResponse = await request.get(`${base}/fr/pricing`);
  expect(frResponse.status()).toBe(200);
  const frHtml = await frResponse.text();
  expect(frHtml).toContain('Tarification transparente');
  expect(frHtml).toContain('Mensuel');

  const ptResponse = await request.get(`${base}/pt/pricing`);
  expect(ptResponse.status()).toBe(200);
  const ptHtml = await ptResponse.text();
  expect(ptHtml).toContain('utilizadores ilimitados');
  expect(ptHtml).toContain('Teste gratuito');
});

test('/fr/pricing includes localized PDF link with English hreflang', async ({ request }) => {
  const response = await request.get(`${base}/fr/pricing`);
  expect(response.status()).toBe(200);
  const html = await response.text();
  expect(html).toContain('Télécharger le profil entreprise (PDF)');
  expect(html).toContain('href="/supplieradvisor-company-profile.pdf"');
  expect(html).toMatch(/hrefLang="en"|hreflang="en"/);
});

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

    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `https://www.supplieradvisor.com/${locale}`
    );
    await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(7);
    await expect(page.locator('h1')).not.toContainText("The world's most trusted");
    await expect(page.getByText('SupplierAdvisor®').first()).toBeVisible();
  });
}

for (const locale of locales) {
  test(`/${locale} twitter metadata matches localized OG metadata`, async ({ request }) => {
    const [homeResponse, pricingResponse] = await Promise.all([
      request.get(`${base}/${locale}`),
      request.get(`${base}/${locale}/pricing`),
    ]);
    expect(homeResponse.status()).toBe(200);
    expect(pricingResponse.status()).toBe(200);

    const check = (html: string) => {
      const ogTitle = html.match(/property="og:title" content="([^"]+)"/)?.[1];
      const ogDescription = html.match(/property="og:description" content="([^"]+)"/)?.[1];
      const twitterTitle = html.match(/name="twitter:title" content="([^"]+)"/)?.[1];
      const twitterDescription = html.match(/name="twitter:description" content="([^"]+)"/)?.[1];

      expect(ogTitle).toBeTruthy();
      expect(ogDescription).toBeTruthy();
      expect(twitterTitle).toBeTruthy();
      expect(twitterDescription).toBeTruthy();
      expect(twitterTitle).toBe(ogTitle);
      expect(twitterDescription).toBe(ogDescription);
    };

    check(await homeResponse.text());
    check(await pricingResponse.text());
  });
}

for (const locale of locales) {
  test(`/${locale}/pricing localizes referral labels and footer group headings`, async ({ request }) => {
    const response = await request.get(`${base}/${locale}/pricing`);
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).toContain(referralL1ByLocale[locale]);
    expect(html).toContain(footerGroupByLocale[locale].product);
    expect(html).toContain(footerGroupByLocale[locale].network);
    expect(html).toContain(footerGroupByLocale[locale].trust);
    expect(html).toContain(footerGroupByLocale[locale].apps);
  });
}

test('/fr/demo redirects to /demo', async ({ request }) => {
  const response = await request.get(`${base}/fr/demo`, { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(response.headers().location).toBe('/demo');
});

test('switcher on / lists native names + esc + navigate to /fr', async ({ page }) => {
  await page.goto('/');

  const trigger = page
    .locator('button[aria-haspopup="menu"]')
    .filter({ hasText: 'EN' })
    .first();
  await trigger.click();

  for (const nativeName of ['English', 'Français', 'العربية', 'Português', 'Kiswahili', 'isiZulu']) {
    await expect(page.getByRole('menuitem', { name: nativeName })).toBeVisible();
  }

  await page.keyboard.press('Escape');
  await expect(page.getByRole('menuitem', { name: 'Français' })).toBeHidden();
  await expect(trigger).toBeFocused();

  await trigger.click();
  await page.getByRole('menuitem', { name: 'Français' }).click();
  await expect(page).toHaveURL(/\/fr$/);
});

for (const locale of navLocales) {
  for (const width of navWidths) {
    test(`${locale} top-nav geometry is clean at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(locale === 'en' ? '/' : `/${locale}`);
      await page.waitForLoadState('networkidle');

      const checks = await page.evaluate(() => {
        const row = document.querySelector<HTMLElement>('[data-landing-nav] > div');
        if (!row) return { missingRow: true, issues: ['missing top nav row'] as string[] };

        const controls = Array.from(row.querySelectorAll<HTMLElement>('a,button')).filter((el) => {
          const style = window.getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        });

        const issues: string[] = [];
        const rects = controls.map((el) => ({ el, rect: el.getBoundingClientRect() }));

        for (const { el, rect } of rects) {
          const label = el.textContent?.trim() || el.getAttribute('aria-label') || el.tagName;
          if (rect.left < 0 || rect.right > window.innerWidth || rect.top < 0 || rect.bottom > window.innerHeight) {
            issues.push(`out-of-viewport: ${label}`);
          }
          if (el.scrollWidth > el.clientWidth + 1) {
            issues.push(`truncated: ${label}`);
          }
        }

        for (let i = 0; i < rects.length; i += 1) {
          for (let j = i + 1; j < rects.length; j += 1) {
            const a = rects[i]!;
            const b = rects[j]!;
            const xOverlap = Math.max(0, Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left));
            const yOverlap = Math.max(0, Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top));
            if (xOverlap > 1 && yOverlap > 1) {
              const aLabel = a.el.textContent?.trim() || a.el.getAttribute('aria-label') || a.el.tagName;
              const bLabel = b.el.textContent?.trim() || b.el.getAttribute('aria-label') || b.el.tagName;
              issues.push(`overlap: ${aLabel} <> ${bLabel}`);
            }
          }
        }

        return { missingRow: false, issues };
      });

      expect(checks.missingRow).toBeFalsy();
      expect(checks.issues, checks.issues.join('\n')).toEqual([]);
    });
  }
}

for (const locale of ['fr', 'ar'] as const) {
  test(`/${locale} has no React #418 hydration mismatch`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      const text = msg.text();
      if (text.includes('vercel.live') && text.includes('Content Security Policy')) return;
      errors.push(text);
    });

    await page.goto(`/${locale}`);
    await page.waitForTimeout(500);
    expect(errors.some((line) => line.includes('#418'))).toBeFalsy();
  });
}
