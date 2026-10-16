import { expect, test, type Page } from '@playwright/test';

const widths = [375, 768, 1280] as const;

const flows = [
  {
    id: 'tradegraph',
    path: '/preview/tradegraph',
    live: /\/preview\/tradegraph\/customers$/,
  },
  {
    id: 'constructiongraph',
    path: '/preview/constructiongraph?role=owner',
    live: /\/preview\/constructiongraph\/clients\?role=owner$/,
  },
] as const;

function ignoreConsole(text: string): boolean {
  return /favicon|Download the React DevTools|Failed to load resource: the server responded with a status of 404|eval\(\) is not supported|_vercel\/(?:speed-insights|insights)\/script\.js/.test(text);
}

async function noHorizontalOverflow(page: Page) {
  const box = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(box.scrollWidth).toBeLessThanOrEqual(box.clientWidth + 1);
}

for (const width of widths) {
  for (const flow of flows) {
    test(`${flow.id} process flow at ${width}px`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error' && !ignoreConsole(message.text())) errors.push(message.text());
      });
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
      await expect(section.locator('a[aria-disabled="true"]')).toHaveCount(0);
      const soon = section.locator('[data-flow-state="soon"]');
      const soonCount = await soon.count();
      for (let index = 0; index < soonCount; index += 1) {
        await expect(soon.nth(index).locator('a')).toHaveCount(0);
      }
      const step = section.getByRole('link', { name: /^Step 1,/ });
      await step.click();
      await expect(page).toHaveURL(flow.live);
      expect(errors).toEqual([]);
    });
  }
}
