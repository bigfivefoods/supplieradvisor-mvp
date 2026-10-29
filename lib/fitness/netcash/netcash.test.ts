/**
 * GymAdvisor® Netcash debit orders.
 * Run: npx tsx lib/fitness/netcash/netcash.test.ts
 * Uses company 901 only. Never company 110.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import GymDebitFlow from '../../../components/fitness/netcash/GymDebitFlow';
import { MODULE_NAV } from '../../chrome/module-nav';
import { buildDebitBatchFile } from './batch';
import { priceMember } from './billing';
import { buildPreviewLines } from './billing';
import { addBusinessDays, easterSunday, holidayName, isBusinessDay, planActionDate, weekday } from './calendar';
import { accountAad, keyFromHex, openSecret, sealSecret, serviceKeyAad } from './crypto';
import { defaultSettings } from './defaults';
import { collectionsCsv } from './export-csv';
import { issueJournal, settlementJournal } from './finance';
import { SAMPLE_COMPANY_ID, sampleLines, sampleRuns } from './fixtures';
import { companyAllowed, LOCKED_COMPANY_ID } from './guard';
import { memoryInvoices } from './invoices';
import { memoryRepo } from './memory';
import { summariseCollections } from './overview';
import { canManageNetcash } from './permissions';
import { reasonInfo } from './reasons';
import { approveBilling, captureMandate, changeMandateStatus, pollBilling, previewBilling, submitBilling, updateSettings, type ServiceDeps } from './service';
import type { BillableMember } from './types';
import { createNetcashClient } from './client';
import { evaluateMemberAccess, emptyFitgraphStore } from '../fitgraph';

const KEY = keyFromHex('ab'.repeat(32));
assert.ok(KEY);

function deps(): ServiceDeps {
  let n = 0;
  const repo = memoryRepo();
  const invoices = memoryInvoices();
  return {
    repo,
    invoices,
    now: () => new Date('2026-10-29T08:00:00.000Z'),
    id: () => `id_${++n}`,
    gymName: 'Harbour Athletic',
    sealServiceKey: (companyId, value) => sealSecret(value, KEY!, serviceKeyAad(companyId)),
    sealAccount: (companyId, mandateId, account) => sealSecret(account, KEY!, accountAad(companyId, mandateId)),
    openAccount: (companyId, mandate) => openSecret(mandate.accountNumberEnc, KEY!, accountAad(companyId, mandate.id)),
    sealFile: (companyId, body) => sealSecret(body, KEY!, `gym-netcash-file:${companyId}`),
    openServiceKey: (companyId, settings) =>
      settings.serviceKeyEnc ? openSecret(settings.serviceKeyEnc, KEY!, serviceKeyAad(companyId)) : null,
    mailer: async () => ({ ok: true }),
  };
}

function member(id: string, name: string, cents: number, start: string | null = '2026-01-01'): BillableMember {
  return {
    memberId: id,
    name,
    email: `${id}@example.com`,
    phone: '0825550199',
    crmCustomerId: null,
    startDate: start,
    active: true,
    discountBps: 0,
    plans: [{ id: `plan_${id}`, name: 'Unlimited', cents, addon: false, billing: 'monthly' }],
  };
}

const prevLock = process.env.GYM_NETCASH_ALLOW_COMPANY_110;
delete process.env.GYM_NETCASH_ALLOW_COMPANY_110;
assert.equal(companyAllowed(LOCKED_COMPANY_ID).ok, false);
assert.equal(companyAllowed(SAMPLE_COMPANY_ID).ok, true);
assert.equal(SAMPLE_COMPANY_ID === 110, false);
assert.equal(JSON.stringify(sampleLines).includes('VUKA'), false);
process.env.GYM_NETCASH_ALLOW_COMPANY_110 = '1';
assert.equal(companyAllowed(110).ok, true);
if (prevLock == null) delete process.env.GYM_NETCASH_ALLOW_COMPANY_110;
else process.env.GYM_NETCASH_ALLOW_COMPANY_110 = prevLock;

assert.equal(easterSunday(2026), '2026-04-05');
assert.equal(holidayName('2026-04-03'), 'Good Friday');
assert.equal(holidayName('2026-04-06'), 'Family Day');
assert.equal(holidayName('2026-12-25'), 'Christmas Day');
assert.equal(isBusinessDay('2026-11-01'), false);
assert.equal(weekday('2026-11-01'), 0);
const november = planActionDate({
  requested: '2026-11-01',
  now: new Date('2026-10-29T08:00:00.000Z'),
  leadBusinessDays: 2,
  cutoffHourSast: 14,
  cutoffMinute: 0,
});
assert.equal(november.actionDate, '2026-11-02');
assert.equal(november.holidayShifted, true);
const missed = planActionDate({
  requested: '2026-11-02',
  now: new Date('2026-10-29T13:00:00.000Z'),
  leadBusinessDays: 2,
  cutoffHourSast: 14,
  cutoffMinute: 0,
});
assert.equal(missed.cutoffApplied, true);
assert.notEqual(missed.actionDate, '2026-11-02');
assert.equal(isBusinessDay(missed.actionDate), true);
assert.equal(addBusinessDays('2026-12-24', 1), '2026-12-28');

const settings = defaultSettings(901, '2026-10-29T08:00:00.000Z');
const priced = priceMember({
  member: member('new', 'New Member', 89000, '2026-10-16'),
  settings,
  periodStart: '2026-10-01',
  periodEnd: '2026-10-31',
  alreadyBilled: false,
  lateFeeCents: 0,
});
assert.ok(priced);
assert.equal(priced!.grossCents, Math.round(89000 * 16 / 31));
assert.equal(priced!.netCents + priced!.vatCents, priced!.grossCents);
const full = priceMember({
  member: member('old', 'Old Member', 89000, '2026-01-01'),
  settings,
  periodStart: '2026-10-01',
  periodEnd: '2026-10-31',
  alreadyBilled: false,
  lateFeeCents: 0,
});
assert.equal(full!.grossCents, 89000);
assert.equal(full!.vatCents, Math.round((89000 * 1500) / 11500));

const journal = issueJournal(full!, settings);
const debit = journal.reduce((sum, line) => sum + line.debit, 0);
const credit = journal.reduce((sum, line) => sum + line.credit, 0);
assert.equal(debit.toFixed(2), credit.toFixed(2));
const settle = settlementJournal(full!, settings);
assert.equal(settle[0].accountCode, '1110');
assert.equal(settle[1].accountCode, '1180');

assert.equal(reasonInfo('02').retryable, true);
assert.equal(reasonInfo('12').retryable, false);
assert.equal(reasonInfo('12').suspendSuggested, true);
assert.equal(canManageNetcash('owner'), true);
assert.equal(canManageNetcash('admin'), true);
assert.equal(canManageNetcash('coach'), false);

const sealed = sealSecret('secret-key', KEY!, serviceKeyAad(901));
assert.equal(openSecret(sealed, KEY!, serviceKeyAad(901)), 'secret-key');
assert.equal(openSecret(sealed, KEY!, serviceKeyAad(902)), null);
assert.equal(sealed.includes('secret-key'), false);

const clientSource = readFileSync(new URL('./client.ts', import.meta.url), 'utf8');
assert.equal(clientSource.includes('fetch('), false);
assert.equal(clientSource.includes('ws.netcash'), false);
void createNetcashClient;

const started = Date.now();
const many = buildPreviewLines({
  companyId: 901,
  runId: 'big',
  settings,
  members: Array.from({ length: 3000 }, (_, index) => member(`m${index}`, `Member ${index}`, 89000)),
  mandates: [],
  periodStart: '2026-10-01',
  periodEnd: '2026-10-31',
  billedMemberIds: new Set(),
  pendingFees: new Map(),
  nowIso: '2026-10-29T08:00:00.000Z',
  id: (() => {
    let n = 0;
    return () => `big_${++n}`;
  })(),
});
assert.equal(many.length, 3000);
assert.ok(Date.now() - started < 1500, `preview took ${Date.now() - started}ms`);

async function main() {
const live = await createNetcashClient('live').submitDebitBatch({ sha256: 'x', actionDate: '2026-11-02', rows: [] });
assert.equal(live.ok, false);

const book = deps();
await updateSettings(book, 901, { merchantAccount: 'NC-HA-1001', serviceKey: 'sandbox-key-1234', mode: 'test', autoSuspendAccess: true }, 'owner');
const saved = await book.repo.getSettings(901);
assert.equal(saved?.serviceKeyLast4, '1234');
assert.equal(String(saved?.serviceKeyEnc || '').includes('sandbox-key'), false);

async function sign(memberId: string, name: string, account: string) {
  const mandate = await captureMandate(book, {
    companyId: 901,
    memberId,
    memberName: name,
    memberEmail: `${memberId}@example.com`,
    memberPhone: '0825550199',
    ip: '102.0.0.8',
    userAgent: 'test',
    gymName: 'Harbour Athletic',
    mandate: {
      accountHolder: name,
      bankName: 'Standard Bank',
      branchCode: '051001',
      accountNumber: account,
      accountType: 'cheque',
      debitDay: 1,
      amountCents: 89000,
      accepted: true,
    },
  });
  return changeMandateStatus(book, { companyId: 901, mandateId: mandate.id, status: 'active', actor: 'owner' });
}

await sign('paid', 'Paid Member', '1002003014');
await sign('retry', 'Retry Member', '1002003010');
await sign('closed', 'Closed Member', '1002003011');
await sign('back', 'Reversed Member', '1002003013');

const members = [
  member('paid', 'Paid Member', 89000),
  member('retry', 'Retry Member', 89000),
  member('closed', 'Closed Member', 89000),
  member('back', 'Reversed Member', 89000),
  member('fresh', 'Fresh Member', 89000, '2026-10-20'),
];
const preview = await previewBilling(book, { companyId: 901, members, actor: 'owner' });
assert.equal(preview.run.status, 'preview');
assert.equal(preview.run.actionDate, '2026-11-02');
assert.equal(preview.lines.find((line) => line.memberId === 'fresh')?.collectionStatus, 'skipped');
await assert.rejects(
  () => submitBilling(book, { companyId: 901, runId: preview.run.id, actor: 'owner', members }),
  /Approve this billing run/
);
await approveBilling(book, { companyId: 901, runId: preview.run.id, actor: 'owner' });
const submitted = await submitBilling(book, { companyId: 901, runId: preview.run.id, actor: 'owner', members });
assert.equal(submitted.run.status, 'submitted');
assert.ok(submitted.run.netcashBatchId.startsWith('DO-TEST-'));
assert.ok(submitted.lines.every((line) => line.invoiceNumber.startsWith('GYM-')));
const again = await submitBilling(book, { companyId: 901, runId: preview.run.id, actor: 'owner', members });
assert.equal(again.run.netcashBatchId, submitted.run.netcashBatchId);
const polled = await pollBilling(book, { companyId: 901, runId: preview.run.id, actor: 'owner' });
const byMember = (id: string) => polled.lines.filter((line) => line.memberId === id).sort((a, b) => a.attempt - b.attempt);
assert.equal(byMember('paid').at(-1)?.collectionStatus, 'paid');
assert.equal(byMember('retry')[0]?.collectionStatus, 'unpaid');
assert.equal(byMember('retry')[0]?.netcashReasonCode, '02');
assert.equal(byMember('retry').at(-1)?.collectionStatus, 'scheduled');
assert.equal(byMember('retry').at(-1)?.attempt, 2);
assert.equal(byMember('closed').at(-1)?.collectionStatus, 'unpaid');
assert.equal(byMember('closed').at(-1)?.accessSuspended, true);
assert.equal(byMember('back').at(-1)?.collectionStatus, 'reversed');
assert.ok(byMember('back').at(-1)?.creditNoteNumber.startsWith('GCN-'));
const holds = await book.repo.listHolds(901);
assert.equal(holds.some((hold) => hold.memberId === 'closed'), true);
const secondPoll = await pollBilling(book, { companyId: 901, runId: preview.run.id, actor: 'owner' });
assert.equal(secondPoll.run.collectedCents, polled.run.collectedCents);
const auditBlob = JSON.stringify(await book.repo.listAudit(901, 20));
assert.equal(auditBlob.includes('1002003014'), false);
assert.equal(auditBlob.includes('sandbox-key'), false);
const csv = collectionsCsv(sampleRuns, sampleLines);
assert.equal(csv.includes('100200'), false);
assert.match(csv, /Amahle Nkosi/);

const overview = summariseCollections(sampleRuns, sampleLines);
assert.equal(overview.collectedCents, 89000);
assert.ok(overview.unpaidCents > 0);
assert.equal(overview.upcoming?.actionDate, '2026-10-01');

const gym = MODULE_NAV.find((mod) => mod.id === 'fitgraph');
assert.equal(gym?.name, 'GymAdvisor®');
for (const href of ['/dashboard/fitgraph/collections', '/dashboard/fitgraph/debit-orders', '/dashboard/fitgraph/billing-runs', '/dashboard/fitgraph/netcash']) {
  assert.ok(gym?.steps.some((step) => step.href === href), href);
}
assert.ok(gym?.steps.every((step) => step.rail !== false));

const flow = renderToStaticMarkup(createElement(GymDebitFlow, null));
assert.match(flow, /aria-expanded="false"/);
assert.match(flow, /gym-debit-flow-panel/);
assert.match(flow, /hidden/);
assert.match(flow, /GymAdvisor®/);
assert.equal(flow.includes('#ffffff'), false);

const migration = readFileSync('supabase/migrations/20261047_gym_netcash_debit_orders.sql', 'utf8');
assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
assert.match(migration, /gym_netcash_owner_admin/);
assert.match(migration, /service_key_enc/);
assert.equal(migration.includes('GRANT SELECT (company_id, merchant_account, service_key_enc'), false);
assert.match(migration, /DO NOT apply this file to production/);
assert.match(migration, /onkklullmgrdqoertngp/);

const route = readFileSync('app/api/fitness/netcash/runs/route.ts', 'utf8');
assert.match(route, /requireNetcashAdmin/);
const cron = readFileSync('app/api/fitness/netcash/cron/route.ts', 'utf8');
assert.match(cron, /assertCronSecret/);
assert.match(cron, /companyAllowed/);
const publicRoute = readFileSync('app/api/public/fitgraph/debit-order/route.ts', 'utf8');
assert.match(publicRoute, /rateLimit/);
assert.match(publicRoute, /companyAllowed/);
const publicBody = publicRoute.slice(publicRoute.indexOf('export async function POST'));
const publicBeforeLoad = publicBody.indexOf('companyAllowed(companyFromToken)');
const publicLoad = publicBody.indexOf('await loadAdvisorStoreForPublicToken');
assert.ok(publicBeforeLoad > 0 && publicBeforeLoad < publicLoad);

const store = emptyFitgraphStore();
const blocked = evaluateMemberAccess(
  store,
  { id: 'm', name: 'Member', active: true, created_at: '2026-01-01' } as never,
  { debitHold: true }
);
assert.equal(blocked.level, 'allowed_with_warning');
assert.match(blocked.alert || '', /access stays open/);

const file = buildDebitBatchFile({
  serviceKey: 'TEST-KEY',
  actionDate: '2026-11-02',
  batchName: 'GYM 2026-11',
  rows: [{ netcashRef: 'G1', accountName: 'Amahle', accountHolder: 'A', accountType: 'cheque', branchCode: '051001', accountNumber: '1002003014', amountCents: 89000, memberId: 'paid', invoiceNumber: 'GYM-00001' }],
});
assert.match(file.body, /^H\tTEST-KEY\t1\tTwoDay\tGYM 2026-11\t20261102\t/);
assert.match(file.body, /K\t101\t102\t131\t132\t133\t134\t135\t136\t162\t301\t302/);
assert.match(file.body, /T\tG1\tAmahle\t1\tA\t1\t051001\t0\t1002003014\t89000\tpaid\tGYM-00001/);
assert.match(file.body, /F\t1\t89000\t9999/);
assert.equal(file.sha256.length, 64);

await assert.rejects(() => previewBilling(book, { companyId: 110, members: [], actor: 'owner' }), /locked/i);

console.log('netcash.test.ts ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
