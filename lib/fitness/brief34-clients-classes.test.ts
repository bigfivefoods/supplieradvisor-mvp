/**
 * Brief 34 — one people book, standalone class roster.
 * Run: npx --yes tsx lib/fitness/brief34-clients-classes.test.ts
 */
import assert from 'node:assert/strict';
import { MODULE_NAV } from '../chrome/module-nav';
import { INDUSTRY_PACKS } from '../product/architecture';
import { omitClientRosterFields } from './client-roster-fields';
import { storeUsesClassSubscribe } from './vuka-class-catalog';
import { emptyFitgraphStore } from './fitgraph';

const gym = MODULE_NAV.find((m) => m.id === 'fitgraph');
assert.ok(gym, 'GymAdvisor nav exists');
const stepNames = gym!.steps.map((s) => s.name);
assert.ok(stepNames.includes('Clients'));
assert.ok(stepNames.includes('Classes'));
assert.equal(stepNames.includes('Membership'), false);
const classesStep = gym!.steps.find((s) => s.name === 'Classes')!;
assert.equal(classesStep.href, '/dashboard/fitgraph/classes');
assert.match(String(classesStep.desc), /booked members/i);
const clientsStep = gym!.steps.find((s) => s.name === 'Clients')!;
assert.equal(clientsStep.href, '/dashboard/fitgraph/clients');

const pack = INDUSTRY_PACKS.find((p) => p.id === 'fitness_gym');
assert.ok(pack);
assert.equal(
  pack!.industryToolsHrefs.some((h) => h.name === 'Membership'),
  false
);
const packClasses = pack!.industryToolsHrefs.find((h) => h.name === 'Classes');
assert.equal(packClasses?.href, '/dashboard/fitgraph/classes');
assert.match(String(packClasses?.desc), /booked members/i);
const packClients = pack!.industryToolsHrefs.find((h) => h.name === 'Clients');
assert.equal(packClients?.href, '/dashboard/fitgraph/clients');

const stripped = omitClientRosterFields({
  id: 'cli_1',
  name: 'Ada',
  email: 'ada@test.com',
  phone: '082',
  membership_plan_id: 'plan_a',
  private_client: true,
  membership_status: 'active',
  agreed_rate_zar: 800,
  private_rate_zar: 650,
  active: false,
  notes: 'keep',
});
assert.equal(stripped.name, 'Ada');
assert.equal(stripped.notes, 'keep');
assert.equal('membership_plan_id' in stripped, false);
assert.equal('private_client' in stripped, false);
assert.equal('membership_status' in stripped, false);
assert.equal('agreed_rate_zar' in stripped, false);
assert.equal('private_rate_zar' in stripped, false);
assert.equal('active' in stripped, false);

const vuka = emptyFitgraphStore();
vuka.settings = { ...vuka.settings, class_subscribe: true };
assert.equal(storeUsesClassSubscribe(vuka), true);
const other = emptyFitgraphStore();
assert.equal(storeUsesClassSubscribe(other), false);

console.log('brief34-clients-classes.test.ts ok');
