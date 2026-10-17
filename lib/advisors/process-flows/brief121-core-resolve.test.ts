/**
 * Run: npx --yes tsx lib/advisors/process-flows/brief121-core-resolve.test.ts
 * Omitting reachable must match the pre-change snapshot. A false reachable drops the link.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isFixtureReachable } from '../../preview/fixture-href';
import { ADVISOR_FLOWS } from './index';
import { HOME_FLOW } from './core/home';
import { coreFlowCaps } from './core-caps';
import { resolveAdvisorFlow } from './resolve';
import type { AdvisorFlowDef } from './types';

type Case = { id: string; input: { role?: string; caps?: Record<string, boolean>; hrefBase?: string } };

const viewerCaps = { canSeeMoney: false, canSeeCostsAndBoq: false, seesCosts: false, canImportCsv: false };

function casesFor(flow: AdvisorFlowDef): Case[] {
  const rows: Case[] = [
    { id: flow.module, input: {} },
    { id: flow.module, input: { role: 'owner' } },
    { id: flow.module, input: { role: 'viewer', caps: viewerCaps } },
  ];
  if (flow.previewRoot) rows.push({ id: flow.module, input: { hrefBase: flow.previewRoot, role: 'owner' } });
  return rows;
}

const flows = Object.values(ADVISOR_FLOWS).filter((flow): flow is AdvisorFlowDef => Boolean(flow));
const fresh = flows.flatMap((flow) =>
  casesFor(flow).map((row) => ({
    id: row.id,
    input: row.input,
    view: JSON.parse(JSON.stringify(resolveAdvisorFlow(flow, row.input))),
  }))
);
const saved = JSON.parse(readFileSync(new URL('./brief121-resolve-baseline.json', import.meta.url), 'utf8'));
assert.equal(fresh.length, 21);
assert.deepEqual(fresh, saved);

const blocked = resolveAdvisorFlow(HOME_FLOW, {
  role: 'owner',
  caps: coreFlowCaps('owner'),
  hrefBase: HOME_FLOW.hrefRoot,
  reachable: () => false,
});
for (const step of blocked.phases.flatMap((phase) => phase.steps)) {
  assert.equal(step.linkHref, null, step.id);
  assert.equal(step.chips.some((chip) => chip.label === 'Not available here'), true, step.id);
  for (const link of step.secondary) {
    assert.equal(link.href, null, link.label);
    assert.equal(link.note, 'Not available here', link.label);
  }
}

const open = resolveAdvisorFlow(HOME_FLOW, {
  role: 'owner',
  caps: coreFlowCaps('owner'),
  hrefBase: HOME_FLOW.hrefRoot,
});
assert.equal(open.phases.flatMap((phase) => phase.steps).some((step) => step.linkHref != null), true);
assert.equal(
  open.phases.flatMap((phase) => phase.steps).some((step) => step.chips.some((chip) => chip.id === 'here')),
  false
);

assert.equal(isFixtureReachable('/dashboard/suppliers/po'), true);
assert.equal(isFixtureReachable('/dashboard/accounting/payments'), false);
assert.equal(isFixtureReachable('/login'), false);
assert.equal(isFixtureReachable('https://example.com/outside'), false);

console.log('brief121-core-resolve.test.ts ok');
