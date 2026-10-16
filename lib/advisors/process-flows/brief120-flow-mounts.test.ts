/**
 * Run: npx --yes tsx lib/advisors/process-flows/brief120-flow-mounts.test.ts
 *
 * OWN is every module that already has its own diagram.
 * SHARED_MOUNTED is every module on AdvisorProcessFlow.
 * Anything else in ADVISOR_OS_MODULE_IDS is not registered. That remainder
 * is derived, so adding a shared module does not edit a second id list.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ADVISOR_OS_MODULE_IDS } from '../../chrome/functional-nav';
import { fleetProcessRole } from '../../fleet/roles';
import { ADVISOR_FLOWS } from './index';

const OWN: Record<string, { file: string; marker: string }> = {
  fitgraph: { file: 'app/dashboard/fitgraph/page.tsx', marker: 'FitgraphSystemFlow' },
  physiograph: { file: 'app/dashboard/physiograph/page.tsx', marker: 'PhysiographSystemFlow' },
  dentalgraph: { file: 'app/dashboard/dentalgraph/page.tsx', marker: 'DentalgraphSystemFlow' },
  psychiatrygraph: { file: 'app/dashboard/psychiatrygraph/page.tsx', marker: 'PsychiatrygraphSystemFlow' },
  medicalgraph: { file: 'app/dashboard/medicalgraph/page.tsx', marker: 'MedicalgraphSystemFlow' },
  vetgraph: { file: 'app/dashboard/vetgraph/page.tsx', marker: 'VetgraphSystemFlow' },
  hiregraph: { file: 'app/dashboard/hiregraph/page.tsx', marker: 'HiregraphSystemFlow' },
  retailgraph: { file: 'app/dashboard/retailgraph/page.tsx', marker: 'RetailgraphSystemFlow' },
  quarrygraph: { file: 'app/dashboard/quarrygraph/page.tsx', marker: 'QuarrygraphSystemFlow' },
  fieldgraph: { file: 'app/dashboard/fieldgraph/page.tsx', marker: 'FieldgraphSystemFlow' },
  schools: { file: 'app/dashboard/schools/page.tsx', marker: 'NsnpSystemFlow' },
  recovergraph: { file: 'components/recovery/RecoverCommand.tsx', marker: 'RecoverProcessFlow' },
};

const SHARED_MOUNTED: Record<string, { file: string; moduleAttr: string }> = {
  tradegraph: { file: 'components/trades/TradeScreens.tsx', moduleAttr: 'module="tradegraph"' },
  constructiongraph: {
    file: 'components/construction/views/CommandView.tsx',
    moduleAttr: 'module="constructiongraph"',
  },
  fleetgraph: { file: 'components/fleet/FleetViews.tsx', moduleAttr: 'module="fleetgraph"' },
  apparelgraph: { file: 'app/dashboard/apparelgraph/page.tsx', moduleAttr: 'module="apparelgraph"' },
};

const later = ADVISOR_OS_MODULE_IDS.filter((id) => !(id in OWN) && !(id in SHARED_MOUNTED));
const accounted = [...Object.keys(OWN), ...Object.keys(SHARED_MOUNTED), ...later];
assert.deepEqual([...accounted].sort(), [...ADVISOR_OS_MODULE_IDS].sort());

for (const [id, row] of Object.entries(OWN)) {
  const text = readFileSync(row.file, 'utf8');
  assert.equal(text.includes(row.marker), true, id);
  assert.equal(text.includes('AdvisorProcessFlow'), false, id);
  assert.equal(ADVISOR_FLOWS[id as keyof typeof ADVISOR_FLOWS], undefined, id);
}

for (const [id, row] of Object.entries(SHARED_MOUNTED)) {
  const text = readFileSync(row.file, 'utf8');
  const hits = text.match(new RegExp(row.moduleAttr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || [];
  assert.equal(hits.length, 1, id);
  assert.ok(ADVISOR_FLOWS[id as keyof typeof ADVISOR_FLOWS], id);
}

const trade = readFileSync('components/trades/TradeScreens.tsx', 'utf8');
const tradeCommand = trade.slice(trade.indexOf('export function TradeCommand'), trade.indexOf('function TradeFlowMount'));
assert.match(tradeCommand, /<TradeFlowMount\b/);

const construction = readFileSync('components/construction/views/CommandView.tsx', 'utf8');
assert.match(construction, /role !== 'none' \? \(\s*<AdvisorProcessFlow\b/);
assert.equal((construction.match(/<AdvisorProcessFlow\b/g) || []).length, 1);

for (const id of later) {
  assert.equal(ADVISOR_FLOWS[id as keyof typeof ADVISOR_FLOWS], undefined, id);
}

const fleet = readFileSync('components/fleet/FleetViews.tsx', 'utf8');
assert.equal(fleet.includes('useCompanyRole'), false);
assert.equal((fleet.match(/module="fleetgraph"/g) || []).length, 1);
assert.match(fleet, /function FleetFlow\(props: FleetDeskProps\) \{\s*const flowRole = fleetProcessRole\(\{/);
assert.match(fleet, /if \(!flowRole\) return null;/);
assert.match(fleet, /<AdvisorProcessFlow module="fleetgraph" role=\{flowRole\} caps=\{props\.caps\} hrefBase=\{props\.hrefBase\} \/>/);
assert.equal(fleetProcessRole({ role: 'owner', migrationPending: true, roleResolved: true }), undefined);
assert.equal(fleetProcessRole({ role: 'owner', roleResolved: false }), undefined);
assert.equal(fleetProcessRole({ role: 'viewer', migrationPending: true }), undefined);
assert.equal(fleetProcessRole({ role: 'none' }), undefined);
assert.equal(fleetProcessRole({ role: null }), undefined);
assert.equal(fleetProcessRole({ role: 'owner' }), 'owner');
assert.equal(fleetProcessRole({ role: 'dispatcher', roleResolved: true }), 'dispatcher');
const live = readFileSync('components/fleet/FleetLive.tsx', 'utf8');
const pending = live.slice(live.indexOf('if (body.ready === false)'), live.indexOf('if (body.book)'));
assert.match(pending, /setRoleResolved\(false\)/);
assert.equal(pending.includes('setRole('), false);
assert.match(live, /roleResolved=\{roleResolved\}/);
assert.match(live, /const \[roleResolved, setRoleResolved\] = useState\(false\)/);
const commandStart = fleet.indexOf('function CommandView');
const commandEnd = fleet.indexOf('function fleetRollup');
const command = fleet.slice(commandStart, commandEnd);
assert.equal((command.match(/<FleetFlow\b/g) || []).length, 2);
const emptyAt = command.indexOf('fleet-command-empty');
const setupAt = command.indexOf('title="Setup"');
assert.ok(emptyAt >= 0 && setupAt > emptyAt);
const flowAfterEmpty = command.indexOf('<FleetFlow', emptyAt);
const flowAfterSetup = command.indexOf('<FleetFlow', setupAt);
assert.ok(flowAfterEmpty > emptyAt && flowAfterEmpty < setupAt);
assert.ok(flowAfterSetup > setupAt);

const apparel = readFileSync('app/dashboard/apparelgraph/page.tsx', 'utf8');
assert.match(apparel, /useCompanyRole\(/);
assert.match(apparel, /hrefBase="\/dashboard\/apparelgraph"/);
assert.equal((apparel.match(/module="apparelgraph"/g) || []).length, 1);
assert.equal(/<AdvisorProcessFlow[^>]*\bcaps=/.test(apparel), false);
const branch = apparel.slice(apparel.indexOf('loading || !summary'));
const loading = branch.slice(0, branch.indexOf(') : ('));
assert.equal(loading.includes('ApparelFlow'), false);
assert.equal(branch.includes('<ApparelFlow'), true);
const apparelFlow = apparel.slice(apparel.indexOf('function ApparelFlow'));
assert.match(apparelFlow, /useCompanyRole\(/);
assert.match(apparelFlow, /const role = company\.loading \|\| company\.role == null \? undefined : company\.role/);
assert.match(apparelFlow, /<AdvisorProcessFlow module="apparelgraph" role=\{role\} hrefBase="\/dashboard\/apparelgraph" \/>/);
assert.equal(/role=\{['"]owner['"]\}/.test(apparelFlow), false);
assert.equal(/role=\{\s*['"]owner['"]\s*\}/.test(apparelFlow), false);

console.log('brief120-flow-mounts.test.ts ok');
