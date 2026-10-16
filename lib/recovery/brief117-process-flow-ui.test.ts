/**
 * Run: npx --yes tsx lib/recovery/brief117-process-flow-ui.test.ts
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AccountsView } from '@/components/recovery/book-views';
import { RecoverProcessFlow } from '@/components/recovery/RecoverProcessFlow';
import { harbourMemory } from './preview-memory';
import { capabilitiesFor } from './roles';
import type { RecoverDeskPayload, RecoverRole, RecoverWorkspace } from './types';

const workspace: RecoverWorkspace = {
  id: 'ws',
  company_id: 1,
  display_name: 'Illustration company',
  operator_type: 'agency',
  programme_types: ['recovery'],
  trust_mode: 'trust',
  cfdc_registration_no: '',
  cfdc_expiry: null,
  vat_registered: false,
  vat_rate_bps: null,
  real_data_enabled: true,
  real_data_confirmed_by: null,
  real_data_confirmed_at: null,
};

function desk(role: RecoverRole, book: RecoverDeskPayload['book']): RecoverDeskPayload {
  const hidden = role === 'agent' || role === 'none';
  return {
    ready: true,
    workspace,
    role,
    capabilities: capabilitiesFor(role),
    counts: hidden ? { creditors: null, mandates: null, staff: null } : { creditors: 2, mandates: 3, staff: 5 },
    creditors: [],
    mandates: [],
    staff: [],
    self: null,
    book,
  };
}

const book = {
  placedCount: 7,
  placedBalanceCents: 0,
  assignedCount: 11,
  unassignedCount: 13,
  imported: true,
  arrangementCount: 17,
  paidCount: 19,
  recalledCount: 23,
  closedCount: 29,
};

function html(node: ReturnType<typeof createElement>) {
  const markup = renderToStaticMarkup(node);
  assert.equal(markup.includes('undefined'), false);
  assert.equal(markup.includes('NaN'), false);
  assert.equal(markup.includes('[object Object]'), false);
  assert.equal(markup.includes('href="#"'), false);
  assert.doesNotMatch(markup, /<aside/);
  assert.doesNotMatch(markup, /amber-|stone-|dark:/);
  assert.doesNotMatch(markup, /window\.(alert|confirm|prompt)/);
  return markup;
}

function step(markup: string, id: string) {
  const start = markup.indexOf(`data-testid="recover-flow-step-${id}"`);
  assert.ok(start >= 0, id);
  const rest = markup.slice(start + 1);
  const end = rest.indexOf('data-testid="recover-flow-step-');
  const runs = rest.indexOf('data-testid="recover-flow-runs"');
  const cut = end >= 0 ? end : runs;
  return rest.slice(0, cut);
}

const owner = html(createElement(RecoverProcessFlow, { desk: desk('owner', book) }));
assert.match(owner, /id="recover-process-flow"/);
assert.match(owner, /aria-expanded="true"/);
assert.match(owner, /sr-only/);
assert.match(owner, /This process has ten steps in four phases/);
const order = ['creditor', 'mandate', 'placement', 'trace', 'contact', 'arrangement', 'payment', 'escalate', 'remit', 'report'];
let cursor = 0;
for (const id of order) {
  const at = owner.indexOf(`data-testid="recover-flow-step-${id}"`, cursor);
  assert.ok(at > cursor, id);
  cursor = at;
}
assert.equal(owner.match(/<li\b/g)?.length, 10);
for (const id of ['contact', 'remit', 'report']) {
  const block = step(owner, id);
  assert.match(block, /Launching soon/);
  assert.match(block, /aria-disabled="true"/);
  assert.equal(block.includes('<a'), false, id);
}

const agent = html(createElement(RecoverProcessFlow, { desk: desk('agent', book), defaultCollapsed: false }));
assert.equal(agent.includes('/creditors'), false);
assert.match(agent, /assigned to you/);

const viewer = html(
  createElement(RecoverProcessFlow, {
    desk: desk('viewer', { placedCount: 7, placedBalanceCents: 0, assignedCount: 0, unassignedCount: 0, imported: true }),
    defaultCollapsed: false,
  })
);
assert.equal(viewer.includes('/imports'), false);

const filtered = html(
  createElement(AccountsView, {
    phase: 'ready',
    book: harbourMemory(),
    role: 'owner',
    caps: capabilitiesFor('owner'),
    initialState: 'arrangement',
  })
);
assert.match(filtered, /arrangement/);
assert.match(filtered, /selected/);

console.log('brief117-process-flow-ui.test.ts ok');
