/**
 * Run: npx --yes tsx lib/fitness/vuka-roster.test.ts
 */
import assert from 'node:assert/strict';
import { emptyFitgraphStore } from './fitgraph';
import { ensureVukaClassCatalog, VUKA_COMPANY_ID } from './vuka-class-catalog';
import {
  ensureVukaRoster,
  matchCatalogPlan,
  normalizePersonName,
  VUKA_ROSTER,
} from './vuka-roster';

assert.equal(normalizePersonName('Sue (S Westhorpe)'), 'sue');
assert.equal(normalizePersonName('JACQUES VAN ROOYEN'), 'jacques van rooyen');
assert.ok(VUKA_ROSTER.length >= 64);
assert.equal(
  VUKA_ROSTER.filter((r) => normalizePersonName(r.name) === 'malan snyman')
    .length,
  1
);

assert.equal(matchCatalogPlan(1140)?.code, 'VUKA_UNLIM');
assert.equal(matchCatalogPlan(1265)?.code, 'VUKA_PILATES_3');
assert.equal(matchCatalogPlan(855)?.code, 'VUKA_PILATES_2');
assert.equal(matchCatalogPlan(530)?.code, 'VUKA_KIDS');
assert.equal(matchCatalogPlan(908.5)?.code, 'VUKA_FSF_5AM');
assert.equal(matchCatalogPlan(529)?.code, 'VUKA_KIDS');
assert.equal(matchCatalogPlan(530, 'ZACH kids Gym')?.code, 'VUKA_KIDS');
assert.equal(matchCatalogPlan(770.5), null);
assert.equal(matchCatalogPlan(775), null);

const store = emptyFitgraphStore();
ensureVukaClassCatalog(store, { companyId: VUKA_COMPANY_ID });
const first = ensureVukaRoster(store, { now: '2026-08-17T12:00:00.000Z' });
assert.equal(first.changed, true);
assert.equal(first.added, VUKA_ROSTER.length);
assert.ok(store.clients.some((c) => c.name === 'Lorraine Naidoo'));
const lorraine = store.clients.find((c) => c.name === 'Lorraine Naidoo')!;
const unlim = store.membership_plans.find((p) => p.code === 'VUKA_UNLIM')!;
assert.equal(lorraine.membership_plan_id, unlim.id);
assert.ok(
  store.subscriptions.some(
    (s) => s.client_id === lorraine.id && s.plan_id === unlim.id
  )
);
const shaun = store.clients.find((c) => c.name === 'Shaun Roberts')!;
const kids = store.membership_plans.find((p) => p.code === 'VUKA_KIDS')!;
assert.equal(shaun.membership_plan_id, kids.id);
const aimee = store.clients.find((c) => c.name === 'Aimee Le Roux')!;
assert.equal(
  store.membership_plans.some(
    (p) => String(p.code || '').startsWith('VUKA_DESK_')
  ),
  false
);
assert.equal(aimee.membership_plan_id == null, true);
assert.match(String(aimee.notes || ''), /770\.50/);

store.membership_plans.push({
  id: 'vuka_pln_desk_99900',
  code: 'VUKA_DESK_99900',
  name: 'VUKA membership · R999.00',
  price_zar: 999,
  billing: 'monthly',
  public: false,
  catalog: 'vuka',
  created_at: '2026-08-17T12:00:00.000Z',
});
const cleaned = ensureVukaRoster(store, { now: '2026-08-17T12:00:00.000Z' });
assert.equal(cleaned.changed, true);
assert.equal(
  store.membership_plans.some((p) => String(p.code || '').startsWith('VUKA_DESK_')),
  false
);

const again = ensureVukaRoster(store, { now: '2026-08-17T12:00:00.000Z' });
assert.equal(again.changed, false);
assert.equal(again.added, 0);
assert.equal(store.clients.filter((c) => c.id.startsWith('vuka_cli_')).length, VUKA_ROSTER.length);

console.log('vuka-roster.test.ts ok');
