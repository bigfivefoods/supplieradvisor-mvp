/**
 * Run: npx --yes tsx lib/fitness/gym-shop.test.ts
 */
import assert from 'node:assert/strict';
import {
  emptyFitgraphStore,
  mergeFitgraphLibrary,
  newId,
  splitFitgraphLibrary,
} from './fitgraph';
import { parseGymSaleKind } from './gym-shop';
import {
  applyPaidGymSale,
  clientHasPaidAccess,
  gymPeriodEnd,
  gymRequiresPaidMembership,
  gymShopCatalog,
  resolveShopItem,
} from './gym-shop';

const store = emptyFitgraphStore();
store.membership_plans.push({
  id: 'pln_1',
  code: 'MTH',
  name: 'Monthly',
  price_zar: 699,
  billing: 'monthly',
  class_credits: null,
  public: true,
  active: true,
  created_at: '2026-01-01T00:00:00.000Z',
});
store.programmes = [
  {
    id: 'prg_1',
    name: 'Hyrox block',
    kind: 'class',
    items: [],
    price_zar: 450,
    public: true,
    active: true,
    created_at: '2026-01-01T00:00:00.000Z',
  },
];

const catalog = gymShopCatalog(store);
assert.equal(catalog.length, 2);
assert.equal(gymRequiresPaidMembership(store), true);

const plan = resolveShopItem(store, 'membership', 'pln_1');
assert.equal(plan.ok, true);

store.membership_plans[0].description = 'Morning engine work. Bring a towel.';
store.membership_plans[0].image_url = 'https://cdn.example/class.jpg';
store.membership_plans[0].video_url = 'https://youtu.be/abc1234';
const shop = gymShopCatalog(store);
const classCard = shop.find((i) => i.id === 'pln_1');
assert.equal(classCard?.description, 'Morning engine work. Bring a towel.');
assert.equal(classCard?.image_url, 'https://cdn.example/class.jpg');
assert.equal(classCard?.video_url, 'https://youtu.be/abc1234');

store.movements = [
  {
    id: 'mov_1',
    name: 'Squat',
    category: 'Lower',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
];
const split = splitFitgraphLibrary(store);
assert.equal(split.core.movements.length, 0);
assert.equal(split.lib.movements.length, 1);
assert.equal(mergeFitgraphLibrary(split.core, split.lib).movements[0]?.name, 'Squat');

const hidden = emptyFitgraphStore();
assert.equal(gymRequiresPaidMembership(hidden), false);
hidden.settings = { ...hidden.settings!, require_paid_membership: true };
assert.equal(gymRequiresPaidMembership(hidden), true);

const weekly = gymPeriodEnd('weekly', new Date('2026-08-01T00:00:00.000Z'));
assert.equal(weekly, '2026-08-08');

const applied = applyPaidGymSale(
  store,
  {
    id: 'gsl_1',
    kind: 'membership',
    plan_id: 'pln_1',
    amount_zar: 699,
    name: 'Ada',
    email: 'ada@example.com',
    status: 'pending',
    paystack_ref: 'gym-sale-1',
    created_at: new Date().toISOString(),
  },
  { companyId: 9 }
);
assert.equal(applied.client.membership_status, 'active');
assert.equal(applied.client.membership_plan_id, 'pln_1');
assert.equal(applied.sale.status, 'paid');
assert.ok(applied.client.portal_token);
assert.equal(applied.store.subscriptions[0].plan_id, 'pln_1');

const replay = applyPaidGymSale(
  applied.store,
  {
    id: 'gsl_1',
    kind: 'membership',
    plan_id: 'pln_1',
    amount_zar: 699,
    name: 'Ada',
    email: 'ada@example.com',
    status: 'pending',
    paystack_ref: 'gym-sale-1',
    created_at: new Date().toISOString(),
  },
  { companyId: 9 }
);
assert.equal(replay.sale.status, 'paid');
assert.equal(replay.store.subscriptions.length, applied.store.subscriptions.length);

const prog = applyPaidGymSale(
  applied.store,
  {
    id: 'gsl_2',
    kind: 'programme',
    programme_id: 'prg_1',
    amount_zar: 450,
    name: 'Ada',
    email: 'ada@example.com',
    status: 'pending',
    paystack_ref: 'gym-sale-2',
    created_at: new Date().toISOString(),
  },
  { companyId: 9 }
);
assert.ok(prog.client.purchased_programme_ids?.includes('prg_1'));
assert.ok(
  (prog.store.programme_enrollments || []).some(
    (e) => e.client_id === prog.client.id && e.programme_id === 'prg_1'
  )
);
assert.equal(prog.client.id, applied.client.id);
assert.equal(prog.client.membership_status, 'active');
assert.equal(clientHasPaidAccess(applied.store, applied.client), true);

const guest = emptyFitgraphStore();
guest.membership_plans = store.membership_plans;
guest.clients = [
  {
    id: 'cli_trial',
    code: 'W-1',
    name: 'Bea',
    email: 'bea@example.com',
    membership_status: 'trial',
    active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
];
assert.equal(clientHasPaidAccess(guest, guest.clients[0]), false);

const programmeOnly = applyPaidGymSale(
  guest,
  {
    id: 'gsl_3',
    kind: 'programme',
    programme_id: 'prg_1',
    amount_zar: 450,
    name: 'Bea',
    email: 'bea@example.com',
    status: 'pending',
    paystack_ref: 'gym-sale-3',
    created_at: new Date().toISOString(),
  },
  { companyId: 9 }
);
assert.ok(programmeOnly.client.purchased_programme_ids?.includes('prg_1'));
assert.equal(programmeOnly.client.membership_status, 'trial');
assert.equal(
  clientHasPaidAccess(programmeOnly.store, programmeOnly.client),
  false
);

const addonStore = applied.store;
addonStore.membership_plans.push({
  id: 'pln_addon',
  code: 'ADD',
  name: 'Tech add-on',
  price_zar: 150,
  billing: 'monthly',
  public: true,
  active: true,
  addon: true,
  created_at: '2026-01-01T00:00:00.000Z',
});
const withAddon = applyPaidGymSale(
  addonStore,
  {
    id: 'gsl_addon',
    kind: 'membership',
    plan_id: 'pln_addon',
    amount_zar: 150,
    name: 'Ada',
    email: 'ada@example.com',
    status: 'pending',
    paystack_ref: 'gym-sale-addon',
    created_at: new Date().toISOString(),
  },
  { companyId: 9 }
);
assert.equal(withAddon.client.membership_plan_id, 'pln_1');
assert.equal(
  withAddon.store.subscriptions.filter((s) => s.status === 'active').length,
  2
);

assert.equal(parseGymSaleKind('programme'), 'programme');
assert.equal(parseGymSaleKind('membership'), 'membership');
assert.equal(parseGymSaleKind('product'), 'product');
assert.equal(parseGymSaleKind(''), 'membership');

void newId;
console.log('gym-shop.test.ts ok');
