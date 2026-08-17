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
const desk = store.membership_plans.find((p) => p.id === 'vuka_pln_desk_77050');
assert.ok(desk);
assert.equal(aimee.membership_plan_id, desk!.id);

const again = ensureVukaRoster(store, { now: '2026-08-17T12:00:00.000Z' });
assert.equal(again.changed, false);
assert.equal(again.added, 0);
assert.equal(store.clients.filter((c) => c.id.startsWith('vuka_cli_')).length, VUKA_ROSTER.length);

console.log('vuka-roster.test.ts ok');
