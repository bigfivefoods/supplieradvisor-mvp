import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * Homepage navbar must land on the real section on the first click.
 * Targets inside the lazy below-fold island are not in the DOM until revealed.
 */
const SECTIONS = [
  { id: 'product', section: 'video', label: 'Product' },
  { id: 'member', section: 'member-app', label: 'SA Member' },
  { id: 'why', section: 'why-join', label: 'Why SA' },
  { id: 'modules', section: 'modules', label: 'Modules' },
  { id: 'how', section: 'packaging', label: 'How it fits' },
  { id: 'pricing', section: 'pricing', label: 'Pricing' },
  { id: 'roi', section: 'roi', label: 'ROI' },
  { id: 'industries', section: 'industries', label: 'Industries' },
] as const;

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page }) => {
  page.setDefaultNavigationTimeout(60_000);
  page.setDefaultTimeout(20_000);
});

async function clickMatching(scope: Locator, section?: string, href?: string) {
  const link = section
    ? scope.locator(`a[data-nav-section="${section}"]`)
    : scope.locator(`a[href="${href}"]`);
  const visible = link.filter({ visible: true });
  if (await visible.count()) {
    await visible.first().click();
    return true;
  }
  return false;
}

async function clickNav(page: Page, target: { section?: string; href?: string }) {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });

  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (await clickMatching(page.locator('[data-landing-nav] nav'), target.section, target.href)) return;

    const more = page.locator('[data-top-nav-item="more"]');
    if (await more.isVisible()) {
      try {
        await more.click({ timeout: 3_000 });
        const menu = page.locator('[data-top-nav-more-menu]');
        await expect(menu).toBeVisible({ timeout: 3_000 });
        if (await clickMatching(menu, target.section, target.href)) return;
      } catch {
        // The bar remeasures after fonts load and may drop More.
      }
    } else {
      const openMenu = page.getByRole('button', { name: 'Open menu' });
      if (await openMenu.isVisible()) {
        await openMenu.click();
        const dialog = page.getByRole('dialog', { name: 'Site menu' });
        await expect(dialog).toBeVisible();
        if (await clickMatching(dialog, target.section, target.href)) return;
      }
    }

    await page.waitForTimeout(200);
  }

  throw new Error(`Navbar link not found for ${target.section ?? target.href}`);
}

async function expectSectionInView(page: Page, section: string) {
  await expect
    .poll(
      async () =>
        page.evaluate((sectionId) => {
          const nodes = Array.from(document.querySelectorAll<HTMLElement>(`[id="${sectionId}"]`));
          const el = nodes.find((node) => !node.hasAttribute('data-sa-anchor-placeholder'));
          const header = document.querySelector('[data-landing-nav]');
          const headerBottom = header ? header.getBoundingClientRect().bottom : 0;
          if (!el) return { ok: false, reason: 'missing', headerBottom };
          const rect = el.getBoundingClientRect();
          const delta = rect.top - headerBottom;
          const ok =
            rect.height > 40 &&
            delta >= -6 &&
            delta <= 32 &&
            rect.bottom > headerBottom + 40 &&
            rect.top < window.innerHeight;
          return {
            ok,
            reason: ok ? 'in-view' : 'misaligned',
            delta: Math.round(delta),
            height: Math.round(rect.height),
            top: Math.round(rect.top),
            headerBottom: Math.round(headerBottom),
          };
        }, section),
      { timeout: 45_000, intervals: [100, 250, 500] }
    )
    .toMatchObject({ ok: true });
}

async function expectMenuClosed(page: Page) {
  await expect(page.getByRole('dialog', { name: 'Site menu' })).toBeHidden();
}

test.describe('homepage navbar anchors', () => {
  test('desktop clicks land on each section and Demo', async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });

    for (const link of SECTIONS) {
      await page.goto('/');
      await expect(page.locator('[data-landing-nav]')).toBeVisible();
      await clickNav(page, { section: link.section });
      await expectSectionInView(page, link.section);
      await expect(page).toHaveURL(new RegExp(`#${link.section}$`));
    }

    await page.goto('/');
    await clickNav(page, { href: '/demo' });
    await expect(page).toHaveURL(/\/demo\/?$/);
    await expect(page.locator('main, [data-demo], h1').first()).toBeVisible();
  });

  test('mobile menu closes and lands on each section', async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 390, height: 844 });

    for (const link of SECTIONS) {
      await page.goto('/');
      await expect(page.locator('[data-landing-nav]')).toBeVisible();
      await clickNav(page, { section: link.section });
      await expectMenuClosed(page);
      await expectSectionInView(page, link.section);
    }

    await page.goto('/');
    await clickNav(page, { href: '/demo' });
    await expectMenuClosed(page);
    await expect(page).toHaveURL(/\/demo\/?$/);
  });

  test('direct hash URLs and links from another page land on the section', async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1280, height: 900 });

    for (const link of SECTIONS) {
      await page.goto(`/#${link.section}`);
      await expectSectionInView(page, link.section);
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/demo');
    await clickNav(page, { section: 'pricing' });
    await expectMenuClosed(page);
    await expect(page).toHaveURL(/\/#pricing$/);
    await expectSectionInView(page, 'pricing');

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/industries');
    await clickNav(page, { section: 'roi' });
    await expect(page).toHaveURL(/\/#roi$/);
    await expectSectionInView(page, 'roi');
  });
});
