/**
 * TradeAdvisor® quote → job → invoice, compliance, and customer scope.
 * Run: npx --yes tsx lib/trades/tradegraph.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  SA_VAT_RATE,
  TRADE_DEMO_COMPANY_ID,
  acceptQuote,
  addJobUpdate,
  complianceReminders,
  createJobRequest,
  customerPortalView,
  emptyTradeStore,
  formatZar,
  invoiceJob,
  quoteTotals,
  recordPayment,
  requestToQuote,
  portalFromRows,
  seedDemoTradegraph,
  shouldSeedDemoAccount,
  summariseTradegraph,
} from './tradegraph';

const now = '2026-10-14T08:00:00.000Z';
const today = '2026-10-14';

const lines = [
  { id: 'l1', description: 'Labour', qty: 1, unit_cents: 240_000 },
  { id: 'l2', description: 'Board', qty: 1, unit_cents: 315_000 },
];
const totals = quoteTotals(lines, SA_VAT_RATE);
assert.equal(totals.subtotal_cents, 555_000);
assert.equal(totals.vat_cents, 83_250);
assert.equal(totals.total_cents, 638_250);
assert.equal(formatZar(totals.total_cents), 'R6 382.50');
assert.equal(formatZar(-200_000), '-R2 000.00');

let store = emptyTradeStore(now, 'tg_test');
store = {
  ...store,
  customers: [
    {
      id: 'tc_a',
      name: 'Thandi Nkosi',
      email: 'thandi@example.com',
      phone: '',
      address: '14 Balfour Road',
      suburb: 'Rondebosch',
      city: 'Cape Town',
    },
    {
      id: 'tc_b',
      name: 'Sipho Dlamini',
      email: 'sipho@example.com',
      phone: '',
      address: '8 Voortrekker Road',
      suburb: 'Bellville',
      city: 'Cape Town',
    },
  ],
  quotes: [
    {
      id: 'tq_1',
      number: 'Q-1',
      customer_id: 'tc_a',
      status: 'sent',
      title: 'DB board',
      lines,
      source_request_id: null,
      created_at: now,
    },
  ],
};

store = acceptQuote(store, 'tq_1', now);
assert.equal(store.quotes[0]!.status, 'accepted');
assert.equal(store.jobs.length, 1);
assert.equal(store.jobs[0]!.customer_id, 'tc_a');
assert.equal(store.jobs[0]!.lines.length, 2);
assert.notEqual(store.jobs[0]!.lines[0]!.id, lines[0]!.id);

store = addJobUpdate(
  store,
  store.jobs[0]!.id,
  {
    note: 'Cover is off.',
    progress_pct: 40,
    photo_url: null,
    shared: true,
  },
  now
);
store = addJobUpdate(
  store,
  store.jobs[0]!.id,
  {
    note: 'Internal snag.',
    progress_pct: 40,
    photo_url: null,
    shared: false,
  },
  now
);
assert.equal(store.jobs[0]!.status, 'in_progress');

store = invoiceJob(store, store.jobs[0]!.id, now);
assert.equal(store.invoices.length, 1);
assert.equal(store.invoices[0]!.total_cents, 638_250);
assert.equal(store.jobs[0]!.status, 'invoiced');
const again = invoiceJob(store, store.jobs[0]!.id, now);
assert.equal(again.invoices.length, 1);

store = recordPayment(store, store.invoices[0]!.id, 200_000, 'EFT', now);
assert.equal(store.invoices[0]!.status, 'part_paid');
assert.throws(
  () => recordPayment(store, store.invoices[0]!.id, 500_000, 'EFT', now),
  /more than the balance/
);

store = createJobRequest(store, {
  customer_id: 'tc_a',
  description: 'Outside light trips after rain.',
  address: '14 Balfour Road',
  preferred_dates: 'Wednesday',
  now,
});
store = requestToQuote(store, store.requests[0]!.id, now);
assert.equal(store.requests[0]!.status, 'quoted');
assert.equal(store.quotes.some((row) => row.status === 'draft'), true);

const portal = customerPortalView(store, 'tc_a');
assert.equal(portal.customer.name, 'Thandi Nkosi');
assert.equal(portal.jobs.length, 1);
assert.equal(portal.jobs[0]!.updates.length, 1);
assert.match(portal.jobs[0]!.updates[0]!.note, /Cover is off/);
assert.equal(portal.quotes.some((row) => row.status === 'draft'), false);
assert.equal(portal.balance_cents, 638_250 - 200_000);
assert.equal(
  portal.jobs.some((job) => job.customer_id !== 'tc_a') ||
    portal.quotes.some((quote) => quote.customer_id !== 'tc_a'),
  false
);
assert.throws(() => customerPortalView(store, 'missing'), /not found/);

const alerts = complianceReminders(
  [
    {
      id: 'a',
      kind: 'coc',
      number: 'COC-1',
      holder: 'Harbour',
      expires_on: '2026-11-01',
      job_id: null,
    },
    {
      id: 'b',
      kind: 'pirb',
      number: 'PIRB-1',
      holder: 'Jacobs',
      expires_on: '2026-10-05',
      job_id: null,
    },
    {
      id: 'c',
      kind: 'gas',
      number: 'GAS-1',
      holder: 'Harbour',
      expires_on: '2027-11-01',
      job_id: null,
    },
  ],
  today
);
assert.deepEqual(
  alerts.map((row) => row.level),
  ['overdue', 'due']
);
assert.equal(alerts[0]!.kind, 'pirb');

const demo = seedDemoTradegraph(now);
const thandi = customerPortalView(demo, 'tc_demo_thandi');
assert.equal(thandi.jobs[0]!.updates.length, 1);
assert.equal(thandi.quotes.length, 1);
assert.equal(thandi.quotes[0]!.status, 'accepted');
assert.ok(thandi.balance_cents > 0);
assert.equal(customerPortalView(demo, 'tc_demo_sipho').quotes.length, 1);
const summary = summariseTradegraph(demo, today);
assert.equal(summary.compliance_alerts, 2);
assert.equal(summary.new_requests, 1);
assert.equal(formatZar(demo.invoices[0]!.total_cents).startsWith('R'), true);

assert.equal(shouldSeedDemoAccount({ companyId: TRADE_DEMO_COMPANY_ID }), true);
assert.equal(
  shouldSeedDemoAccount({ companyId: 12, tradingName: 'Harbour Demo Co' }),
  true
);
assert.equal(shouldSeedDemoAccount({ companyId: 12, tradingName: 'Harbour Trades' }), false);

const leaked = portalFromRows({
  brand: demo.settings,
  customer: demo.customers[0],
  jobs: demo.jobs,
  quotes: demo.quotes,
  invoices: demo.invoices,
  payments: demo.payments,
  requests: demo.requests,
});
assert.equal(leaked.customer.id, 'tc_demo_thandi');
assert.ok(leaked.quotes.every((row) => row.customer_id === 'tc_demo_thandi'));
assert.equal(leaked.jobs[0]!.updates.some((row) => row.shared === false), false);

const sql = readFileSync(
  resolve('supabase/migrations/20261014_tradegraph.sql'),
  'utf8'
);
const tables = [...sql.matchAll(/CREATE TABLE IF NOT EXISTS public\.(\w+)/g)].map(
  (match) => match[1]!
);
assert.ok(tables.length >= 12, `expected trade tables, got ${tables.length}`);
assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
assert.match(sql, /FORCE ROW LEVEL SECURITY/);
assert.match(sql, /REVOKE ALL ON TABLE public\.%I FROM PUBLIC, anon, authenticated/);
for (const table of tables) {
  assert.match(sql, new RegExp(`'${table}'`));
}
assert.match(sql, /NOBYPASSRLS/);
assert.doesNotMatch(sql, /SET LOCAL ROLE/);
assert.doesNotMatch(sql, /RESET ROLE/);
assert.match(sql, /SET search_path = public, extensions/);
assert.match(sql, /c\.id = v_customer AND c\.company_id = v_company/);
assert.match(sql, /job\.customer_id = v_customer/);
assert.match(sql, /job\.company_id = v_company/);
assert.match(sql, /u\.shared = true/);
assert.match(sql, /quote\.status <> 'draft'/);
assert.match(sql, /job\.status <> 'cancelled'/);
assert.match(sql, /i\.status <> 'void'/);
assert.doesNotMatch(sql, /GRANT SELECT ON TABLE public\.trade_jobs TO anon/);
assert.doesNotMatch(sql, /USING \(true\)/);

const customerPage = readFileSync(
  resolve('components/trades/CustomerTradeApp.tsx'),
  'utf8'
);
assert.doesNotMatch(customerPage, /@privy-io|usePrivy|useCompanyRole/);
const sw = readFileSync(resolve('public/sw.js'), 'utf8');
assert.match(sw, /trade-customer-offline\.html/);
assert.match(sw, /\/customer\/tradegraph/);

console.log('tradegraph.test.ts ok');
