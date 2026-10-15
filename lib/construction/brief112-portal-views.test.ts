/**
 * ConstructionAdvisor® portal views are allow-lists. A client link must not
 * carry builder costs, other clients, or the master link.
 * Run: npx --yes tsx lib/construction/brief112-portal-views.test.ts
 */
import assert from 'node:assert/strict';
import {
  emptyConstructiongraphStore,
  portalViewForToken,
  summariseConstructiongraph,
  type ConstructiongraphStore,
} from './constructiongraph';
import { issueConstructionPortal } from './portal-issue';

const COST = 987654321;
const BUDGET = 876543210;
const RATE = 765432109;
const OTHER = 'SENTINEL OTHER CLIENT';
const SUB = 'SENTINEL SUB';
const UNSCOPED_ACTIVITY = 'UNSCOPED ACTIVITY';
const UNSCOPED_PAYMENT = 'UNSCOPED PAYMENT';

function book(): ConstructiongraphStore {
  return {
    ...emptyConstructiongraphStore(),
    clients: [
      { id: 'cli_a', name: 'Apex Developments' },
      { id: 'cli_b', name: OTHER },
    ],
    sites: [
      {
        id: 'site_a1',
        code: 'PRJ-A1',
        name: 'Podium',
        client_id: 'cli_a',
        client: 'Apex Developments',
        contract_value: 2500,
        status: 'on_site',
      },
      {
        id: 'site_a2',
        code: 'PRJ-A2',
        name: 'Parkade',
        client_id: 'cli_a',
        client: 'Apex Developments',
        contract_value: 1800,
        status: 'awarded',
      },
      {
        id: 'site_b',
        code: 'PRJ-B',
        name: 'Other hall',
        client_id: 'cli_b',
        client: OTHER,
        contract_value: BUDGET,
        status: 'on_site',
      },
    ],
    quotes: [
      {
        id: 'qt_a',
        number: 'Q-A',
        title: 'Podium quote',
        client_id: 'cli_a',
        site_id: 'site_a1',
        status: 'accepted',
      },
      {
        id: 'qt_b',
        number: 'Q-B',
        title: 'Other quote',
        client_id: 'cli_b',
        site_id: 'site_b',
        status: 'sent',
      },
    ],
    boq: [
      {
        id: 'boq_a',
        site_id: 'site_a1',
        quote_id: 'qt_a',
        item_no: '1',
        description: 'Concrete',
        uom: 'm3',
        qty: 2,
        rate: RATE,
        amount: 100,
      },
    ],
    costs: [
      {
        id: 'cost_a',
        site_id: 'site_a1',
        kind: 'material',
        description: 'Hidden spend',
        amount: COST,
      },
    ],
    subcontractors: [
      { id: 'sub_a', site_id: 'site_a1', name: SUB, trade: 'formwork' },
    ],
    programme: [
      {
        id: 'prg_a',
        site_id: 'site_a1',
        activity: 'Structure',
        planned_pct: 40,
        actual_pct: 25,
        status: 'in_progress',
      },
      {
        id: 'prg_b',
        site_id: 'site_b',
        activity: 'Other programme',
        planned_pct: 10,
        actual_pct: 10,
        status: 'planned',
      },
      {
        id: 'prg_none',
        activity: UNSCOPED_ACTIVITY,
        planned_pct: 99,
        actual_pct: 99,
        status: 'planned',
      },
    ],
    payments: [
      {
        id: 'pay_a',
        site_id: 'site_a1',
        number: 'PP-A',
        title: 'Podium claim',
        planned_amount: 400,
        claimed_amount: 400,
        certified_amount: 400,
        status: 'certified',
      },
      {
        id: 'pay_b',
        site_id: 'site_b',
        number: 'PP-B',
        title: 'Other claim',
        planned_amount: 900,
        status: 'planned',
      },
      {
        id: 'pay_none',
        number: 'PP-X',
        title: UNSCOPED_PAYMENT,
        planned_amount: COST,
        status: 'planned',
      },
    ],
    snags: [
      { id: 'sn_a', site_id: 'site_a1', item: 'Door seal', location: 'L1', status: 'open' },
    ],
    portals: [],
    settings: {},
  };
}

function issue(store: ConstructiongraphStore, kind: 'client' | 'contractor' | 'public', extra: { client_id?: string; site_id?: string }) {
  const issued = issueConstructionPortal(store, {
    kind,
    label: kind,
    now: '2026-09-10T08:00:00.000Z',
    ...extra,
  });
  assert.equal(issued.ok, true);
  if (!issued.ok) throw new Error('issue failed');
  return issued;
}

const base = book();
const clientIssued = issue(base, 'client', { client_id: 'cli_a' });
const contractorIssued = issue(clientIssued.store, 'contractor', { site_id: 'site_a1' });
const publicIssued = issue(contractorIssued.store, 'public', {});
const store = publicIssued.store;

const clientView = portalViewForToken(store, clientIssued.issued.token, 'SiteCo');
assert.ok(clientView);
assert.equal(clientView.kind, 'client');
if (clientView.kind !== 'client') throw new Error('kind');
const clientJson = JSON.stringify(clientView);
for (const needle of [String(COST), String(BUDGET), String(RATE), OTHER, SUB, UNSCOPED_ACTIVITY, UNSCOPED_PAYMENT, 'PRJ-B', 'Q-B', 'PP-B']) {
  assert.equal(clientJson.includes(needle), false, `client saw ${needle}`);
}
for (const key of [
  'summary',
  'publicToken',
  'costs',
  'budget',
  'variance',
  'boqPlanned',
  'boqActual',
  'boqLines',
  'rate',
  'token',
  'token_hash',
]) {
  assert.equal(Object.prototype.hasOwnProperty.call(clientView, key), false, key);
  assert.equal(clientJson.includes(`"${key}"`), false, key);
}
assert.deepEqual(
  clientView.projects.map((row) => row.code).sort(),
  ['PRJ-A1', 'PRJ-A2']
);
assert.ok(clientView.projects.every((row) => row.clientName === 'Apex Developments'));
assert.equal(clientView.quotes.length, 1);
assert.equal(clientView.quotes[0]?.id, 'qt_a');
assert.equal(clientView.activities.some((row) => row.id === 'prg_none'), false);
assert.equal(clientView.payments.some((row) => row.id === 'pay_none'), false);
assert.equal(clientView.payments.some((row) => row.id === 'pay_b'), false);

const contractorView = portalViewForToken(store, contractorIssued.issued.token, 'SiteCo');
assert.ok(contractorView);
assert.equal(contractorView.kind, 'contractor');
if (contractorView.kind !== 'contractor') throw new Error('kind');
assert.deepEqual(
  contractorView.projects.map((row) => row.siteId),
  ['site_a1']
);
const contractorJson = JSON.stringify(contractorView);
for (const needle of [String(COST), String(BUDGET), String(RATE), OTHER, SUB, 'PRJ-A2', 'PRJ-B', UNSCOPED_ACTIVITY, UNSCOPED_PAYMENT]) {
  assert.equal(contractorJson.includes(needle), false, `contractor saw ${needle}`);
}
function walk(value: unknown, underPayment: boolean, path: string) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value) walk(item, underPayment, path);
    return;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const moneyKey = [
      'contractValue',
      'certified',
      'paid',
      'outstanding',
      'costs',
      'budget',
      'variance',
      'boqPlanned',
      'boqActual',
      'certifiedAmount',
      'paidAmount',
      'quotes',
      'summary',
      'publicToken',
      'token',
      'token_hash',
      'rate',
    ].includes(key);
    if (moneyKey) {
      assert.equal(underPayment, false, `${path}.${key} is not a payment field`);
      assert.fail(`contractor view has ${path}.${key}`);
    }
    const allowedPayment = [
      'plannedAmount',
      'claimedAmount',
      'plannedClaimDate',
      'plannedPayDate',
      'claimedAt',
    ].includes(key);
    if (allowedPayment) assert.equal(underPayment, true, key);
    walk(child, underPayment || key === 'payments', `${path}.${key}`);
  }
}
walk(contractorView, false, 'contractor');
assert.equal(contractorView.payments.every((row) => row.siteCode === 'PRJ-A1'), true);
assert.equal(contractorView.payments.some((row) => row.id === 'pay_none'), false);
assert.equal(contractorView.activities.some((row) => row.id === 'prg_none'), false);
assert.equal('certifiedAmount' in (contractorView.payments[0] || {}), false);

const publicView = portalViewForToken(store, publicIssued.issued.token, 'SiteCo');
assert.ok(publicView);
assert.equal(publicView.kind, 'public');
if (publicView.kind !== 'public') throw new Error('kind');
const publicJson = JSON.stringify(publicView);
for (const key of [
  'quotes',
  'payments',
  'contractValue',
  'certified',
  'paid',
  'outstanding',
  'costs',
  'budget',
  'variance',
  'plannedAmount',
  'claimedAmount',
  'certifiedAmount',
  'paidAmount',
  'summary',
  'token',
]) {
  assert.equal(publicJson.includes(`"${key}"`), false, key);
}
for (const needle of [String(COST), String(BUDGET), String(RATE), OTHER, SUB]) {
  assert.equal(publicJson.includes(needle), false, needle);
}
assert.equal(publicView.projects.length, 3);

const unscopedClient = {
  ...store,
  portals: [
    ...store.portals,
    {
      id: 'cgpr_unscoped_client',
      token_hash: 'ab'.repeat(32),
      kind: 'client' as const,
      label: 'missing client',
    },
  ],
};
assert.equal(portalViewForToken(unscopedClient, 'not-the-hash', 'SiteCo'), null);
const bareClient = issueConstructionPortal(
  { ...book(), portals: [] },
  { kind: 'client', now: '2026-09-10T08:00:00.000Z' }
);
assert.equal(bareClient.ok, false);

const hashedUnscoped = {
  ...emptyConstructiongraphStore(),
  ...book(),
  portals: [
    {
      id: 'cgpr_c',
      token: 'clienttok1',
      token_hash: undefined,
      kind: 'client' as const,
    },
    {
      id: 'cgpr_k',
      token: 'sitetok01',
      kind: 'contractor' as const,
    },
  ],
};
assert.equal(portalViewForToken(hashedUnscoped, 'clienttok1', 'SiteCo'), null);
assert.equal(portalViewForToken(hashedUnscoped, 'sitetok01', 'SiteCo'), null);

const summary = summariseConstructiongraph(store);
assert.equal(Object.prototype.hasOwnProperty.call(summary, 'publicToken'), false);

for (const view of [clientView, contractorView, publicView]) {
  const text = JSON.stringify(view);
  assert.equal(text.includes('cgp_'), false);
  assert.equal(text.includes('cg_'), false);
}

console.log('brief112-portal-views.test.ts ok');
