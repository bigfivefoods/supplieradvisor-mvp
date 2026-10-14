/**
 * TradeAdvisor® jobs, quotes, Gantt plan vs actual, and variation orders.
 * Run: npx --yes tsx lib/trades/desk.test.ts
 */
import assert from 'node:assert/strict';
import { formatZar, quoteTotals } from './tradegraph';
import {
  applyTradeOp,
  boardCards,
  buildTradeIcs,
  customerPack,
  overdueInvoices,
  readGantt,
  sellCents,
  tradeReport,
  varianceDays,
  voRegister,
} from './desk';
import { seedHarbourBook } from './harbour-seed';
import { tradeClientCapabilities, tradePwaCapabilities } from './pwa-roles';
import { drainPhotoQueue, enqueuePhoto } from './offline-queue';

const now = '2026-10-14T08:00:00.000Z';
const book = seedHarbourBook(now);

assert.equal(book.store.settings.trade, 'plumber');
assert.equal(book.store.customers.length, 8);
assert.equal(book.desk.team.length, 3);
assert.equal(book.store.settings.vat_rate, 0.15);

const columns = new Set(boardCards(book).map((card) => card.column));
for (const column of ['enquiry', 'quoted', 'scheduled', 'in_progress', 'done', 'invoiced', 'paid']) {
  assert.ok(columns.has(column as never), `missing board column ${column}`);
}

const hour = book.desk.price_book.find((row) => row.id === 'pb_hour');
assert.ok(hour);
assert.equal(sellCents(hour!), Math.round(48_000 * 1.35));

const gantt = readGantt(
  book.desk.programmes.find((row) => row.job_id === 'tj_waste')!.tasks,
  '2026-10-14'
);
const fit = gantt.tasks.find((row) => row.id === 'gt_fit')!;
assert.ok(varianceDays(fit) > 0, 'fit task should be behind the locked plan');
assert.equal(gantt.current?.id, 'gt_fit');
assert.ok(gantt.delays.length >= 1);
assert.ok(gantt.tasks.some((row) => row.vo_number === 'VO-001'));

const register = voRegister(book, 'tj_waste');
assert.equal(register.approved_cents, 125_000);
assert.equal(register.revised_cents, register.original_cents + 125_000);
assert.equal(register.vat_cents, Math.round(register.revised_cents * 0.15));
assert.ok(register.orders.some((row) => row.number === 'VO-002' && row.status === 'sent'));

const naledi = customerPack(book, 'tc_naledi');
assert.equal(naledi.jobs.length >= 1, true);
assert.equal(naledi.jobs[0]!.updates.some((row) => row.shared === false), false);
assert.ok(naledi.variations.some((row) => row.number === 'VO-002'));
assert.equal(customerPack(book, 'tc_sipho').jobs.some((row) => row.id === 'tj_waste'), false);
assert.equal(customerPack(book, 'tc_sipho').programmes.some((row) => row.job_id === 'tj_waste'), false);

const report = tradeReport(book);
assert.equal(report.won, 5);
assert.equal(report.decided, 6);
assert.ok(report.win_rate > 0.8 && report.win_rate < 0.85);
assert.ok(report.revenue_cents > 0);
assert.ok(report.outstanding_cents > 0);
assert.ok(overdueInvoices(book, '2026-10-14').some((row) => row.invoice.id === 'ti_geyser'));

const ics = buildTradeIcs(book);
assert.match(ics, /BEGIN:VCALENDAR/);
assert.match(ics, /UID:ts_thandi@supplieradvisor\.tradegraph/);

const owner = tradePwaCapabilities('owner');
assert.equal(owner.role, 'owner');
assert.equal(owner.money, true);
assert.equal(owner.allJobs, true);
const tech = tradePwaCapabilities('operations');
assert.equal(tech.role, 'technician');
assert.equal(tech.money, false);
assert.equal(tech.allJobs, false);
assert.equal(tradePwaCapabilities('finance').money, true);
assert.equal(tradeClientCapabilities().role, 'client');

const queued = enqueuePhoto([], {
  id: 'q1',
  job_id: 'tj_waste',
  phase: 'after',
  url: 'data:image/jpeg;base64,abc',
  caption: 'Test',
  at: now,
});
assert.equal(queued.length, 1);
assert.equal(drainPhotoQueue(queued, ['q1']).length, 0);

let next = book;
const created = applyTradeOp(
  next,
  { type: 'create_job', customer_id: 'tc_david', title: 'Dripping stopcock', address: '3 Beach Road' },
  now
);
next = created.book;
const newJob = next.store.jobs.find((row) => row.title === 'Dripping stopcock');
assert.ok(newJob);
assert.equal(newJob!.status, 'enquiry');

const quoted = applyTradeOp(
  next,
  {
    type: 'create_quote',
    customer_id: 'tc_david',
    title: 'Stopcock',
    job_id: newJob!.id,
    deposit_pct: 20,
    lines: [{ id: 'tmp', description: 'Plumber hour', qty: 1, unit_cents: 64_800 }],
  },
  now
);
next = quoted.book;
const quote = next.store.quotes.find((row) => row.title === 'Stopcock')!;
const sent = applyTradeOp(next, { type: 'send_quote', quote_id: quote.id }, now);
next = sent.book;
assert.equal(next.store.quotes.find((row) => row.id === quote.id)!.status, 'sent');
assert.equal(sent.notices[0]!.audience, 'customer');

const signed = applyTradeOp(
  next,
  { type: 'sign_quote', quote_id: quote.id, name: 'David Meyer', mark: 'David Meyer' },
  now
);
next = signed.book;
const opened = next.store.jobs.find((row) => row.quote_id === quote.id)!;
assert.equal(opened.status, 'scheduled');
const programme = next.desk.programmes.find((row) => row.job_id === opened.id)!;
assert.ok(programme.baseline);
assert.equal(programme.baseline!.reason.includes('accepted'), true);
assert.equal(programme.contract_cents, 64_800);
assert.ok(next.store.invoices.some((row) => row.job_id === opened.id));

const beforePlan = programme.tasks[0]!.plan_end;
const shifted = applyTradeOp(
  next,
  { type: 'shift_task', job_id: opened.id, task_id: programme.tasks[0]!.id, days: 2 },
  now
);
next = shifted.book;
const moved = next.desk.programmes.find((row) => row.job_id === opened.id)!.tasks[0]!;
assert.equal(moved.plan_end, beforePlan);
assert.notEqual(moved.end, beforePlan);
assert.equal(shifted.notices.some((row) => row.audience === 'customer'), true);

const reb = applyTradeOp(
  next,
  { type: 'rebaseline', job_id: opened.id, reason: 'Customer asked to start Monday' },
  now
);
next = reb.book;
const after = next.desk.programmes.find((row) => row.job_id === opened.id)!;
assert.equal(after.history.length, 1);
assert.equal(after.tasks[0]!.plan_end, after.tasks[0]!.end);

const drafted = applyTradeOp(
  next,
  {
    type: 'create_vo',
    job_id: opened.id,
    title: 'Extra isolation valve',
    scope: 'Add a valve under the sink so the kitchen can be isolated.',
    cost_cents: 45_000,
    days: 1,
  },
  now
);
next = drafted.book;
const vo = next.desk.variations.find((row) => row.job_id === opened.id && row.status === 'draft')!;
const sentVo = applyTradeOp(next, { type: 'send_vo', vo_id: vo.id }, now);
next = sentVo.book;
const approved = applyTradeOp(
  next,
  { type: 'approve_vo', vo_id: vo.id, name: 'David Meyer', mark: 'David Meyer' },
  now
);
next = approved.book;
const prog = next.desk.programmes.find((row) => row.job_id === opened.id)!;
assert.ok(prog.tasks.some((row) => row.vo_number === 'VO-001'));
const revised = voRegister(next, opened.id);
assert.equal(revised.revised_cents, revised.original_cents + 45_000);
assert.ok(next.store.jobs.find((row) => row.id === opened.id)!.lines.some((row) => row.unit_cents === 45_000));

const invoiced = applyTradeOp(
  next,
  { type: 'create_invoice', job_id: opened.id, kind: 'final' },
  now
);
next = invoiced.book;
const invoice = next.store.invoices.filter((row) => row.job_id === opened.id).at(-1)!;
const pay = applyTradeOp(next, { type: 'pay_link', invoice_id: invoice.id }, now);
next = pay.book;
const meta = next.desk.invoice_meta.find((row) => row.invoice_id === invoice.id)!;
assert.match(meta.pay_reference, /^tg_/);
assert.match(meta.pay_url, /pay\?invoice=/);
assert.equal(pay.notices[0]!.title, 'Pay link');

const money = quoteTotals(quote.lines, 0.15);
assert.equal(money.vat_cents, Math.round(64_800 * 0.15));
assert.equal(formatZar(money.total_cents).startsWith('R'), true);

console.log('desk.test.ts ok');
