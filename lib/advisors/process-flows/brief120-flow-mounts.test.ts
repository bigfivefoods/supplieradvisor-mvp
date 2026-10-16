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
  containers: { file: 'app/dashboard/containers/page.tsx', moduleAttr: 'module="containers"' },
  health: { file: 'app/dashboard/health/page.tsx', moduleAttr: 'sliceHealthFlow(audience)' },
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

const containersPage = readFileSync('app/dashboard/containers/page.tsx', 'utf8');
assert.match(containersPage, /useCompanyRole\(/);
assert.equal(containersPage.includes('useCompanyRole'), true);
const gridAt = containersPage.indexOf('<HubModuleGrid');
const principlesAt = containersPage.indexOf('<HubPrinciples');
const flowAt = containersPage.indexOf('<ContainersFlow');
assert.ok(gridAt >= 0 && principlesAt > gridAt && flowAt > gridAt && flowAt < principlesAt);
const containersFlow = containersPage.slice(containersPage.indexOf('function ContainersFlow'));
assert.match(containersFlow, /useCompanyRole\(/);
assert.match(containersFlow, /if \(company\.loading \|\| company\.role == null\) return null;/);
assert.match(containersFlow, /<AdvisorProcessFlow module="containers" role=\{company\.role\} hrefBase="\/dashboard\/containers" \/>/);
assert.equal(/role=\{['"]owner['"]\}/.test(containersFlow), false);
assert.equal(/<AdvisorProcessFlow[^>]*\bcaps=/.test(containersFlow), false);
assert.equal((containersPage.match(/module="containers"/g) || []).length, 1);

const healthPage = readFileSync('app/dashboard/health/page.tsx', 'utf8');
const inner = healthPage.slice(healthPage.indexOf('function Inner'));
const beforeDepartment = inner.slice(0, inner.indexOf("if (programme.role === 'department')"));
assert.equal(beforeDepartment.includes('HealthFlow'), false);
const department = inner.slice(
  inner.indexOf("if (programme.role === 'department')"),
  inner.indexOf("if (programme.role === 'sp')")
);
assert.match(department, /programme\.info\?\.role === 'department'/);
assert.match(department, /<HealthFlow audience="department" \/>/);
assert.equal(department.includes('audience="facility"'), false);
assert.equal(department.includes('audience="sp"'), false);
const spBlock = inner.slice(inner.indexOf("if (programme.role === 'sp')"), inner.lastIndexOf('\n  return ('));
const facilityBlock = inner.slice(inner.lastIndexOf('\n  return ('), inner.indexOf('function HealthFlow'));
assert.match(spBlock, /programme\.info\?\.role === 'sp'/);
assert.match(spBlock, /<HealthFlow audience="sp" \/>/);
assert.equal(spBlock.includes('audience="department"'), false);
assert.equal(spBlock.includes('audience="facility"'), false);
assert.match(facilityBlock, /programme\.info\?\.role === 'facility'/);
assert.match(facilityBlock, /<HealthFlow audience="facility" \/>/);
assert.equal(facilityBlock.includes('audience="department"'), false);
assert.equal(facilityBlock.includes('audience="sp"'), false);
const healthFlow = healthPage.slice(healthPage.indexOf('function HealthFlow'));
assert.match(healthFlow, /sliceHealthFlow\(audience\)/);
assert.match(healthFlow, /role: audience/);
assert.match(healthFlow, /audience,/);
assert.match(healthFlow, /hrefBase: '\/dashboard\/health'/);
assert.equal(/role:\s*'department'/.test(healthFlow), false);
assert.equal(/audience:\s*'facility'/.test(healthFlow), false);
assert.equal(/module="health"/.test(healthPage), false);
assert.equal((healthPage.match(/sliceHealthFlow\(audience\)/g) || []).length, 1);

console.log('brief120-flow-mounts.test.ts ok');
