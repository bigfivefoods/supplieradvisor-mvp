import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const widths = [375, 768, 1280] as const;
const AXE_FILE = join(process.cwd(), 'e2e/vendor/axe-core-4.10.2.min.js');
const AXE_SHA256 = 'b511cd9dec01c76f4b2ad1723b66b6db37d4c2eb4ed199076e1829d9ee7b75e3';
const AXE_BYTES = 553290;
const TOOLBAR_REDIRECT = 'The script resource is behind a redirect, which is disallowed.';

const flows = [
  {
    id: 'home',
    path: '/preview/dashboard',
    openStep: 'Raise a purchase order',
    live: /\/preview\/po$/,
    heading: 'Purchase orders',
    plain: 'Record the supplier bill',
  },
  {
    id: 'customers',
    path: '/preview/crm',
    openStep: 'Add and review customers',
    live: /\/preview\/crm\?screen=profiles$/,
    heading: 'Customer book',
    plain: 'Send a quote',
  },
] as const;

function ignoreConsole(text: string): boolean {
  if (text.includes('vercel.live') && text.includes('Content Security Policy')) return true;
  if (text.includes(TOOLBAR_REDIRECT)) return true;
  if (text.includes('Download the React DevTools')) return true;
  if (text.includes("eval() is not supported")) return true;
  if (/_vercel\/(?:speed-insights|insights)\/script\.js/.test(text)) return true;
  if (/favicon\.ico/.test(text) && text.includes('404')) return true;
  if (/manifest\.(?:webmanifest|json)/.test(text) && text.includes('404')) return true;
  return false;
}

function ignoreRequest(url: string): boolean {
  return (
    url.includes('vercel.live') ||
    url.includes('favicon') ||
    /manifest\.(?:webmanifest|json)/.test(url) ||
    /_vercel\/(?:speed-insights|insights)\//.test(url) ||
    url.startsWith('https://localhost')
  );
}

/** Preview-only noise. Same three signals the advisor run does not fail on. */
function ignorePreviewSignal(text: string): boolean {
  if (text.includes("Framing 'https://auth.privy.io/'") && text.includes('frame-ancestors')) return true;
  if (text.includes('auth.privy.io') && text.includes('/embedded-wallets') && text.includes('ERR_BLOCKED_BY_RESPONSE')) return true;
  if (text.includes('csp-report.browser-intake-datadoghq.com') && text.includes('ERR_BLOCKED_BY_ORB')) return true;
  return false;
}

function axeSource(): string {
  const bytes = readFileSync(AXE_FILE);
  const hash = createHash('sha256').update(bytes).digest('hex');
  if (bytes.length !== AXE_BYTES || hash !== AXE_SHA256) {
    throw new Error(`vendored axe-core failed the size or hash check (${bytes.length} ${hash})`);
  }
  return bytes.toString('utf8');
}

async function blockPreviewToolbar(page: Page) {
  await page.route('https://vercel.live/**', (route) => route.abort());
}

async function assertAxe(page: Page, id: string) {
  await page.addScriptTag({ content: axeSource() });
  const violations = await page.evaluate(async (moduleId) => {
    const root = document.querySelector(`[data-testid="advisor-flow-${moduleId}"]`);
    const axeRef = (window as unknown as { axe?: { run: (node: Element) => Promise<{ violations: Array<{ id: string; impact: string | null; help: string }> }> } }).axe;
    if (!axeRef || !root) return [{ id: 'axe-missing', impact: 'critical', help: 'axe or the flow was missing' }];
    const result = await axeRef.run(root);
    return result.violations.map((violation) => ({ id: violation.id, impact: violation.impact, help: violation.help }));
  }, id);
  expect(violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')).toEqual([]);
}

for (const width of widths) {
  for (const flow of flows) {
    test(`${flow.id} core process flow at ${width}px`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() !== 'error') return;
        const text = message.text();
        const url = message.location().url || '';
        if (ignoreConsole(text) || ignoreRequest(url) || ignoreRequest(text) || ignorePreviewSignal(text)) return;
        if (text.includes('ERR_SSL_PROTOCOL_ERROR')) return;
        if (/status of 404/.test(text) && url.includes('auth.privy.io') && url.includes('/embedded-wallets')) return;
        if (/status of 404/.test(text) && (url === '' || ignoreRequest(url))) return;
        errors.push(url ? `${text} @ ${url}` : text);
      });
      page.on('requestfailed', (request) => {
        const url = request.url();
        const reason = request.failure()?.errorText || '';
        const line = `${url} ${reason}`;
        if (ignoreRequest(url) || ignorePreviewSignal(line)) return;
        if (reason.includes('ERR_SSL_PROTOCOL_ERROR') || reason === 'net::ERR_ABORTED') return;
        errors.push(line);
      });
      await blockPreviewToolbar(page);
      await page.setViewportSize({ width, height: 900 });
      await page.goto(flow.path);
      const section = page.getByTestId(`advisor-flow-${flow.id}`);
      await expect(section).toBeVisible();
      await expect(section).toHaveAttribute('data-flow-ready', '1');
      const toggle = section.getByTestId('advisor-flow-toggle');
      await expect(toggle).toBeVisible();
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await expect(toggle).toHaveAttribute('aria-controls', `${flow.id}-process-flow-panel`);
      const panel = section.locator(`#${flow.id}-process-flow-panel`);
      await expect(panel).toHaveCount(1);
      await expect(panel).toBeHidden();
      await toggle.focus();
      await page.keyboard.press('Enter');
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      await expect(panel).toBeVisible();
      await page.keyboard.press(' ');
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await page.keyboard.press('Enter');
      await expect(panel).toBeVisible();
      const header = await section.locator('[data-flow-header]').evaluate((node) => {
        const style = getComputedStyle(node);
        return { color: style.color, backgroundColor: style.backgroundColor };
      });
      expect(header.color).toBe('rgb(15, 23, 42)');
      expect(header.backgroundColor).toBe('rgb(0, 180, 216)');
      const overflow = await page.evaluate(() => ({
        doc: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        section: document.querySelector('[data-testid^="advisor-flow-"]')
          ? (document.querySelector('[data-testid^="advisor-flow-"]') as HTMLElement).scrollWidth -
            (document.querySelector('[data-testid^="advisor-flow-"]') as HTMLElement).clientWidth
          : 1,
      }));
      expect(overflow.doc).toBe(0);
      expect(overflow.section).toBe(0);
      const short = await section.locator('a, button').evaluateAll((nodes) =>
        nodes.filter((node) => (node as HTMLElement).getBoundingClientRect().height < 40).map((node) => node.textContent || node.tagName)
      );
      expect(short).toEqual([]);
      await expect(section.locator('a', { hasText: flow.plain })).toHaveCount(0);
      await expect(section.getByRole('link', { name: flow.openStep })).toHaveCount(1);
      await expect(section.locator('[aria-label]')).toHaveCount(0);
      await assertAxe(page, flow.id);
      expect(errors).toEqual([]);
    });
  }
}

for (const flow of flows) {
  test(`${flow.id} mapped preview link opens the sample screen`, async ({ page }) => {
    await blockPreviewToolbar(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(flow.path);
    const section = page.getByTestId(`advisor-flow-${flow.id}`);
    await section.getByTestId('advisor-flow-toggle').click();
    await section.getByRole('link', { name: flow.openStep }).click();
    await expect(page).toHaveURL(flow.live);
    await expect(page.getByRole('heading', { name: flow.heading })).toBeVisible();
  });
}
