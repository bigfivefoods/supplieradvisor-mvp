import { expect, test } from '@playwright/test';

test('sample project, programme, variation, diary, and site manager', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/preview/constructiongraph?reset=1');
  await expect(page.locator('[data-book-ready="1"]')).toBeVisible();
  await expect(page.getByTestId('command-view')).toBeVisible();
  await expect(page.getByText('ConstructionAdvisor®').first()).toBeVisible();
  await expect(page.getByText('Sample').first()).toBeVisible();

  await page.goto('/preview/constructiongraph/sites');
  await expect(page.locator('[data-book-ready="1"]')).toBeVisible();
  await page.getByTestId('project-add').click();
  await page.getByTestId('project-name').fill('E2E Sample Cottage');
  await page.getByTestId('project-code').fill('E2E-01');
  await page.getByTestId('project-save').click();
  await expect(page.getByText('E2E Sample Cottage')).toBeVisible();

  await page.goto('/preview/constructiongraph/programme');
  await page.getByTestId('programme-add').click();
  await page.getByTestId('programme-activity').fill('E2E follow-on');
  await page.getByTestId('programme-depends').selectOption({ index: 1 });
  await page.getByTestId('programme-save').click();
  await expect(page.getByText('E2E follow-on')).toBeVisible();

  await page.goto('/preview/constructiongraph/variations');
  await page.getByTestId('variation-add').click();
  await page.getByTestId('variation-title').fill('E2E extra days');
  await page.getByTestId('variation-days').fill('2');
  await page.getByTestId('variation-save').click();
  await page.getByTestId('variation-approve').click();
  await page.goto('/preview/constructiongraph/programme');
  await expect(page.getByTestId('gantt-eot').first()).toBeVisible();

  await page.goto('/preview/constructiongraph/diary');
  await page.getByTestId('diary-start').click();
  await page.getByTestId('diary-progress').fill('E2E footing check');
  await page.getByTestId('diary-signoff').click();
  await expect(page.getByTestId('diary-locked')).toBeVisible();

  await page.goto('/preview/constructiongraph/safety');
  await page.getByTestId('safety-toolbox-title').fill('E2E toolbox');
  await page.getByTestId('safety-toolbox-add').click();
  await expect(page.getByText('E2E toolbox')).toBeVisible();

  await page.goto('/preview/constructiongraph?role=site_manager');
  await expect(page.locator('[data-book-ready="1"]')).toBeVisible();
  await expect(page.getByTestId('site-action-bar')).toBeHidden();
  await page.goto('/preview/constructiongraph/payments?role=site_manager');
  await expect(page.getByTestId('payments-unavailable')).toBeVisible();
});

test('mobile sample keeps the bottom actions and no second sidebar', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/preview/constructiongraph?reset=1&role=site_manager');
  await expect(page.locator('[data-book-ready="1"]')).toBeVisible();
  await expect(page.getByTestId('site-action-bar')).toBeVisible();
  await expect(page.locator('aside')).toHaveCount(0);
  await page.goto('/preview/constructiongraph/work');
  await expect(page.getByTestId('work-nav')).toBeVisible();
});
