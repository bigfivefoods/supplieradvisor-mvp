import { expect, test } from '@playwright/test';

async function ready(page: import('@playwright/test').Page) {
  await page.goto('/preview/tradegraph?reset=1');
  await expect(page.locator('[data-book-ready="1"]')).toBeVisible();
}

test('job, quote, client accept, gantt, variation, invoice, pay link', async ({ page }) => {
  await ready(page);
  await page.goto('/preview/tradegraph/board');
  await expect(page.getByTestId('job-board')).toBeVisible();
  await page.getByTestId('new-job').click();
  await page.getByTestId('job-title').fill('E2E basin tap');
  await page.getByTestId('job-save').click();
  await expect(page.getByRole('link', { name: /E2E basin tap/ })).toBeVisible();

  await page.goto('/preview/tradegraph/quote');
  await page.getByTestId('quote-title').fill('E2E basin quote');
  const jobSelect = page.getByTestId('quote-job');
  const jobValue = await jobSelect.locator('option', { hasText: 'E2E basin tap' }).getAttribute('value');
  await jobSelect.selectOption(jobValue || '');
  await page.getByTestId('price-pb_call').click();
  await page.getByTestId('price-pb_hour').click();
  await page.getByRole('button', { name: 'Make optional' }).first().click();
  await page.getByTestId('quote-save').click();
  await expect(page.getByText('E2E basin quote')).toBeVisible();
  await page.getByRole('button', { name: 'Send to customer' }).first().click();

  await page.goto('/customer/tradegraph/demo?as=tc_naledi');
  await expect(page.getByTestId('role-client')).toBeVisible();
  await page.getByRole('button', { name: 'Quotes' }).first().click();
  await page.getByTestId('sign-name').fill('Naledi Petersen');
  const card = page.getByTestId('quote-card').filter({ hasText: 'E2E basin quote' });
  await card.getByTestId('accept-quote').click();
  await page.getByRole('button', { name: 'Plan' }).first().click();
  await expect(page.getByTestId('client-gantt')).toBeVisible();

  await page.goto('/preview/tradegraph/board');
  await page.getByRole('link', { name: /E2E basin tap/ }).click();
  await page.getByTestId('vo-title').fill('Extra trap');
  await page.getByTestId('vo-scope').fill('Replace the bottle trap');
  await page.getByTestId('vo-save').click();
  await page.getByRole('button', { name: 'Send for signature' }).first().click();

  await page.goto('/customer/tradegraph/demo?as=tc_naledi');
  await page.getByRole('button', { name: 'Quotes' }).first().click();
  await page.getByTestId('sign-name').fill('Naledi Petersen');
  const vo = page.getByTestId('vo-card').filter({ hasText: 'Extra trap' });
  await vo.getByTestId('approve-vo').click();

  await page.goto('/preview/tradegraph/board');
  await page.getByRole('link', { name: /E2E basin tap/ }).click();
  await expect(page.getByText('VO-001 · Extra trap · approved')).toBeVisible();
  await page.getByTestId('invoice-final').click();
  await page.goto('/preview/tradegraph/invoices');
  const pay = page.locator('[data-testid^="pay-link-"]').last();
  await pay.click();
  const href = await page.locator('[data-testid^="pay-url-"]').last().getAttribute('href');
  expect(href).toContain('pay?invoice=');
  await page.goto(href || '/preview/tradegraph/pay');
  await expect(page.getByTestId('pay-ref')).toContainText('tg_');
  await expect(page.getByTestId('pay-amount')).toContainText('R');
});

test('owner, technician, and client apps', async ({ page }) => {
  await ready(page);
  await page.goto('/preview/tradegraph/work?role=owner');
  await expect(page.getByTestId('role-owner')).toBeVisible();
  await page.getByRole('button', { name: 'Money' }).first().click();
  await expect(page.getByTestId('money-panel')).toBeVisible();

  await page.goto('/crew/tradegraph/crew_lerato');
  await expect(page.getByTestId('role-technician')).toBeVisible();
  await expect(page.getByTestId('money-panel')).toHaveCount(0);
  await page.getByRole('button', { name: 'You' }).click();
  await expect(page.getByTestId('crew-time')).toBeVisible();

  await page.goto('/customer/tradegraph/demo?as=tc_naledi');
  await expect(page.getByTestId('role-client')).toBeVisible();
  await expect(page.getByTestId('money-panel')).toHaveCount(0);
  await page.getByRole('button', { name: 'More' }).first().click();
  await expect(page.getByTestId('request-job')).toBeVisible();
});
