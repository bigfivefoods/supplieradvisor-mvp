import { expect, test, type Page } from '@playwright/test';

const widths = [
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
] as const;

const steps = ['creditor', 'mandate', 'placement', 'trace', 'contact', 'arrangement', 'payment', 'escalate', 'remit', 'report'];

function watch(page: Page) {
  const errors: string[] = [];
  const alien: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const base = new URL(process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000');
  const loopback = (host: string) => host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
  page.on('request', (request) => {
    const url = new URL(request.url());
    const current = page.url();
    const here = current && current !== 'about:blank' ? new URL(current).origin : '';
    const sameApp =
      url.origin === base.origin ||
      url.origin === here ||
      (loopback(url.hostname) && loopback(base.hostname) && url.port === (base.port || '80'));
    if (sameApp) return;
    if (url.origin === 'https://va.vercel-scripts.com' || url.origin === 'https://vercel.live') return;
    alien.push(url.origin);
  });
  return { errors, alien };
}

async function placedCount(page: Page) {
  const text = await page.getByTestId('recover-flow-step-placement').innerText();
  const match = text.match(/(\d[\d\u00a0\u202f\s]*)\s+placed/);
  expect(match, text).toBeTruthy();
  return Number(String(match?.[1] || '').replace(/[\u00a0\u202f\s]/g, ''));
}

async function openFlow(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator('[data-book-ready="1"]')).toBeVisible();
  const flow = page.locator('#recover-process-flow');
  await flow.scrollIntoViewIfNeeded();
  const toggle = page.getByTestId('recover-flow-toggle');
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  return flow;
}

test.describe('RecoverAdvisor process flow preview', () => {
  test('fits the command card and keeps links inside the preview', async ({ page }) => {
    test.setTimeout(90_000);
    const guard = watch(page);
    await page.route('https://va.vercel-scripts.com/**', (route) => route.abort());
    await page.route('https://vercel.live/**', (route) => route.abort());

    for (const size of widths) {
      await page.setViewportSize(size);
      const flow = await openFlow(page, '/preview/recovergraph?book=harbour&role=owner');
      const toggle = page.getByTestId('recover-flow-toggle');
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      for (const id of steps) await expect(page.getByTestId(`recover-flow-step-${id}`)).toBeVisible();
      const scroll = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
      expect(scroll).toBe(true);
      const box = await flow.boundingBox();
      expect(box).toBeTruthy();
      expect(box!.x).toBeGreaterThanOrEqual(-1);
      expect(box!.x + box!.width).toBeLessThanOrEqual(size.width + 1);
      await page.screenshot({ path: `test-results/process-flow-${size.width}.png`, fullPage: true });
      await page.screenshot({ path: `docs/pr/brief-117/command-owner-harbour-${size.width}.png`, fullPage: true });
    }

    await page.setViewportSize({ width: 1280, height: 800 });
    await openFlow(page, '/preview/recovergraph?book=harbour&role=owner');
    await page.getByRole('link', { name: /Import and placement of accounts/ }).click();
    await expect(page).toHaveURL(/\/preview\/recovergraph\/imports\?/);
    expect(page.url()).toContain('role=owner');
    expect(page.url()).toContain('book=harbour');
    await openFlow(page, '/preview/recovergraph?book=harbour&role=owner');
    await page.getByRole('link', { name: /Promise to pay and payment arrangement/ }).click();
    await expect(page).toHaveURL(/\/preview\/recovergraph\/accounts\?/);
    expect(page.url()).toContain('state=arrangement');
    expect(page.url()).toContain('book=harbour');
    await expect(page.getByLabel('State')).toHaveValue('arrangement');
    for (const id of ['contact', 'remit', 'report']) {
      await expect(page.getByTestId(`recover-flow-step-${id}`).locator('a')).toHaveCount(0);
    }

    await page.goto('/preview/recovergraph?book=harbour&role=owner');
    await page.getByTestId('recover-flow-toggle').focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    const outline = await page.evaluate(() => {
      const style = getComputedStyle(document.activeElement || document.body);
      return Number.parseFloat(style.outlineWidth || '0');
    });
    expect(outline).toBeGreaterThan(0);
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/preview\/recovergraph\//);

    expect(guard.errors).toEqual([]);
    expect(guard.alien).toEqual([]);
  });

  test('hides workspace totals from an agent and a viewer', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openFlow(page, '/preview/recovergraph?book=harbour&role=agent');
    const agentFlow = page.locator('#recover-process-flow');
    await expect(agentFlow.getByText(/\d[\d\s]* creditors/)).toHaveCount(0);
    await expect(agentFlow.getByText(/\d[\d\s]* mandates/)).toHaveCount(0);
    await expect(agentFlow.locator('a[href*="/creditors"]')).toHaveCount(0);
    await expect(agentFlow.locator('a[href*="/mandates"]')).toHaveCount(0);
    await expect(agentFlow.locator('a[href*="/imports"]')).toHaveCount(0);
    await expect(agentFlow.locator('a[href*="/settings"]')).toHaveCount(0);
    await page.screenshot({ path: 'test-results/process-flow-agent-1280.png', fullPage: true });

    await openFlow(page, '/preview/recovergraph?book=harbour&role=viewer');
    const viewerFlow = page.locator('#recover-process-flow');
    await expect(viewerFlow.getByText(/assigned ·/)).toHaveCount(0);
    await expect(viewerFlow.getByText(/in arrangement/)).toHaveCount(0);
    await expect(viewerFlow.locator('a[href*="/imports"]')).toHaveCount(0);
    await expect(viewerFlow.getByText(/\d[\d\s]* placed/)).toBeVisible();
    await page.screenshot({ path: 'test-results/process-flow-viewer-1280.png', fullPage: true });

    await openFlow(page, '/preview/recovergraph?book=empty&role=owner');
    await expect(page.getByText('No creditors yet')).toBeVisible();
    await expect(page.getByText('Nothing placed yet')).toBeVisible();
    await page.screenshot({ path: 'test-results/process-flow-empty-1280.png', fullPage: true });
  });

  test('moves the placed count when a Harbour file is imported and rolled back', async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1280, height: 800 });
    await openFlow(page, '/preview/recovergraph?reset=1&role=owner');
    const before = await placedCount(page);
    await page.goto('/preview/recovergraph/imports?book=harbour&role=owner');
    await expect(page.locator('[data-book-ready="1"]')).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByTestId('recover-csv').fill('account number,debtor name,principal\nDEMO-900,Sample Debtor,1234.56\n');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Run dry run' }).click();
    await expect(page.getByTestId('recover-dry-errors')).toBeVisible();
    await page.getByTestId('recover-commit').click();
    await expect(page.getByTestId('recover-commit-result')).toBeVisible();
    await openFlow(page, '/preview/recovergraph?book=harbour&role=owner');
    expect(await placedCount(page)).toBe(before + 1);
    await page.goto('/preview/recovergraph/imports?book=harbour&role=owner');
    await page.getByTestId('recover-rollback-upload').click();
    await page.getByTestId('recover-confirm').getByRole('button', { name: 'Confirm' }).click();
    await openFlow(page, '/preview/recovergraph?book=harbour&role=owner');
    expect(await placedCount(page)).toBe(before);
  });

  test('saves the sample command at phone, tablet, and desktop', async ({ page }) => {
    for (const size of widths) {
      await page.setViewportSize(size);
      await openFlow(page, '/preview/recovergraph?role=owner');
      const scroll = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
      expect(scroll).toBe(true);
      await page.screenshot({ path: `docs/pr/brief-117/command-owner-sample-${size.width}.png`, fullPage: true });
    }
  });
});
