/**
 * ConstructionAdvisor® store merge, seed, BOQ, reports, and PWA.
 * Run: npx --yes tsx lib/construction/constructiongraph.test.ts
 */
import assert from 'node:assert/strict';
import {
  CONSTRUCTIONGRAPH_MODULE_ID,
  CONSTRUCTIONGRAPH_PACK_ID,
  CONSTRUCTIONGRAPH_TOKEN_KEY,
  CONSTRUCTIONGRAPH_TOKENS_KEY,
  acceptQuotePatch,
  allocateCostPatch,
  boqActualAmount,
  addDaysIso,
  applyPaymentAction,
  constructiongraphSeedStore,
  emptyConstructiongraphStore,
  mergeConstructiongraphStore,
  paymentCashflow,
  portalViewForToken,
  programmeReport,
  projectReport,
  projectsForClient,
  readConstructiongraphFromMetadata,
  resolvePaymentStatus,
  summariseConstructiongraph,
  upsertPortal,
  writeConstructiongraphToMetadata,
} from './constructiongraph';

assert.equal(CONSTRUCTIONGRAPH_MODULE_ID, 'constructiongraph');
assert.equal(CONSTRUCTIONGRAPH_PACK_ID, 'construction_building');

const existing = mergeConstructiongraphStore(emptyConstructiongraphStore(), {
  sites: [
    {
      id: 's1',
      code: 'SITE-01',
      name: 'Podium',
      status: 'on_site',
      contract_value: 10_000_000,
    },
    {
      id: 's2',
      code: 'SITE-02',
      name: 'Warehouse',
      status: 'tender',
    },
  ],
  variations: [
    { id: 'v1', number: 'VO-001', description: 'Extra steel', amount: 100_000, status: 'draft' },
  ],
});

const merged = mergeConstructiongraphStore(existing, {
  sites: [
    {
      id: 's2',
      code: 'SITE-02',
      name: 'Warehouse B',
      status: 'awarded',
    },
    {
      id: 's3',
      code: 'SITE-03',
      name: 'Clinic',
      status: 'on_site',
    },
  ],
  variations: [
    { id: 'v1', number: 'VO-001', description: 'Extra steel', amount: 125_000, status: 'submitted' },
  ],
});

assert.deepEqual(
  merged.sites.map((s) => s.id),
  ['s2', 's3', 's1']
);
assert.equal(merged.sites[0]?.name, 'Warehouse B');
assert.equal(merged.sites[2]?.name, 'Podium');
assert.equal(merged.variations[0]?.amount, 125_000);
assert.equal(merged.variations[0]?.status, 'submitted');

const metadata = writeConstructiongraphToMetadata(
  { timezone: 'Africa/Johannesburg' },
  merged
);
assert.equal(metadata.timezone, 'Africa/Johannesburg');
const roundTrip = readConstructiongraphFromMetadata(metadata);
assert.equal(roundTrip.sites.length, 3);
assert.equal(roundTrip.sites[0]?.status, 'awarded');

const seed = constructiongraphSeedStore('2026-09-10T08:00:00.000Z');
assert.ok(seed.sites.length >= 3);
assert.equal(seed.clients.length, 2);
assert.equal(projectsForClient(seed, 'cli_apex').length, 2);
assert.equal(projectsForClient(seed, 'cli_schools').length, 1);
assert.equal(seed.quotes.length, 3);
assert.equal(seed.costs.length, 2);
assert.equal(seed.sites[0]?.contract_type, 'JBCC');
assert.ok(seed.settings.public_token);
assert.ok(seed.portals.some((p) => p.kind === 'public'));
assert.ok(seed.portals.some((p) => p.kind === 'client' && p.client_id === 'cli_apex'));
assert.ok(seed.portals.some((p) => p.kind === 'contractor' && p.site_id === 'site_1'));

const summary = summariseConstructiongraph(seed);
assert.equal(summary.sites, seed.sites.length);
assert.equal(summary.clients, 2);
assert.equal(summary.quotes, 3);
assert.ok(summary.contractValue > 0);
assert.ok(summary.certified > 0);
assert.ok(summary.costs > 0);
assert.equal(summary.openSnags, 1);
assert.ok(summary.plannedPct > 0);
assert.ok(summary.actualPct > 0);

const emptySummary = summariseConstructiongraph(emptyConstructiongraphStore());
assert.equal(emptySummary.sites, 0);
assert.equal(emptySummary.certified, 0);
assert.equal(emptySummary.clients, 0);

const podium = projectReport(seed, 'site_1');
assert.ok(podium);
assert.equal(podium.clientName, 'Apex Developments');
assert.ok(podium.boqPlanned > 0);
assert.ok(podium.boqActual > 0);
assert.ok(podium.boqLines.length >= 1);
assert.equal(podium.actualPct, 32);
assert.equal(podium.plannedPct, 28);

const roll = programmeReport(seed);
assert.equal(roll.projectCount, 3);
assert.equal(roll.clientCount, 2);
assert.equal(roll.quoteCount, 3);
assert.ok(roll.projects.some((p) => p.siteId === 'site_2'));

const clientToken = seed.portals.find((p) => p.kind === 'client')!.token;
const clientView = portalViewForToken(seed, clientToken, 'SiteCo');
assert.ok(clientView);
assert.equal(clientView.kind, 'client');
assert.equal(clientView.projects.length, 2);
assert.ok(clientView.projects.every((p) => p.clientName === 'Apex Developments'));
assert.ok(clientView.quotes.every((q) => q.id !== 'qt_3'));

const contractorToken = seed.portals.find((p) => p.kind === 'contractor')!.token;
const contractorView = portalViewForToken(seed, contractorToken, 'SiteCo');
assert.ok(contractorView);
assert.equal(contractorView.projects.length, 1);
assert.equal(contractorView.projects[0]?.siteId, 'site_1');
assert.ok(contractorView.activities.length >= 1);

const publicView = portalViewForToken(seed, seed.settings.public_token!, 'SiteCo');
assert.ok(publicView);
assert.equal(publicView.projects.length, 3);

const written = writeConstructiongraphToMetadata({}, seed);
assert.equal(written[CONSTRUCTIONGRAPH_TOKEN_KEY], seed.settings.public_token);
const tokens = written[CONSTRUCTIONGRAPH_TOKENS_KEY] as Record<string, string>;
assert.equal(tokens[seed.settings.public_token!], 'public');
assert.equal(tokens[clientToken], 'client');

const noMint = readConstructiongraphFromMetadata({});
assert.equal(noMint.settings.public_token, undefined);
assert.equal(noMint.portals.length, 0);

const backfill = readConstructiongraphFromMetadata({
  constructiongraph: {
    sites: [
      { id: 'legacy', code: 'L-1', name: 'Legacy hall', client: 'Acme Dev' },
    ],
  },
});
assert.equal(backfill.clients.length, 1);
assert.equal(backfill.clients[0]?.name, 'Acme Dev');
assert.equal(backfill.sites[0]?.client_id, backfill.clients[0]?.id);

const costPatch = allocateCostPatch(seed, {
  id: 'cost_x',
  site_id: 'site_1',
  boq_id: 'boq_1',
  kind: 'material',
  description: 'Pour 2',
  amount: 10_000,
});
const afterCost = mergeConstructiongraphStore(seed, costPatch);
const boq1 = afterCost.boq.find((row) => row.id === 'boq_1');
assert.ok(boq1);
assert.equal(boqActualAmount(boq1), 523_000);

const acceptPatch = acceptQuotePatch(seed, 'qt_3', '2026-09-10');
const afterAccept = mergeConstructiongraphStore(seed, acceptPatch);
assert.equal(afterAccept.quotes.find((q) => q.id === 'qt_3')?.status, 'accepted');
assert.equal(afterAccept.sites.find((s) => s.id === 'site_3')?.status, 'awarded');
assert.equal(afterAccept.sites.find((s) => s.id === 'site_3')?.quote_id, 'qt_3');
assert.equal(afterAccept.sites.find((s) => s.id === 'site_3')?.contract_value, 6_400_000);

const reissued = upsertPortal(seed, {
  token: 'cg_newclienttoken99',
  kind: 'client',
  client_id: 'cli_apex',
  label: 'Apex Developments',
});
const apexClientPortals = reissued.portals.filter(
  (p) => p.kind === 'client' && p.client_id === 'cli_apex'
);
assert.equal(apexClientPortals.length, 1);
assert.equal(apexClientPortals[0]?.token, 'cg_newclienttoken99');

const portalMerge = mergeConstructiongraphStore(emptyConstructiongraphStore(), {
  portals: [{ id: 'tok1', token: 'tok1', kind: 'public', label: 'first' }],
});
const portalMerge2 = mergeConstructiongraphStore(portalMerge, {
  portals: [{ id: 'tok1', token: 'tok1', kind: 'public', label: 'updated' }],
});
assert.equal(portalMerge2.portals.length, 1);
assert.equal(portalMerge2.portals[0]?.label, 'updated');

assert.equal(addDaysIso('2026-09-10', 21), '2026-10-01');
assert.equal(seed.payments.length, 3);
const pay1 = seed.payments.find((p) => p.id === 'pay_1');
assert.ok(pay1);
assert.equal(resolvePaymentStatus(pay1, '2026-09-10'), 'certified');
assert.equal(resolvePaymentStatus(pay1, '2026-10-20'), 'overdue');
const cash = paymentCashflow(seed, 'site_1', '2026-09-10');
assert.equal(cash.planned, 12_000_000);
assert.equal(cash.certified, 6_200_000);
assert.equal(cash.paid, 0);
assert.equal(podium.plannedBillings, 12_000_000);
assert.equal(podium.outstandingBillings, 6_200_000);
assert.ok(podium.budget >= podium.contractValue);

const claimed = applyPaymentAction(seed, {
  paymentId: 'pay_2',
  action: 'claim',
  actor: 'contractor',
  date: '2026-10-10',
  portal: seed.portals.find((p) => p.kind === 'contractor'),
});
assert.equal(claimed.ok, true);
if (!claimed.ok) throw new Error('claim failed');
assert.equal(
  claimed.store.payments.find((p) => p.id === 'pay_2')?.status,
  'claimed'
);

const clientBlocked = applyPaymentAction(seed, {
  paymentId: 'pay_2',
  action: 'pay',
  actor: 'client',
  portal: seed.portals.find((p) => p.kind === 'client'),
});
assert.equal(clientBlocked.ok, false);

const paid = applyPaymentAction(claimed.store, {
  paymentId: 'pay_2',
  action: 'pay',
  actor: 'client',
  date: '2026-10-31',
  amount: 5_800_000,
  portal: seed.portals.find((p) => p.kind === 'client'),
});
assert.equal(paid.ok, true);
if (!paid.ok) throw new Error('pay failed');
assert.equal(paid.store.payments.find((p) => p.id === 'pay_2')?.status, 'paid');
assert.equal(paid.store.payments.find((p) => p.id === 'pay_2')?.paid_amount, 5_800_000);

const publicDenied = applyPaymentAction(seed, {
  paymentId: 'pay_2',
  action: 'claim',
  actor: 'public',
});
assert.equal(publicDenied.ok, false);

const wrongSite = applyPaymentAction(seed, {
  paymentId: 'pay_3',
  action: 'claim',
  actor: 'contractor',
  portal: seed.portals.find((p) => p.kind === 'contractor'),
});
assert.equal(wrongSite.ok, false);

const certified = applyPaymentAction(claimed.store, {
  paymentId: 'pay_2',
  action: 'certify',
  actor: 'staff',
  date: '2026-10-12',
});
assert.equal(certified.ok, true);
if (!certified.ok) throw new Error('certify failed');
const ipc = certified.store.certificates.find(
  (c) => c.id === certified.store.payments.find((p) => p.id === 'pay_2')?.certificate_id
);
assert.ok(ipc);
assert.equal(ipc.status, 'issued');

assert.ok((clientView?.payments.length || 0) >= 2);
assert.ok(contractorView?.payments.every((p) => p.siteCode === 'PRJ-01'));

console.log('constructiongraph.test.ts ok');
