/**
 * Run: npx --yes tsx lib/advisors/process-flows/brief121-core-caps.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TEAM_ROLE_OPTIONS, canView, resourceForPath, type TeamRole } from '../../business/permissions';
import {
  CORE_CAP_KEYS,
  CORE_CAP_RESOURCE,
  CORE_MODULE_RESOURCE,
  SALES_PORTAL_SERVER_ROLES,
  coreFlowCaps,
  coreFlowMountState,
  isExactTeamRole,
  writeRolesForCap,
  type CoreCapKey,
} from './core-caps';
import type { CoreFlowModuleId } from './types';

function serverRolesFromSource(): string[] {
  const src = readFileSync('lib/sales-contractor/access.ts', 'utf8');
  const start = src.indexOf('const allowed');
  const end = src.indexOf('if (!allowed)');
  assert.ok(start >= 0 && end > start);
  return [...src.slice(start, end).matchAll(/role === '([a-z_]+)'/g)].map((match) => match[1]);
}

const serverRoles = serverRolesFromSource();
assert.deepEqual(serverRoles, ['sales_contractor', 'owner', 'admin', 'finance', 'sales']);
assert.deepEqual([...SALES_PORTAL_SERVER_ROLES], serverRoles);

function expectedCaps(role: string | null | undefined): Record<CoreCapKey, boolean> {
  const caps = {} as Record<CoreCapKey, boolean>;
  for (const key of CORE_CAP_KEYS) {
    if (!isExactTeamRole(role)) caps[key] = false;
    else if (key === 'canUseSalesPortal') caps[key] = serverRoles.includes(role);
    else caps[key] = canView(role, CORE_CAP_RESOURCE[key]);
  }
  return caps;
}

const roles = TEAM_ROLE_OPTIONS.map((option) => option.value);
for (const role of [...roles, null, undefined, '', 'none', 'cfo']) {
  assert.deepEqual(coreFlowCaps(role), expectedCaps(role), String(role));
}

assert.equal(canView('member', 'sales_portal'), true);
assert.equal(coreFlowCaps('member').canUseSalesPortal, false);
assert.equal(canView('viewer', 'sales_portal'), true);
assert.equal(coreFlowCaps('viewer').canUseSalesPortal, false);
assert.equal(canView('operations', 'sales_portal'), true);
assert.equal(coreFlowCaps('operations').canUseSalesPortal, false);
assert.equal(coreFlowCaps('cfo').canViewSuppliers, false);
assert.equal(canView('cfo', 'suppliers'), true);

const modules = Object.keys(CORE_MODULE_RESOURCE) as CoreFlowModuleId[];

function expectMount(role: TeamRole, module: CoreFlowModuleId): boolean {
  if (role === 'sales_contractor' && module !== 'sales-portal') return false;
  if (module === 'sales-portal') return serverRoles.includes(role);
  return canView(role, CORE_MODULE_RESOURCE[module]);
}

for (const role of roles) {
  for (const module of modules) {
    const state = coreFlowMountState({ role, loading: false, module, fixture: false });
    const mount = expectMount(role, module);
    assert.equal(state.mount, mount, `${role} ${module}`);
    assert.equal(state.role, role, `${role} ${module}`);
    assert.deepEqual(state.caps, coreFlowCaps(role));
  }
}

for (const module of modules) {
  for (const role of [null, undefined, '', 'none', 'cfo'] as const) {
    const state = coreFlowMountState({ role, loading: false, module, fixture: false });
    assert.equal(state.mount, false, `${String(role)} ${module}`);
    assert.equal(state.role, null);
  }
  const loading = coreFlowMountState({ role: 'owner', loading: true, module, fixture: false });
  assert.equal(loading.mount, false, module);
  assert.equal(loading.role, null);
  const fixture = coreFlowMountState({ role: null, loading: true, module, fixture: true });
  assert.equal(fixture.mount, true, module);
  assert.equal(fixture.role, 'owner');
  assert.deepEqual(fixture.caps, coreFlowCaps('owner'));
}

const contractorHome = coreFlowMountState({
  role: 'sales_contractor',
  loading: false,
  module: 'home',
  fixture: false,
});
assert.equal(contractorHome.mount, false);
assert.equal(canView('sales_contractor', 'customers'), true);
const contractorCustomers = coreFlowMountState({
  role: 'sales_contractor',
  loading: false,
  module: 'customers',
  fixture: false,
});
assert.equal(contractorCustomers.mount, false);

assert.equal(
  coreFlowMountState({ role: 'sales_contractor', loading: false, module: 'suppliers', fixture: false }).mount,
  false
);
assert.equal(
  coreFlowMountState({ role: 'viewer', loading: false, module: 'sales-portal', fixture: false }).mount,
  false
);
assert.equal(
  coreFlowMountState({ role: 'member', loading: false, module: 'sales-portal', fixture: false }).mount,
  false
);
assert.equal(
  coreFlowMountState({ role: 'sales_contractor', loading: false, module: 'inventory', fixture: false }).mount,
  false
);
assert.equal(
  coreFlowMountState({ role: 'sales_contractor', loading: false, module: 'quality', fixture: false }).mount,
  false
);
assert.equal(
  coreFlowMountState({ role: 'viewer', loading: false, module: 'manufacturing', fixture: false }).mount,
  true
);
assert.equal(resourceForPath('/dashboard/quality'), 'sheq');
assert.equal(CORE_MODULE_RESOURCE.quality, resourceForPath('/dashboard/quality'));
assert.equal(CORE_MODULE_RESOURCE.sheq, 'sheq');
assert.deepEqual(writeRolesForCap('canViewManufacturing'), ['owner', 'admin', 'member', 'operations']);
assert.deepEqual(writeRolesForCap('canViewDistribution'), ['owner', 'admin', 'member', 'operations']);
assert.deepEqual(writeRolesForCap('canViewInventory'), ['owner', 'admin', 'member', 'operations']);
assert.deepEqual(writeRolesForCap('canViewSheq'), ['owner', 'admin', 'member', 'operations']);
assert.equal(writeRolesForCap('canViewSheq').includes('sales'), false);
assert.equal(writeRolesForCap('canViewManufacturing').includes('viewer'), false);
assert.deepEqual(writeRolesForCap('canViewProjects'), ['owner', 'admin', 'member', 'operations']);
assert.deepEqual(writeRolesForCap('canViewPeople'), ['owner', 'admin', 'member', 'finance', 'operations']);
assert.deepEqual(writeRolesForCap('canViewNetwork'), ['owner', 'admin', 'member']);
assert.deepEqual(writeRolesForCap('canViewAccounting'), ['owner', 'finance']);
assert.deepEqual(writeRolesForCap('canViewOperations'), ['owner', 'admin', 'member', 'operations']);
assert.equal(writeRolesForCap('canViewAccounting').includes('admin'), false);
assert.equal(writeRolesForCap('canViewPeople').includes('sales'), false);
assert.equal(writeRolesForCap('canViewNetwork').includes('finance'), false);

assert.equal(resourceForPath('/dashboard/sustainability'), 'operations');
assert.equal(resourceForPath('/dashboard/sustainability/carbon-tracking'), 'operations');
assert.equal(CORE_MODULE_RESOURCE.sustainability, resourceForPath('/dashboard/sustainability'));
assert.equal(resourceForPath('/dashboard/connections'), 'network');
assert.equal(CORE_MODULE_RESOURCE.network, 'network');
assert.equal(resourceForPath('/dashboard/accounting'), 'accounting');
assert.equal(CORE_MODULE_RESOURCE.accounting, 'accounting');
assert.equal(resourceForPath('/dashboard/people'), 'people');
assert.equal(CORE_MODULE_RESOURCE.people, 'people');
assert.equal(CORE_MODULE_RESOURCE.people, resourceForPath('/dashboard/people'));
assert.equal(resourceForPath('/dashboard/projects'), 'projects');
assert.equal(CORE_MODULE_RESOURCE.projects, 'projects');
assert.equal(CORE_MODULE_RESOURCE.projects, resourceForPath('/dashboard/projects'));

assert.equal(
  coreFlowMountState({ role: 'admin', loading: false, module: 'accounting', fixture: false }).mount,
  false
);
assert.equal(
  coreFlowMountState({ role: 'member', loading: false, module: 'accounting', fixture: false }).mount,
  false
);
assert.equal(
  coreFlowMountState({ role: 'finance', loading: false, module: 'accounting', fixture: false }).mount,
  true
);
assert.equal(
  coreFlowMountState({ role: 'owner', loading: false, module: 'accounting', fixture: false }).mount,
  true
);
assert.equal(
  coreFlowMountState({ role: 'viewer', loading: false, module: 'projects', fixture: false }).mount,
  true
);
assert.equal(
  coreFlowMountState({ role: 'sales', loading: false, module: 'people', fixture: false }).mount,
  true
);
assert.equal(
  coreFlowMountState({ role: 'sales_contractor', loading: false, module: 'projects', fixture: false }).mount,
  false
);
assert.equal(
  coreFlowMountState({ role: 'sales_contractor', loading: false, module: 'people', fixture: false }).mount,
  false
);
assert.equal(
  coreFlowMountState({ role: 'sales_contractor', loading: false, module: 'sustainability', fixture: false }).mount,
  false
);
assert.equal(
  coreFlowMountState({ role: 'sales_contractor', loading: false, module: 'network', fixture: false }).mount,
  false
);
assert.equal(
  coreFlowMountState({ role: 'sales_contractor', loading: false, module: 'accounting', fixture: false }).mount,
  false
);
assert.equal(
  coreFlowMountState({ role: 'finance', loading: true, module: 'accounting', fixture: false }).mount,
  false
);

const journalGate = readFileSync('app/api/accounting/journals/route.ts', 'utf8');
assert.match(journalGate, /'accounting',\s*'write'/);
const payrollGate = readFileSync('app/api/hr/payroll/route.ts', 'utf8');
assert.match(payrollGate, /requireCompanyAccess/);
assert.equal(payrollGate.includes('requireCompanyPermission'), false);
const projectGate = readFileSync('app/api/projects/route.ts', 'utf8');
assert.match(projectGate, /requireCompanyAccess/);
assert.equal(projectGate.includes('requireCompanyPermission'), false);
const connectionGate = readFileSync('app/api/connections/route.ts', 'utf8');
assert.match(connectionGate, /requireCompanyAccess/);
assert.equal(connectionGate.includes('requireCompanyPermission'), false);

console.log('brief121-core-caps.test.ts ok');
