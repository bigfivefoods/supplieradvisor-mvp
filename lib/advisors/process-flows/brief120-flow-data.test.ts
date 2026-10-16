/**
 * Run: npx --yes tsx lib/advisors/process-flows/brief120-flow-data.test.ts
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ADVISOR_FLOWS } from './index';
import { FLOW_ICON_NAMES, type AdvisorFlowDef } from './types';

function read(file: string): string {
  return readFileSync(file, 'utf8');
}

function unionMembers(file: string, typeName: string): string[] {
  const src = read(file);
  const matched = src.match(new RegExp(`export type ${typeName}\\s*=\\s*([^;]+);`));
  assert.ok(matched, `${typeName} in ${file}`);
  return matched[1]
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('|')
    .map((part) => part.trim().replace(/'/g, ''))
    .filter((part) => /^[a-z0-9_]+$/.test(part));
}

function booleanFields(file: string, typeName: string): string[] {
  const src = read(file);
  const start = src.indexOf(`export type ${typeName}`);
  assert.ok(start >= 0, typeName);
  const brace = src.indexOf('{', start);
  const end = src.indexOf('};', brace);
  const body = src.slice(brace + 1, end);
  const keys: string[] = [];
  for (const line of body.split('\n')) {
    const field = line.match(/^\s*([A-Za-z0-9_]+)\??:\s*boolean\b/);
    if (field) keys.push(field[1]);
  }
  return keys;
}

function teamRoleIds(): string[] {
  const hook = read('lib/business/useCompanyRole.ts');
  assert.match(hook, /normalizeTeamRole/);
  assert.match(hook, /TeamRole/);
  return unionMembers('lib/business/permissions.ts', 'TeamRole');
}

function roleIdsFor(module: string): string[] {
  if (module === 'constructiongraph') return unionMembers('lib/construction/roles.ts', 'ConstructionRole');
  if (module === 'fleetgraph') return unionMembers('lib/fleet/types.ts', 'FleetRole');
  if (module === 'tradegraph' || module === 'apparelgraph' || module === 'containers') return teamRoleIds();
  if (module === 'health') return ['department', 'facility', 'sp'];
  throw new Error(`No role source for ${module}`);
}

function capKeysFor(module: string): string[] | null {
  if (module === 'constructiongraph') return booleanFields('lib/construction/roles.ts', 'ConstructionCapabilities');
  if (module === 'fleetgraph') return booleanFields('lib/fleet/roles.ts', 'FleetCapabilities');
  if (module === 'tradegraph' || module === 'apparelgraph' || module === 'containers' || module === 'health') return [];
  return null;
}

function walkLib(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walkLib(full, acc);
    else if (name.endsWith('.ts') && !name.includes('.test.')) acc.push(full);
  }
  return acc;
}

const flows = Object.values(ADVISOR_FLOWS).filter((flow): flow is AdvisorFlowDef => Boolean(flow));
assert.ok(flows.length > 0);

const doc = read('docs/advisor-process-flows.md');
assert.match(doc, /ADVISOR_FLOWS/);
assert.match(doc, /brief120-flow-mounts\.test\.ts/);
assert.match(doc, /FLOW_ICON_NAMES/);
for (const flow of flows) {
  assert.equal(flow.anchorId.includes('®'), false);
  assert.equal(flow.module.includes('®'), false);
  assert.equal(flow.product.includes('®'), true, flow.module);
  assert.equal(flow.title.includes('®'), true, flow.module);
  assert.equal(flow.hrefRoot.startsWith('/dashboard/'), true, flow.hrefRoot);
  assert.ok(flow.guardrails.length >= 3 && flow.guardrails.length <= 5, flow.module);
  const roles = roleIdsFor(flow.module);
  for (const role of flow.roles) {
    assert.equal(roles.includes(role.id), true, `${flow.module} role ${role.id}`);
    assert.equal(role.id.includes('®'), false);
  }
  const caps = capKeysFor(flow.module);
  assert.ok(caps, flow.module);
  const phaseIds = new Set(flow.phases.map((phase) => phase.id));
  const counts = new Map<string, number>();
  flow.steps.forEach((step, index) => {
    assert.equal(step.n, index + 1, `${flow.module} ${step.id}`);
    assert.equal(phaseIds.has(step.phase), true, step.id);
    counts.set(step.phase, (counts.get(step.phase) || 0) + 1);
    assert.equal(step.id, step.id.toLowerCase(), step.id);
    assert.match(step.id, /^[a-z0-9_]+$/);
    assert.equal(step.id.includes('®'), false);
    assert.equal(step.sources.length >= 1, true, step.id);
    for (const source of step.sources) {
      assert.equal(existsSync(source), true, source);
      assert.equal(source.includes('®'), false, source);
    }
    if (step.status === 'soon') {
      assert.equal(step.to, null, step.id);
      assert.equal(typeof step.note, 'string', step.id);
      assert.ok(step.note && step.note.length > 0, step.id);
    }
    if (step.status === 'partial') assert.ok(step.note && step.note.length > 0, step.id);
    if (step.status === 'live') assert.ok(step.to, step.id);
    const targets = [step.to, ...(step.secondary || [])].filter((target) => target != null);
    for (const target of targets) {
      assert.equal(target.path.includes('®'), false, target.path);
      if (target.needs) assert.equal(caps.includes(target.needs), true, `${flow.module} ${target.needs}`);
    }
  });
  for (const [phase, count] of counts) {
    assert.ok(count <= 4, `${flow.module} ${phase} has ${count}`);
  }
  for (const phase of flow.phases) {
    assert.ok(flow.steps.some((step) => step.phase === phase.id), phase.id);
  }
  const ids = flow.steps.map((step) => step.id);
  assert.equal(new Set(ids).size, ids.length, flow.module);
  for (const guard of flow.guardrails) {
    assert.ok(guard.source.length > 0);
    assert.equal(existsSync(guard.source), true, guard.source);
  }
  for (const path of flow.previewPaths) assert.equal(path.includes('®'), false, path);
  for (const link of flow.around?.links || []) {
    assert.equal(link.path.includes('®'), false);
    if (link.needs) assert.equal(caps.includes(link.needs), true, link.needs);
  }
}

const ALLOWED_NUMBERS = ['15 percent'];
const NUMBER_WORDS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
  'twenty',
  'thirty',
  'forty',
  'fifty',
  'sixty',
  'seventy',
  'eighty',
  'ninety',
  'hundred',
  'thousand',
];
const spelledPercent = new RegExp(`\\b(${NUMBER_WORDS.join('|')})\\s+percent\\b`, 'i');
assert.equal(spelledPercent.test('Twelve percent of the fleet'), true);
assert.equal(spelledPercent.test('in one place'), false);

function visibleCopy(flow: AdvisorFlowDef): string[] {
  const lines = [flow.product, flow.title, flow.lead, flow.outcome];
  for (const phase of flow.phases) lines.push(phase.title, phase.subtitle);
  for (const role of flow.roles) lines.push(role.label);
  for (const step of flow.steps) {
    lines.push(step.title, step.desc, step.who);
    if (step.note) lines.push(step.note);
    if (step.to) lines.push(step.to.label);
    for (const extra of step.secondary || []) lines.push(extra.label);
  }
  for (const guard of flow.guardrails) lines.push(guard.title, guard.body);
  if (flow.around) {
    lines.push(flow.around.title);
    for (const link of flow.around.links) lines.push(link.label);
  }
  return lines;
}

for (const flow of flows) {
  for (const line of visibleCopy(flow)) {
    let rest = line;
    for (const phrase of ALLOWED_NUMBERS) rest = rest.split(phrase).join('');
    assert.equal(/\d/.test(rest), false, `${flow.module} copy has a number outside the allow-list: ${line}`);
    assert.equal(spelledPercent.test(line), false, `${flow.module} copy spells a percent: ${line}`);
  }
}

const construction = flows.find((flow) => flow.module === 'constructiongraph');
assert.ok(construction);
const quotes = construction.steps.find((step) => step.id === 'quotes');
const trades = construction.steps.find((step) => step.id === 'trades');
const claims = construction.steps.find((step) => step.id === 'claims');
assert.ok(quotes && trades && claims);
assert.equal(quotes.status, 'partial');
assert.equal(trades.status, 'partial');
assert.equal(quotes.desc.includes('beside'), false);
assert.match(quotes.desc, /listed under the quotes/);
assert.equal(claims.desc.toLowerCase().includes('approved'), false);
assert.match(claims.desc, /certifies a claim/);
assert.equal(claims.to?.needs, 'canCertify');
const certificates = claims?.secondary?.find((target) => target.path === 'certificates');
const portal = construction.steps.find((step) => step.id === 'reports')?.secondary?.find((target) => target.path === 'portal');
assert.equal(certificates?.needs, 'canCertify');
assert.equal(portal?.needs, 'canManagePortals');
const siteMoney = construction.guardrails.find((item) => item.source.endsWith('constructiongraph/route.ts'));
assert.ok(siteMoney);
assert.match(siteMoney.body, /includes those claims and certificates again/);
assert.equal(siteMoney.body.includes('not to this desk'), false);
const diary = construction.guardrails.find((item) => item.title.toLowerCase().includes('diary') || item.body.toLowerCase().includes('sign-off'));
assert.ok(diary);
assert.equal(diary.body.toLowerCase().includes('addendum'), false);

const fleet = flows.find((flow) => flow.module === 'fleetgraph');
assert.ok(fleet);
const fleetStep = (id: string) => {
  const step = fleet.steps.find((item) => item.id === id);
  assert.ok(step, id);
  return step;
};
assert.equal(fleetStep('jobs').status, 'partial');
assert.match(fleetStep('jobs').note || '', /not switched on/);
assert.equal(fleetStep('map').status, 'partial');
assert.match(fleetStep('map').desc, /last odometer distance/);
assert.match(fleetStep('map').desc, /not a place on a map/);
assert.equal(/last recorded/.test(fleetStep('map').desc), false);
assert.match(fleetStep('map').note || '', /Live positions launching soon/);
assert.equal(fleetStep('dispatch').status, 'soon');
assert.equal(fleetStep('dispatch').to, null);
assert.equal(fleetStep('invoicing').status, 'soon');
assert.equal(fleetStep('invoicing').to, null);
assert.deepEqual([...fleetStep('vehicles').roles], ['owner', 'manager', 'dispatcher']);
assert.notDeepEqual(fleetStep('vehicles').roles, []);
assert.deepEqual([...fleetStep('costs').roles], ['owner', 'manager', 'dispatcher']);
assert.equal(fleetStep('costs').to?.needs, 'canEditRegister');
assert.equal(fleetStep('costs').secondary?.find((target) => target.label === 'Running costs')?.needs, 'seesCosts');
assert.match(fleetStep('costs').desc, /dispatcher records an odometer reading/);
assert.match(fleetStep('costs').desc, /owner or a manager also records a running cost/);
assert.equal(fleetStep('cpk').to?.needs, 'seesCosts');
assert.deepEqual([...fleetStep('cpk').roles], ['owner', 'manager', 'office']);
assert.equal(fleetStep('settings').to?.needs, undefined);
assert.equal((fleetStep('settings').secondary || []).some((target) => target.needs), false);
assert.equal(fleetStep('vehicles').secondary?.find((target) => target.path === 'import')?.needs, 'canImportCsv');
for (const role of fleet.roles) {
  const open = role.id === 'owner' || role.id === 'manager';
  assert.equal(role.openByDefault, open, role.id);
}
const dispatcherCosts = fleet.guardrails.find((item) => item.title.toLowerCase().includes('dispatcher'));
assert.ok(dispatcherCosts);
assert.match(dispatcherCosts.body, /do not see cost per kilometre/);
assert.match(dispatcherCosts.body, /job prices only when the owner turns that switch on/);
assert.match(dispatcherCosts.body, /does not reveal costs/);
assert.equal(/cost per kilometre unless/.test(dispatcherCosts.body), false);
const costWrite = fleet.guardrails.find((item) => item.source.endsWith('fleetgraph/route.ts'));
assert.ok(costWrite);
assert.match(costWrite.body, /owner or manager can add a running cost/);
assert.match(costWrite.body, /refuses the write/);
const pay = fleet.guardrails.find((item) => item.body.toLowerCase().includes('driver pay'));
assert.ok(pay);
assert.match(pay.body, /leaves driver pay out/);

const apparel = flows.find((flow) => flow.module === 'apparelgraph');
assert.ok(apparel);
const apparelStep = (id: string) => {
  const step = apparel.steps.find((item) => item.id === id);
  assert.ok(step, id);
  return step;
};
for (const id of ['samples', 'capacity', 'floor', 'quality', 'ship']) assert.equal(apparelStep(id).status, 'partial', id);
for (const id of ['range', 'styles', 'costing', 'path', 'wholesale']) assert.equal(apparelStep(id).status, 'live', id);
for (const step of apparel.steps) {
  assert.equal(step.roles.length, 0, step.id);
  assert.equal(['Brand', 'Factory', 'Brand / Factory'].includes(step.who), true, step.who);
  const targets = [step.to, ...(step.secondary || [])].filter((target) => target != null);
  for (const target of targets) assert.equal(target.needs, undefined, step.id);
}
for (const role of apparel.roles) {
  const open = role.id === 'owner' || role.id === 'admin';
  assert.equal(role.openByDefault, open, role.id);
}
const release = apparel.guardrails.find((item) => item.source.endsWith('apparelgraph.ts') && item.body.includes('blocked'));
assert.ok(release);
assert.match(release.body, /four-point/);
assert.match(release.body, /NBC date is past/);
assert.match(release.body, /QA hold is open/);
assert.match(release.body, /does not stop a shipment/);
const apparelVisible = visibleCopy(apparel).join('\n');
assert.equal(/\bstop a ship\b/i.test(apparelVisible), false);
assert.match(apparel.lead, /ship screen shows when release is blocked/);
assert.equal(apparel.previewRoot, null);
assert.equal(apparel.previewPaths.length, 0);

const component = read('components/advisors/AdvisorProcessFlow.tsx');
for (const name of FLOW_ICON_NAMES) {
  const quoted = component.includes(`'${name}':`) || component.includes(`"${name}":`);
  const bare = new RegExp(`(?:^|\\n)\\s*${name}:`).test(component);
  assert.equal(quoted || bare, true, `ICONS map is missing ${name}`);
}

for (const file of walkLib('lib/advisors/process-flows')) {
  const text = read(file);
  assert.equal(text.includes("from 'react'"), false, file);
  assert.equal(text.includes('from "react"'), false, file);
  assert.equal(text.includes('next/headers'), false, file);
}

console.log('brief120-flow-data.test.ts ok');
