/**
 * Run: npx --yes tsx lib/advisors/process-flows/brief120-flow-resolve.test.ts
 */
import assert from 'node:assert/strict';
import { capabilitiesFor as constructionCaps } from '../../construction/roles';
import { capabilitiesFor as fleetCaps } from '../../fleet/roles';
import { APPARELGRAPH_FLOW } from './apparelgraph';
import { CONSTRUCTIONGRAPH_FLOW } from './constructiongraph';
import { FLEETGRAPH_FLOW } from './fleetgraph';
import { TRADEGRAPH_FLOW } from './tradegraph';
import { flowDefaultOpen, flowSrSummary, flowStatusCounts, resolveAdvisorFlow } from './resolve';

assert.equal(flowDefaultOpen(CONSTRUCTIONGRAPH_FLOW, 'owner'), true);
assert.equal(flowDefaultOpen(CONSTRUCTIONGRAPH_FLOW, 'site_manager'), true);
assert.equal(flowDefaultOpen(CONSTRUCTIONGRAPH_FLOW, 'office'), false);
assert.equal(flowDefaultOpen(CONSTRUCTIONGRAPH_FLOW, 'viewer'), false);
assert.equal(flowDefaultOpen(CONSTRUCTIONGRAPH_FLOW, undefined), true);
assert.equal(flowDefaultOpen(CONSTRUCTIONGRAPH_FLOW, 'missing'), false);
assert.equal(flowDefaultOpen(TRADEGRAPH_FLOW, 'owner'), true);
assert.equal(flowDefaultOpen(TRADEGRAPH_FLOW, 'admin'), true);
assert.equal(flowDefaultOpen(TRADEGRAPH_FLOW, 'operations'), false);
assert.equal(flowDefaultOpen(TRADEGRAPH_FLOW, 'member'), false);
assert.equal(flowDefaultOpen(TRADEGRAPH_FLOW, undefined), true);
for (const role of TRADEGRAPH_FLOW.roles) {
  const open = role.id === 'owner' || role.id === 'admin';
  assert.equal(role.openByDefault, open, role.id);
  assert.equal(flowDefaultOpen(TRADEGRAPH_FLOW, role.id), open, role.id);
}

const owner = resolveAdvisorFlow(CONSTRUCTIONGRAPH_FLOW, {
  role: 'owner',
  caps: constructionCaps('owner'),
  hrefBase: '/dashboard/constructiongraph',
});
assert.equal(owner.open, true);
assert.equal(owner.roleLabel, 'You are the owner');
const programme = owner.phases.flatMap((phase) => phase.steps).find((step) => step.id === 'programme');
assert.ok(programme);
assert.equal(programme.ariaLabel, 'Step 4, Programme. Opens the programme.');
assert.equal(programme.linkHref, '/dashboard/constructiongraph/programme');
assert.equal(programme.mine, true);

const viewer = resolveAdvisorFlow(CONSTRUCTIONGRAPH_FLOW, {
  role: 'viewer',
  caps: constructionCaps('viewer'),
  hrefBase: '/dashboard/constructiongraph',
});
assert.equal(viewer.open, false);
const quotes = viewer.phases.flatMap((phase) => phase.steps).find((step) => step.id === 'quotes');
assert.ok(quotes);
assert.equal(quotes.linkHref, null);
assert.equal(quotes.chips.some((chip) => chip.label === 'Not available to your role'), true);
assert.equal(quotes.ariaLabel.includes('Not available to your role'), true);
const claims = viewer.phases.flatMap((phase) => phase.steps).find((step) => step.id === 'claims');
assert.ok(claims);
const costs = claims.secondary.find((link) => link.label === 'Costs');
assert.ok(costs);
assert.equal(costs.href, null);
assert.equal(costs.note, 'Not available to your role');

const preview = resolveAdvisorFlow(CONSTRUCTIONGRAPH_FLOW, {
  role: 'site_manager',
  caps: constructionCaps('site_manager'),
  hrefBase: '/preview/constructiongraph',
});
assert.equal(preview.open, true);
const clients = preview.phases.flatMap((phase) => phase.steps).find((step) => step.id === 'clients');
assert.equal(clients?.linkHref, '/preview/constructiongraph/clients?role=site_manager');
const work = preview.around?.links.find((link) => link.label === 'Work app');
assert.equal(work?.href, '/preview/constructiongraph/work?role=site_manager');
assert.equal(preview.phases.flatMap((phase) => phase.steps).every((step) => step.linkHref == null || step.linkHref.startsWith('/preview/')), true);

const tradePreview = resolveAdvisorFlow(TRADEGRAPH_FLOW, { hrefBase: '/preview/tradegraph' });
assert.equal(tradePreview.open, true);
const job = tradePreview.phases.flatMap((phase) => phase.steps).find((step) => step.id === 'job');
assert.equal(job?.linkHref, '/preview/tradegraph/board?new=1');
const tradeWork = tradePreview.around?.links.find((link) => link.label === 'Work app');
assert.equal(tradeWork?.href, '/preview/tradegraph/work?role=owner');
assert.equal(tradePreview.phases.flatMap((phase) => phase.steps).some((step) => step.state === 'soon'), false);

const blockedPreview = resolveAdvisorFlow(CONSTRUCTIONGRAPH_FLOW, {
  role: 'owner',
  caps: constructionCaps('owner'),
  hrefBase: '/preview/constructiongraph',
});
const madeUp = resolveAdvisorFlow(
  {
    ...CONSTRUCTIONGRAPH_FLOW,
    steps: [
      {
        ...CONSTRUCTIONGRAPH_FLOW.steps[0],
        id: 'missing_preview',
        to: { label: 'Missing', scope: 'module', path: 'not-a-preview' },
        secondary: [{ label: 'Inventory', scope: 'app', path: '/dashboard/inventory/lots' }],
      },
    ],
  },
  { role: 'owner', caps: constructionCaps('owner'), hrefBase: '/preview/constructiongraph' }
);
assert.equal(madeUp.phases[0]?.steps[0]?.linkHref, null);
assert.equal(madeUp.phases[0]?.steps[0]?.chips.some((chip) => chip.label === 'Open in the signed-in app'), true);
assert.equal(madeUp.phases[0]?.steps[0]?.secondary[0]?.href, null);
assert.equal(blockedPreview.module, 'constructiongraph');

const soon = resolveAdvisorFlow(
  {
    ...TRADEGRAPH_FLOW,
    steps: [
      {
        ...TRADEGRAPH_FLOW.steps[0],
        status: 'soon',
        to: null,
        note: 'Launching soon.',
        secondary: [],
      },
    ],
    phases: [TRADEGRAPH_FLOW.phases[0]],
  },
  { hrefBase: '/dashboard/tradegraph' }
);
assert.equal(soon.phases[0]?.steps[0]?.linkHref, null);
assert.equal(soon.phases[0]?.steps[0]?.ariaLabel.includes('Launching soon'), true);

const counted = flowStatusCounts(CONSTRUCTIONGRAPH_FLOW);
assert.equal(counted.total, CONSTRUCTIONGRAPH_FLOW.steps.length);
assert.equal(counted.live + counted.partial + counted.soon, counted.total);
assert.equal(flowSrSummary(CONSTRUCTIONGRAPH_FLOW).includes(`${counted.live} are live`), true);
assert.equal(flowSrSummary(CONSTRUCTIONGRAPH_FLOW).includes(`${counted.partial} are partly live`), true);
assert.equal(flowSrSummary(CONSTRUCTIONGRAPH_FLOW).includes(`${counted.soon} are launching soon`), true);
assert.equal(owner.srSummary, flowSrSummary(CONSTRUCTIONGRAPH_FLOW));
assert.equal(owner.counts.live, counted.live);

const withChip = resolveAdvisorFlow(TRADEGRAPH_FLOW, {
  hrefBase: '/dashboard/tradegraph',
  chips: { customers: [{ id: 'later', label: 'Exact count later', tone: 'slate' }] },
});
const customers = withChip.phases.flatMap((phase) => phase.steps).find((step) => step.id === 'customers');
assert.equal(customers?.chips.some((chip) => chip.label === 'Exact count later'), true);

const audience = resolveAdvisorFlow(
  {
    ...TRADEGRAPH_FLOW,
    steps: [{ ...TRADEGRAPH_FLOW.steps[0], audiences: ['facility'], roles: [] }],
  },
  { hrefBase: '/dashboard/tradegraph', audience: 'facility' }
);
assert.equal(audience.phases[0]?.steps[0]?.mine, true);
const other = resolveAdvisorFlow(
  {
    ...TRADEGRAPH_FLOW,
    steps: [{ ...TRADEGRAPH_FLOW.steps[0], audiences: ['facility'], roles: [] }],
  },
  { hrefBase: '/dashboard/tradegraph', audience: 'department' }
);
assert.equal(other.phases[0]?.steps[0]?.mine, false);

const roles = ['owner', 'site_manager', 'office', 'viewer', 'none'] as const;
for (const role of roles) {
  const caps = constructionCaps(role);
  const view = resolveAdvisorFlow(CONSTRUCTIONGRAPH_FLOW, {
    role,
    caps,
    hrefBase: '/dashboard/constructiongraph',
  });
  const steps = view.phases.flatMap((phase) => phase.steps);
  const quoteStep = steps.find((step) => step.id === 'quotes');
  const claimStep = steps.find((step) => step.id === 'claims');
  const reportStep = steps.find((step) => step.id === 'reports');
  assert.ok(quoteStep && claimStep && reportStep);
  const certificate = claimStep.secondary.find((link) => link.label === 'Certificates');
  const cost = claimStep.secondary.find((link) => link.label === 'Costs');
  const portalLink = reportStep.secondary.find((link) => link.label === 'Portal');
  assert.ok(certificate && cost && portalLink);
  const gated: Array<[string, boolean, string | null]> = [
    ['quotes', caps.canSeeCostsAndBoq, quoteStep.linkHref],
    ['payments', caps.canCertify, claimStep.linkHref],
    ['certificates', caps.canCertify, certificate.href],
    ['costs', caps.canSeeCostsAndBoq, cost.href],
    ['portal', caps.canManagePortals, portalLink.href],
  ];
  for (const [name, allowed, href] of gated) {
    if (allowed) assert.equal(typeof href, 'string', `${role} ${name}`);
    else assert.equal(href, null, `${role} ${name}`);
  }
}

assert.equal(flowDefaultOpen(FLEETGRAPH_FLOW, 'owner'), true);
assert.equal(flowDefaultOpen(FLEETGRAPH_FLOW, 'manager'), true);
assert.equal(flowDefaultOpen(FLEETGRAPH_FLOW, 'dispatcher'), false);
assert.equal(flowDefaultOpen(FLEETGRAPH_FLOW, 'office'), false);
assert.equal(flowDefaultOpen(FLEETGRAPH_FLOW, 'viewer'), false);
assert.equal(flowDefaultOpen(FLEETGRAPH_FLOW, 'none'), false);
assert.equal(flowDefaultOpen(FLEETGRAPH_FLOW, undefined), true);
for (const role of FLEETGRAPH_FLOW.roles) {
  const open = role.id === 'owner' || role.id === 'manager';
  assert.equal(role.openByDefault, open, role.id);
  assert.equal(flowDefaultOpen(FLEETGRAPH_FLOW, role.id), open, role.id);
}
for (const role of APPARELGRAPH_FLOW.roles) {
  const open = role.id === 'owner' || role.id === 'admin';
  assert.equal(role.openByDefault, open, role.id);
  assert.equal(flowDefaultOpen(APPARELGRAPH_FLOW, role.id), open, role.id);
}
assert.equal(flowDefaultOpen(APPARELGRAPH_FLOW, undefined), true);
assert.equal(flowDefaultOpen(APPARELGRAPH_FLOW, 'member'), false);

const fleetRoles = ['owner', 'manager', 'dispatcher', 'office', 'viewer', 'none'] as const;
for (const role of fleetRoles) {
  const caps = fleetCaps(role);
  const view = resolveAdvisorFlow(FLEETGRAPH_FLOW, {
    role,
    caps,
    hrefBase: '/dashboard/fleetgraph',
  });
  const steps = view.phases.flatMap((phase) => phase.steps);
  const byId = (id: string) => {
    const step = steps.find((item) => item.id === id);
    assert.ok(step, `${role} ${id}`);
    return step;
  };
  const vehicles = byId('vehicles');
  const costs = byId('costs');
  const cpk = byId('cpk');
  const imported = vehicles.secondary.find((link) => link.label === 'Import');
  assert.ok(imported, role);
  assert.equal(byId('dispatch').linkHref, null, role);
  assert.equal(byId('invoicing').linkHref, null, role);
  assert.equal(byId('jobs').state, 'partial', role);
  assert.equal(byId('map').state, 'partial', role);
  assert.equal(typeof byId('map').linkHref, 'string', role);
  const gated: Array<[string, boolean, string | null]> = [
    ['costs', caps.seesCosts, costs.linkHref],
    ['cpk', caps.seesCosts, cpk.linkHref],
    ['import', caps.canImportCsv, imported.href],
  ];
  for (const [name, allowed, href] of gated) {
    if (allowed) assert.equal(typeof href, 'string', `${role} ${name}`);
    else assert.equal(href, null, `${role} ${name}`);
  }
}

const pricesOn = fleetCaps('dispatcher', { dispatcherSeesRates: true });
assert.equal(pricesOn.seesRates, true);
assert.equal(pricesOn.seesCosts, false);
const priced = resolveAdvisorFlow(FLEETGRAPH_FLOW, {
  role: 'dispatcher',
  caps: pricesOn,
  hrefBase: '/dashboard/fleetgraph',
});
const pricedSteps = priced.phases.flatMap((phase) => phase.steps);
assert.equal(pricedSteps.find((step) => step.id === 'cpk')?.linkHref, null);
assert.equal(pricedSteps.find((step) => step.id === 'costs')?.linkHref, null);

const fleetPreview = resolveAdvisorFlow(FLEETGRAPH_FLOW, {
  role: 'owner',
  caps: fleetCaps('owner'),
  hrefBase: '/preview/fleetgraph',
});
assert.equal(
  fleetPreview.phases.flatMap((phase) => phase.steps).find((step) => step.id === 'vehicles')?.linkHref,
  '/preview/fleetgraph/vehicles?role=owner'
);
assert.equal(fleetPreview.phases.flatMap((phase) => phase.steps).find((step) => step.id === 'dispatch')?.linkHref, null);

const apparelMember = resolveAdvisorFlow(APPARELGRAPH_FLOW, {
  role: 'member',
  hrefBase: '/dashboard/apparelgraph',
});
assert.equal(apparelMember.open, false);
const quality = apparelMember.phases.flatMap((phase) => phase.steps).find((step) => step.id === 'quality');
assert.ok(quality);
assert.equal(quality.linkHref, '/dashboard/apparelgraph/quality');
assert.equal(quality.secondary.find((link) => link.label === 'Quality holds')?.href, '/dashboard/quality/inspections');
const ship = apparelMember.phases.flatMap((phase) => phase.steps).find((step) => step.id === 'ship');
assert.equal(ship?.secondary.find((link) => link.label === 'Inventory lots')?.href, '/dashboard/inventory/lots');
assert.equal(ship?.secondary.find((link) => link.label === 'Supplier purchase orders')?.href, '/dashboard/suppliers/po');
assert.equal(apparelMember.phases.flatMap((phase) => phase.steps).every((step) => step.mine === false), true);

const apparelPreview = resolveAdvisorFlow(APPARELGRAPH_FLOW, { hrefBase: '/preview/apparelgraph' });
assert.equal(apparelPreview.phases.flatMap((phase) => phase.steps).every((step) => step.linkHref == null), true);
assert.equal(
  apparelPreview.phases.flatMap((phase) => phase.steps).find((step) => step.id === 'range')?.chips.some((chip) => chip.label === 'Open in the signed-in app'),
  true
);

const fleetCounted = flowStatusCounts(FLEETGRAPH_FLOW);
assert.equal(fleetCounted.total, FLEETGRAPH_FLOW.steps.length);
assert.equal(fleetCounted.partial, 2);
assert.equal(fleetCounted.soon, 2);
assert.equal(flowSrSummary(FLEETGRAPH_FLOW), resolveAdvisorFlow(FLEETGRAPH_FLOW).srSummary);
const apparelCounted = flowStatusCounts(APPARELGRAPH_FLOW);
assert.equal(apparelCounted.soon, 0);
assert.equal(apparelCounted.partial, 5);
assert.equal(apparelCounted.live, 5);

console.log('brief120-flow-resolve.test.ts ok');
