import { chromium } from 'playwright';
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const out = '/opt/cursor/artifacts/construction-screens';
const docs = resolve('docs/pr/brief-113');
mkdirSync(out, { recursive: true });
mkdirSync(docs, { recursive: true });
const base = 'http://localhost:3000';

const desk = [
  ['command', '/preview/constructiongraph?reset=1'],
  ['clients', '/preview/constructiongraph/clients'],
  ['quotes', '/preview/constructiongraph/quotes'],
  ['projects', '/preview/constructiongraph/sites'],
  ['programme', '/preview/constructiongraph/programme'],
  ['diary', '/preview/constructiongraph/diary'],
  ['subcontractors', '/preview/constructiongraph/subcontractors'],
  ['materials', '/preview/constructiongraph/materials'],
  ['payments', '/preview/constructiongraph/payments'],
  ['variations', '/preview/constructiongraph/variations'],
  ['certificates', '/preview/constructiongraph/certificates'],
  ['costs', '/preview/constructiongraph/costs'],
  ['safety', '/preview/constructiongraph/safety'],
  ['documents', '/preview/constructiongraph/drawings'],
  ['handover', '/preview/constructiongraph/handover'],
  ['reports', '/preview/constructiongraph/reports'],
  ['portal', '/preview/constructiongraph/portal'],
  ['work', '/preview/constructiongraph/work?role=owner&reset=1'],
  ['owner-app', '/preview/constructiongraph/work?role=owner&reset=1'],
  ['workers-app', '/preview/constructiongraph/work?role=workers&reset=1'],
  ['empty', '/preview/constructiongraph?empty=1&reset=1'],
  ['site-manager', '/preview/constructiongraph?role=site_manager&reset=1'],
  ['office', '/preview/constructiongraph?role=office&reset=1'],
  ['portal-client', '/preview/constructiongraph/portal?kind=client&reset=1'],
  ['client-app', '/preview/constructiongraph/portal?kind=client&reset=1'],
  ['portal-contractor', '/preview/constructiongraph/portal?kind=contractor&reset=1'],
  ['portal-public', '/preview/constructiongraph/portal?kind=public&reset=1'],
  ['offline', '/construction-offline.html'],
];

const trade = [
  ['trade-home', '/preview/tradegraph?reset=1'],
  ['trade-jobs', '/preview/tradegraph/board'],
  ['trade-gantt', '/preview/tradegraph/gantt'],
];

const browser = await chromium.launch();

{
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(base + '/preview/constructiongraph/programme?reset=1', { waitUntil: 'networkidle' });
  await page.getByTestId('gantt-chart').waitFor();
  const gantt = await page.getByTestId('gantt-chart').evaluate((chart) => {
    const box = chart.getBoundingClientRect();
    const bars = [...chart.querySelectorAll('[style*="width"]')].map((node) => {
      const rect = node.getBoundingClientRect();
      return { right: Math.round(rect.right), chart: Math.round(box.right), bleed: rect.right > box.right + 1 };
    });
    const milestone = chart.querySelector('[data-testid="gantt-milestone"]');
    const mark = milestone ? milestone.getBoundingClientRect() : null;
    return {
      bars,
      milestone: mark ? { width: Math.round(mark.width), height: Math.round(mark.height), inside: mark.left >= box.left - 1 && mark.right <= box.right + 1 && mark.width > 8 } : null,
    };
  });
  console.log('GANTT', JSON.stringify(gantt));
  if (gantt.bars.some((bar) => bar.bleed) || !gantt.milestone?.inside) {
    throw new Error('Gantt bar or milestone is outside the chart');
  }
  const payments = await page.locator('[data-testid="preview-sidebar"] a').evaluateAll((links) => links.map((link) => link.textContent || ''));
  console.log('NAV', payments.join(' | '));
  if (!payments.some((label) => label.includes('Payments')) || payments.some((label) => label.includes('Paymen…') || label.includes('...'))) {
    throw new Error('Section nav clips a label');
  }
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(base + '/preview/constructiongraph/work?role=owner&reset=1', { waitUntil: 'networkidle' });
  const ownerTitle = await page.locator('[data-testid="role-owner"] h1').evaluate((el) => ({
    text: el.textContent,
    overflow: getComputedStyle(el).textOverflow,
    client: el.clientWidth,
    scroll: el.scrollWidth,
  }));
  console.log('OWNER TITLE', JSON.stringify(ownerTitle));
  if (ownerTitle.text !== 'ConstructionAdvisor®' || ownerTitle.scroll > ownerTitle.client + 1) {
    throw new Error('Owner title is clipped');
  }
  await page.goto(base + '/preview/constructiongraph/portal?kind=client&reset=1', { waitUntil: 'networkidle' });
  const clientTitle = await page.locator('[data-testid="role-client"] h1').evaluate((el) => ({
    text: el.textContent,
    client: el.clientWidth,
    scroll: el.scrollWidth,
  }));
  const project = await page.getByTestId('client-projects').innerText();
  console.log('CLIENT TITLE', JSON.stringify(clientTitle));
  console.log('CLIENT PROJECT', project.replace(/\s+/g, ' '));
  if (clientTitle.text !== 'ConstructionAdvisor®' || clientTitle.scroll > clientTitle.client + 1) {
    throw new Error('Client title is clipped');
  }
  if (/on_site|48\.75|41\.25/.test(project)) throw new Error('Client project still shows raw status');
  await page.getByRole('button', { name: 'Money' }).click();
  const wallet = await page.getByTestId('client-money').innerText();
  console.log('CLIENT WALLET', wallet.replace(/\s+/g, ' '));
  if (wallet.includes('Paid R 0') || wallet.includes('R 0')) throw new Error('Client wallet still shows Paid R 0');
  if (!wallet.includes('Paid —') && !wallet.includes('Paid\n—')) throw new Error('Client wallet missing Paid dash');
  await page.close();
}

async function shoot(page, name, path, viewport) {
  await page.setViewportSize(viewport);
  const response = await page.goto(base + path, { waitUntil: 'networkidle', timeout: 60000 });
  if (path.includes('/preview/')) {
    await page.locator('[data-book-ready="1"], [data-testid="construction-preview"], body').first().waitFor({ timeout: 20000 });
    await page.waitForTimeout(400);
  }
  const file = `${out}/${viewport.width}x${viewport.height}-${name}.png`;
  await page.screenshot({ path: file, fullPage: true });
  console.log(response?.status(), file);
}

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 375, height: 812 },
]) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  for (const [name, path] of desk) {
    try {
      await shoot(page, name, path, viewport);
    } catch (error) {
      console.error('FAIL', name, error.message);
    }
  }
  const tag = `${viewport.width}x${viewport.height}`;
  try {
    await page.goto(base + '/preview/constructiongraph/work?role=owner&reset=1', { waitUntil: 'networkidle' });
    await page.getByTestId('role-owner').waitFor();
    await page.getByRole('button', { name: 'Team' }).click();
    await page.getByTestId('site-link-coming').waitFor();
    await page.screenshot({ path: `${out}/${tag}-owner-team.png`, fullPage: true });
    await page.getByRole('button', { name: 'Money' }).click();
    await page.getByTestId('money-panel').waitFor();
    await page.screenshot({ path: `${out}/${tag}-owner-money.png`, fullPage: true });
    await page.getByRole('button', { name: 'Plan' }).click();
    await page.getByTestId('owner-plan').waitFor();
    await page.screenshot({ path: `${out}/${tag}-owner-plan.png`, fullPage: true });
    console.log('owner tabs', tag);
  } catch (error) {
    console.error('FAIL owner tabs', error.message);
  }
  try {
    await page.goto(base + '/preview/constructiongraph/work?role=workers&reset=1', { waitUntil: 'networkidle' });
    await page.getByTestId('role-workers').waitFor();
    await page.getByRole('button', { name: 'You' }).click();
    await page.getByTestId('workers-money-hidden').waitFor();
    await page.screenshot({ path: `${out}/${tag}-workers-money.png`, fullPage: true });
    console.log('workers money', tag);
  } catch (error) {
    console.error('FAIL workers money', error.message);
  }
  try {
    await page.goto(base + '/preview/constructiongraph/portal?kind=client&reset=1', { waitUntil: 'networkidle' });
    await page.getByTestId('role-client').waitFor();
    await page.getByRole('button', { name: 'Money' }).click();
    await page.getByTestId('client-money').waitFor();
    await page.screenshot({ path: `${out}/${tag}-client-money.png`, fullPage: true });
    console.log('client money', tag);
  } catch (error) {
    console.error('FAIL client money', error.message);
  }
  if (viewport.width === 1280) {
    try {
      await page.goto(base + '/preview/constructiongraph/portal?reset=1', { waitUntil: 'networkidle' });
      await page.getByTestId('portal-issue-client').click();
      await page.getByTestId('portal-reveal').waitFor();
      await page.screenshot({ path: `${out}/1280x800-portal-reveal.png`, fullPage: true });
      console.log('reveal');
    } catch (error) {
      console.error('FAIL reveal', error.message);
    }
  }
  try {
    await page.goto(base + '/preview/constructiongraph/subcontractors?reset=1', { waitUntil: 'networkidle' });
    await page.getByTestId('subcontractors-table').locator('[data-row-id]').filter({ visible: true }).first().click();
    await page.getByTestId('site-link-coming').waitFor();
    await page.screenshot({ path: `${out}/${tag}-site-link.png`, fullPage: true });
    console.log('site link', tag);
  } catch (error) {
    console.error('FAIL site link', error.message);
  }
  await context.close();
}

const compare = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await compare.newPage();
for (const [name, path] of trade) {
  try {
    await shoot(page, name, path, { width: 1280, height: 800 });
  } catch (error) {
    console.error('FAIL', name, error.message);
  }
}
try {
  await page.setViewportSize({ width: 375, height: 812 });
  await shoot(page, 'trade-home', '/preview/tradegraph?reset=1', { width: 375, height: 812 });
} catch (error) {
  console.error('FAIL trade mobile', error.message);
}
try {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(base + '/dashboard/fitgraph', { waitUntil: 'networkidle', timeout: 60000 });
  await page.screenshot({ path: `${out}/1280x800-gym-gate.png`, fullPage: true });
  console.log('gym', page.url());
} catch (error) {
  console.error('FAIL gym', error.message);
}
await browser.close();

for (const name of readdirSync(out)) {
  if (!name.endsWith('.png')) continue;
  if (name.startsWith('1280x800-trade') || name.startsWith('375x812-trade') || name.includes('gym-gate')) continue;
  copyFileSync(`${out}/${name}`, `${docs}/${name}`);
}
console.log('copied screenshots into docs/pr/brief-113');
