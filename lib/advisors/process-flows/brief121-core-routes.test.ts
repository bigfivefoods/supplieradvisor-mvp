/**
 * Run: npx --yes tsx lib/advisors/process-flows/brief121-core-routes.test.ts
 * Every core target is a real page, and none of them is a redirect stub.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { CORE_FLOWS } from './core';
import type { AdvisorFlowDef, FlowTarget } from './types';

/** Short file whose only job is to send the browser somewhere else. */
export function isRedirectStub(file: string): boolean {
  if (!existsSync(file)) return false;
  const text = readFileSync(file, 'utf8');
  if (text.split('\n').length >= 60) return false;
  const own = `/${file.replace(/^app\//, '').replace(/\/page\.tsx$/, '')}`;
  const calls = [
    ...text.matchAll(/(?:router\.replace|redirect)\(\s*['"`]([^'"`]+)['"`]/g),
    ...text.matchAll(/<LegacyRedirect\s+to=["']([^"']+)["']/g),
  ];
  if (calls.length === 0) return false;
  return calls.some((match) => match[1].split('?')[0].replace(/\/$/, '') !== own.replace(/\/$/, ''));
}

const NAMED_STUBS = [
  'app/dashboard/suppliers/connect/page.tsx',
  'app/dashboard/suppliers/search/page.tsx',
  'app/dashboard/suppliers/profiles/page.tsx',
  'app/dashboard/customers/search/page.tsx',
  'app/dashboard/inventory/finished-goods/page.tsx',
  'app/dashboard/inventory/raw-materials/page.tsx',
  'app/dashboard/inventory/cycle-counts/page.tsx',
  'app/dashboard/inventory/stock-take/page.tsx',
  'app/dashboard/inventory/sync/page.tsx',
  'app/dashboard/inventory/warehousing/page.tsx',
  'app/dashboard/projects/budgeting/page.tsx',
  'app/dashboard/projects/resource-allocation/page.tsx',
  'app/dashboard/people/employee-directory/page.tsx',
  'app/dashboard/people/performance-reviews/page.tsx',
];

/**
 * Same primary page on purpose:
 * home po + receive — receive is an action on the purchase order desk.
 * customers leads + pipeline — the leads page reads ?tab=pipeline.
 */
const SAME_PAGE: Record<string, string[][]> = {
  home: [['po', 'receive']],
  customers: [['leads', 'pipeline']],
};

function pageFor(flow: AdvisorFlowDef, target: FlowTarget): string {
  const raw = target.scope === 'app' ? target.path : `${flow.hrefRoot.replace(/\/$/, '')}/${target.path.replace(/^\//, '')}`;
  const path = raw.split('?')[0].replace(/\/$/, '');
  return `app${path}/page.tsx`;
}

assert.equal(
  CORE_FLOWS.customers.steps.find((step) => step.id === 'pipeline')?.to?.path,
  'leads?tab=pipeline'
);
assert.equal(
  CORE_FLOWS.customers.steps.find((step) => step.id === 'order')?.secondary?.find((target) => target.label === 'Inbound orders')?.path,
  'orders?tab=inbound'
);

assert.equal(isRedirectStub('app/dashboard/suppliers/connect/page.tsx'), true);
assert.equal(isRedirectStub('app/dashboard/suppliers/discover/page.tsx'), false);
assert.equal(isRedirectStub('app/dashboard/customers/leads/page.tsx'), false);
assert.equal(isRedirectStub('app/dashboard/inventory/finished-goods/page.tsx'), true);
assert.equal(isRedirectStub('app/dashboard/inventory/raw-materials/page.tsx'), true);
assert.equal(isRedirectStub('app/dashboard/inventory/cycle-counts/page.tsx'), true);
assert.equal(isRedirectStub('app/dashboard/inventory/stock-take/page.tsx'), true);
assert.equal(isRedirectStub('app/dashboard/inventory/products/page.tsx'), false);
assert.equal(isRedirectStub('app/dashboard/inventory/counts/page.tsx'), false);

const EXACT: Record<string, Record<string, { to: string | null; secondary: string[] }>> = {
  manufacturing: {
    bom: { to: 'bills-of-materials', secondary: [] },
    mps: { to: 'master-production-schedules', secondary: [] },
    mrp: { to: 'mrp', secondary: [] },
    orders: { to: 'production-orders', secondary: [] },
    cells: { to: 'work-centers', secondary: [] },
    cost: { to: 'cost-centres', secondary: [] },
  },
  distribution: {
    incoterms: { to: 'incoterms', secondary: [] },
    carriers: { to: 'carriers', secondary: [] },
    fleet: { to: 'fleet-drivers', secondary: [] },
    inbound: { to: 'inbound', secondary: [] },
    outbound: { to: 'outbound', secondary: [] },
    tracking: { to: 'tracking', secondary: [] },
    pod: { to: null, secondary: [] },
  },
  inventory: {
    products: { to: 'products', secondary: [] },
    sites: { to: 'warehouses', secondary: [] },
    scan: { to: 'scan', secondary: ['/dashboard/suppliers/po'] },
    stock: { to: 'stock', secondary: ['lots'] },
    transfer: { to: 'stock-transfers', secondary: [] },
    count: { to: 'counts', secondary: [] },
    report: { to: 'report', secondary: [] },
    storefront: { to: 'storefront', secondary: [] },
  },
  quality: {
    inspect: { to: 'inspections', secondary: [] },
    haccp: { to: 'haccp', secondary: [] },
    trace: { to: 'traceability', secondary: ['traceability-graph'] },
    drill: { to: 'recall-simulator', secondary: [] },
    pack: { to: 'regulatory-reports', secondary: [] },
  },
  sheq: {
    incident: { to: 'incidents', secondary: [] },
    hazard: { to: 'hazards', secondary: [] },
    ncr: { to: 'ncrs', secondary: ['/dashboard/quality/inspections'] },
    capa: { to: 'capas', secondary: [] },
  },
};

for (const [module, steps] of Object.entries(EXACT)) {
  const flow = CORE_FLOWS[module as keyof typeof CORE_FLOWS];
  assert.deepEqual(flow.steps.map((step) => step.id), Object.keys(steps), module);
  for (const [id, spec] of Object.entries(steps)) {
    const step = flow.steps.find((item) => item.id === id);
    assert.equal(step?.to?.path ?? null, spec.to, `${module} ${id}`);
    assert.deepEqual((step?.secondary || []).map((target) => target.path), spec.secondary, `${module} ${id}`);
  }
}

for (const file of NAMED_STUBS) assert.equal(existsSync(file), true, file);

for (const flow of Object.values(CORE_FLOWS)) {
  const groups = new Map<string, string[]>();
  for (const step of flow.steps) {
    const targets = [step.to, ...(step.secondary || [])].filter((target): target is FlowTarget => target != null);
    for (const target of targets) {
      const page = pageFor(flow, target);
      assert.equal(existsSync(page), true, `${flow.module} ${step.id} ${page}`);
      assert.equal(NAMED_STUBS.includes(page), false, page);
      assert.equal(isRedirectStub(page), false, page);
      assert.match(page, /^app\/(dashboard|sales)\//, page);
    }
    if (!step.to) continue;
    const primary = pageFor(flow, step.to);
    const list = groups.get(primary) || [];
    list.push(step.id);
    groups.set(primary, list);
  }
  const allowed = (SAME_PAGE[flow.module] || []).map((ids) => [...ids].sort().join(','));
  for (const [page, ids] of groups) {
    if (ids.length < 2) continue;
    assert.equal(allowed.includes([...ids].sort().join(',')), true, `${flow.module} ${page} ${ids.join(',')}`);
  }
}

console.log('brief121-core-routes.test.ts ok');
