/**
 * Run: npx --yes tsx lib/recovery/brief117-process-flow.test.ts
 */
import assert from 'node:assert/strict';
import { accountStateFromQuery } from './href';
import { recovergraphNavSteps } from './nav';
import { capabilitiesFor } from './roles';
import { sampleDesk } from './sample-desk';
import {
  FLOW_FOUNDATION,
  FLOW_GUARDRAILS,
  FLOW_OUTCOME,
  FLOW_PHASES,
  FLOW_RUNS,
  FLOW_STEPS,
  flowSrSummary,
  resolveProcessFlow,
  stepAriaLabel,
} from './process-flow';

assert.equal(FLOW_STEPS.length, 10);
assert.deepEqual(
  FLOW_STEPS.map((step) => step.n),
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
);
assert.equal(new Set(FLOW_STEPS.map((step) => step.id)).size, 10);

const phaseIds = new Set(FLOW_PHASES.map((phase) => phase.id));
for (const phase of FLOW_PHASES) {
  const steps = FLOW_STEPS.filter((step) => step.phase === phase.id);
  assert.ok(steps.length > 0, phase.id);
  assert.equal(steps.length, new Set(steps.map((step) => step.id)).size);
}
for (const step of FLOW_STEPS) assert.equal(phaseIds.has(step.phase), true);

const nav = new Set(recovergraphNavSteps().map((step) => step.href));
for (const step of FLOW_STEPS) {
  assert.equal(step.id.includes('®'), false, step.id);
  assert.equal(/[^a-z]/.test(step.id), false, step.id);
  if (step.status === 'soon') {
    assert.equal(step.href, null, step.id);
    assert.equal(typeof step.soonNote, 'string');
    assert.ok(step.soonNote && step.soonNote.length > 0);
  }
  if (!step.href) continue;
  assert.equal(step.href.includes('®'), false, step.href);
  assert.equal(step.href.startsWith('/dashboard/recovergraph'), true, step.href);
  const url = new URL(step.href, 'https://recover.invalid');
  assert.equal(nav.has(url.pathname), true, url.pathname);
  const state = url.searchParams.get('state');
  if (state) assert.equal(accountStateFromQuery(state), state);
  for (const extra of step.secondary || []) {
    assert.equal(extra.href.includes('®'), false);
    const extraUrl = new URL(extra.href, 'https://recover.invalid');
    assert.equal(nav.has(extraUrl.pathname), true, extra.href);
  }
}

const claims = ['compliant', 'certified', 'legally', 'lawful', 'approved by the regulator'];
const blobs = [
  ...FLOW_STEPS.flatMap((step) => [step.title, step.desc, step.soonNote || '', step.who]),
  ...FLOW_GUARDRAILS.flatMap((row) => [row.title, row.body]),
  FLOW_OUTCOME,
  FLOW_FOUNDATION.title,
  FLOW_FOUNDATION.desc,
  FLOW_RUNS.title,
  FLOW_RUNS.desc,
  flowSrSummary(),
];
for (const text of blobs) {
  const lower = text.toLowerCase();
  for (const claim of claims) assert.equal(lower.includes(claim), false, `${claim} in ${text}`);
  assert.equal(text.includes('NaN'), false, text);
  assert.equal(text.includes('undefined'), false, text);
}

assert.equal(
  stepAriaLabel(3, 'Import and placement of accounts', ['120 placed'], 'imports'),
  'Step 3, Import and placement of accounts, 120 placed. Opens imports.'
);
assert.match(FLOW_STEPS[4].title, /section 129 notice where the NCA applies/);
assert.equal(FLOW_STEPS[4].href, null);
const contactCopy = `${FLOW_STEPS[4].title} ${FLOW_STEPS[4].desc} ${FLOW_STEPS[4].soonNote || ''}`;
assert.doesNotMatch(contactCopy, /\b\d+\s*days?\b|registered mail|hand delivery|business day|delivery proof/i);
assert.equal(/can be stored/i.test(`${FLOW_STEPS[5].desc} ${FLOW_STEPS[6].desc}`), false);
assert.match(FLOW_STEPS[5].desc, /not open yet/);
assert.match(FLOW_STEPS[6].desc, /not recorded yet/);

const sample = sampleDesk('owner');
const illustrated = resolveProcessFlow({
  role: 'owner',
  capabilities: sample.capabilities,
  counts: sample.counts,
  mandates: sample.mandates,
  book: sample.book,
  ready: true,
  sample: true,
  preview: 'illustration',
});
const mandateChips = illustrated.nodes.find((node) => node.id === 'mandate')?.chips.map((chip) => chip.text).join(' ') || '';
assert.match(mandateChips, /2 mandates/);
assert.equal(mandateChips.includes('NCA-regulated'), false);
const placementChips = illustrated.nodes.find((node) => node.id === 'placement')?.chips.map((chip) => chip.text) || [];
assert.equal(placementChips.includes('—'), false);
assert.equal(placementChips.includes('Counts unavailable'), false);
assert.equal(placementChips.some((text) => text.includes('Nothing placed')), false);

const failed = resolveProcessFlow({
  role: 'owner',
  capabilities: capabilitiesFor('owner'),
  counts: { creditors: 2, mandates: 1, staff: 1 },
  mandates: [],
  book: null,
  ready: true,
  sample: false,
  preview: 'live',
});
assert.equal(failed.nodes.find((node) => node.id === 'placement')?.chips[0]?.text, 'Counts unavailable');
assert.equal(
  failed.nodes.some((node) => node.chips.some((chip) => chip.text === 'Nothing placed yet')),
  false
);

console.log('brief117-process-flow.test.ts ok');
