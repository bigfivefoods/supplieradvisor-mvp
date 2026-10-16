import { expect, test, type Page } from '@playwright/test';

const widths = [375, 768, 1280] as const;

const flows = [
  {
    id: 'tradegraph',
    path: '/preview/tradegraph',
    live: /\/preview\/tradegraph\/customers$/,
    step: /Customers and sites/,
  },
  {
    id: 'constructiongraph',
    path: '/preview/constructiongraph?role=owner',
    live: /\/preview\/constructiongraph\/clients\?role=owner$/,
    step: /Clients/,
  },
] as const;

const TOOLBAR_REDIRECT = 'The script resource is behind a redirect, which is disallowed.';

function ignoreConsole(text: string): boolean {
  if (text.includes('vercel.live') && text.includes('Content Security Policy')) return true;
  if (text.includes(TOOLBAR_REDIRECT)) return true;
  return /favicon|Download the React DevTools|Failed to load resource: the server responded with a status of 404|eval\(\) is not supported|_vercel\/(?:speed-insights|insights)\/script\.js/.test(
    text
  );
}

async function blockPreviewToolbar(page: Page) {
  await page.route('https://vercel.live/**', (route) => route.abort());
}

async function noHorizontalOverflow(page: Page) {
  const box = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(box.scrollWidth).toBeLessThanOrEqual(box.clientWidth + 1);
}

let axeSourcePromise: Promise<string> | null = null;

async function getAxeSource() {
  if (!axeSourcePromise) {
    axeSourcePromise = (async () => {
      const urls = [
        'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js',
        'https://cdn.jsdelivr.net/npm/axe-core@4.10.2/axe.min.js',
        'https://unpkg.com/axe-core@4.10.2/axe.min.js',
      ];
      for (const url of urls) {
        try {
          const response = await fetch(url);
          if (response.ok) return response.text();
        } catch {
          // Try the next mirror.
        }
      }
      return '';
    })();
  }
  return axeSourcePromise;
}

async function assertFlowAxe(page: Page, moduleId: string) {
  const axeSource = await getAxeSource();
  expect(axeSource.length).toBeGreaterThan(0);
  await page.addScriptTag({ content: axeSource });
  const violations = await page.evaluate(async (id) => {
    const root = document.querySelector(`[data-testid="advisor-flow-${id}"]`);
    const axeRef = (
      window as unknown as {
        axe?: {
          run: (
            context: Element
          ) => Promise<{ violations: Array<{ id: string; impact: string | null; help: string }> }>;
        };
      }
    ).axe;
    if (!axeRef || !root) return [{ id: 'axe-missing', impact: 'critical', help: 'axe or the flow was missing' }];
    const result = await axeRef.run(root);
    return result.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
    }));
  }, moduleId);
  const serious = violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical');
  expect(serious).toEqual([]);
}

for (const width of widths) {
  for (const flow of flows) {
    test(`${flow.id} process flow at ${width}px`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error' && !ignoreConsole(message.text())) errors.push(message.text());
      });
      await blockPreviewToolbar(page);
      await page.setViewportSize({ width, height: 900 });
      await page.goto(flow.path);
      const section = page.getByTestId(`advisor-flow-${flow.id}`);
      await expect(section).toBeVisible();
      await expect(section).toHaveAttribute('data-flow-ready', '1');
      const toggle = section.getByTestId('advisor-flow-toggle');
      await expect(toggle).toBeVisible();
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      const panel = section.locator(`#${flow.id}-process-flow-panel`);
      await expect(panel).toBeVisible();
      await toggle.focus();
      await page.keyboard.press('Enter');
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await page.keyboard.press(' ');
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      await noHorizontalOverflow(page);
      await expect(section.locator('[aria-label]')).toHaveCount(0);
      await expect(section.locator('a[aria-disabled="true"]')).toHaveCount(0);
      await assertFlowAxe(page, flow.id);
      const soon = section.locator('[data-flow-state="soon"]');
      const soonCount = await soon.count();
      for (let index = 0; index < soonCount; index += 1) {
        await expect(soon.nth(index).locator('a')).toHaveCount(0);
      }
      const step = section.getByRole('link', { name: flow.step }).first();
      await step.click();
      await expect(page).toHaveURL(flow.live);
      expect(errors).toEqual([]);
    });
  }
}
