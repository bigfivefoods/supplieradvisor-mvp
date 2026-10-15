import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const out = resolve('docs/pr/brief-116');
mkdirSync(out, { recursive: true });
const base = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const csv = [
  'account number,debtor name,principal',
  'DEMO-900,Sample Debtor,1234.56',
  'DEMO-900,Sample Debtor,10.00',
  'DEMO-901,Other Debtor,not-money',
].join('\n');

const browser = await chromium.launch();
const page = await browser.newPage();

async function ready(url) {
  await page.goto(`${base}${url}`, { waitUntil: 'domcontentloaded' });
  const marker = page.locator('[data-book-ready="1"]');
  if (await marker.count()) await marker.waitFor({ timeout: 20000 });
}

async function save(name) {
  await page.screenshot({ path: resolve(out, name), fullPage: false });
}

async function both(name, url, act) {
  for (const [width, height] of [
    [1280, 800],
    [375, 812],
  ]) {
    await page.setViewportSize({ width, height });
    await ready(url);
    if (act) await act();
    await save(`${width}x${height}-${name}.png`);
  }
}

await both('creditors-list', '/preview/recovergraph/creditors?book=harbour&role=owner');
await both('creditors-empty', '/preview/recovergraph/creditors?book=empty&role=owner');
await both('creditors-drawer', '/preview/recovergraph/creditors?book=harbour&role=owner', async () => {
  await page.getByTestId('recover-creditor-add').click();
  await page.getByTestId('recover-creditor-drawer').waitFor();
});
await both('creditors-detail', '/preview/recovergraph/creditors?book=harbour&role=owner', async () => {
  await page.getByTestId('recover-creditor-open').first().click();
  await page.getByTestId('recover-creditor-detail').waitFor();
});
await both('mandates-list', '/preview/recovergraph/mandates?book=harbour&role=owner');
await both('mandates-empty', '/preview/recovergraph/mandates?book=empty&role=owner');
await both('mandates-drawer', '/preview/recovergraph/mandates?book=harbour&role=owner', async () => {
  await page.getByTestId('recover-mandate-add').click();
  await page.getByTestId('recover-mandate-drawer').waitFor();
});
await both('accounts-list', '/preview/recovergraph/accounts?book=harbour&role=owner');
await both('accounts-empty', '/preview/recovergraph/accounts?book=empty&role=owner');
await both('accounts-viewer', '/preview/recovergraph/accounts?book=harbour&role=viewer');
await both('account-stop', '/preview/recovergraph/account?book=harbour&role=owner', async () => {
  await page.getByTestId('recover-stop-banner').waitFor();
});
await both('account-reveal', '/preview/recovergraph/account?book=harbour&role=owner', async () => {
  await page.getByTestId('recover-reveal').click();
  await page.getByTestId('recover-reveal-prompt').waitFor();
});
await both('command-owner', '/preview/recovergraph?book=harbour&role=owner');
await both('command-owner-empty', '/preview/recovergraph?book=empty&role=owner');
await both('command-agent', '/preview/recovergraph?book=harbour&role=agent');
await both('command-agent-empty', '/preview/recovergraph?book=empty&role=agent');
await both('queue', '/preview/recovergraph/queue?book=harbour&role=owner');
await both('queue-empty', '/preview/recovergraph/queue?book=empty&role=owner');
await both('team', '/preview/recovergraph/team?book=harbour&role=owner', async () => {
  await page.locator('[data-testid="recover-reg-chip"]:visible').first().waitFor();
});
await both('sidebar', '/preview/recovergraph?book=nav&role=owner');
await both('app-owner-installed', '/preview/recovergraph/installed?book=harbour&role=owner', async () => {
  await page.getByTestId('recover-bottom-nav').waitFor();
});
await both('app-agent-installed', '/preview/recovergraph/installed?book=harbour&role=agent');

for (const [width, height] of [
  [1280, 800],
  [375, 812],
]) {
  await page.setViewportSize({ width, height });
  await ready('/preview/recovergraph/imports?reset=1&role=owner');
  await page.getByRole('button', { name: 'Continue' }).click();
  await save(`${width}x${height}-import-file.png`);
  await page.getByTestId('recover-csv').fill(csv);
  await page.getByRole('button', { name: 'Continue' }).click();
  await save(`${width}x${height}-import-map.png`);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Run dry run' }).click();
  await page.getByTestId('recover-dry-errors').waitFor();
  await save(`${width}x${height}-import-dry-run.png`);
  await ready('/preview/recovergraph/imports?reset=1&role=owner');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByTestId('recover-csv').fill('account number,debtor name,principal\nDEMO-900,Sample Debtor,1234.56\n');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Run dry run' }).click();
  await page.getByTestId('recover-dry-errors').waitFor();
  await page.getByTestId('recover-commit').click();
  await page.getByTestId('recover-commit-result').waitFor();
  await save(`${width}x${height}-import-committed.png`);
  await page.getByTestId('recover-rollback-upload').click();
  await save(`${width}x${height}-import-rollback.png`);
}

for (const [name, url] of [
  ['app-owner-browser', '/work/recovergraph'],
  ['app-crew-browser', '/crew/recovergraph/abcdefgh'],
  ['app-customer-browser', '/customer/recovergraph/abcdefgh'],
]) {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`${base}${url}`, { waitUntil: 'domcontentloaded' });
  await page.getByText('RecoverAdvisor®').first().waitFor();
  await save(`375x812-${name}.png`);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.screenshot({ path: resolve(out, `1280x800-${name}.png`), fullPage: false });
}

await page.setViewportSize({ width: 1280, height: 800 });
await page.goto(`${base}/preview/tradegraph`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(800);
await save('1280x800-tradeadvisor-preview.png');
await page.goto(`${base}/preview/constructiongraph`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(800);
await save('1280x800-constructionadvisor-preview.png');

for (const [width, height, tag] of [
  [1280, 900, '1280'],
  [768, 1024, '768'],
  [375, 812, '375'],
]) {
  await page.setViewportSize({ width, height });
  const views = [
    ['creditors', '/preview/recovergraph/creditors?book=harbour&role=owner'],
    ['mandates', '/preview/recovergraph/mandates?book=harbour&role=owner'],
    ['accounts', '/preview/recovergraph/accounts?book=harbour&role=owner'],
    ['imports', '/preview/recovergraph/imports?book=harbour&role=owner'],
    ['team', '/preview/recovergraph/team?book=harbour&role=owner'],
    ['account', '/preview/recovergraph/account?book=harbour&role=owner'],
  ];
  for (const [name, url] of views) {
    await ready(url);
    if (name === 'team') {
      await page.getByTestId('recover-staff-table').scrollIntoViewIfNeeded();
    }
    if (name === 'account') {
      await page.getByTestId('recover-stop-flag').scrollIntoViewIfNeeded();
    }
    const wide = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    if (wide) throw new Error(`${tag}-${name} overflows horizontally`);
    await save(`${tag}-${name}.png`);
  }
}

await browser.close();
console.log('shots written', out);
