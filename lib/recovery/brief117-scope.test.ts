/**
 * Run: npx --yes tsx lib/recovery/brief117-scope.test.ts
 * Data-scoping: agent staff filter, projected desk stats, company filter on head counts, navy header.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RecoverProcessFlow } from '@/components/recovery/RecoverProcessFlow';
import { accountKpiFigures } from './account-kpis';
import { projectBookStats } from './project';
import { capabilitiesFor } from './roles';
import { accountInAgentScope } from './scope';
import type { RecoverBookStats, RecoverDeskPayload, RecoverWorkspace } from './types';

const staff = { id: '11111111-1111-4111-8111-111111111111', teamId: '22222222-2222-4222-8222-222222222222' };
assert.equal(accountInAgentScope({ assigned_to: staff.id, team_id: null }, staff), true);
assert.equal(accountInAgentScope({ assigned_to: null, team_id: staff.teamId }, staff), true);
assert.equal(accountInAgentScope({ assigned_to: '33333333-3333-4333-8333-333333333333', team_id: null }, staff), false);
assert.equal(
  accountInAgentScope({ assigned_to: null, team_id: '44444444-4444-4444-8444-444444444444' }, staff),
  false
);
assert.equal(accountInAgentScope({ assigned_to: staff.id, team_id: staff.teamId }, null), false);
assert.equal(accountInAgentScope({ assigned_to: staff.id }, { id: staff.id, teamId: null }), true);

const bookDb = readFileSync(resolve('lib/recovery/book-db.ts'), 'utf8');
const counter = bookDb.slice(bookDb.indexOf('export async function countAccountsForAgent'), bookDb.indexOf('export async function countAssignedToStaff'));
assert.match(counter, /assigned_to/);
assert.match(counter, /team_id/);
assert.match(counter, /company_id/);
assert.equal(counter.includes(".eq('assigned_to', staffId)") && counter.includes('team_id.eq'), true);

function assertCompanyFilter(source: string, label: string) {
  const parts = source.split(".from('recover_accounts')").slice(1);
  assert.ok(parts.length > 0, label);
  for (const part of parts) {
    assert.match(part.slice(0, 500), /company_id/, label);
  }
}
assertCompanyFilter(counter, 'agent count');
const statsClient = bookDb.slice(bookDb.indexOf('function supabaseBookStatsClient'), bookDb.indexOf('export async function loadBookStats'));
assertCompanyFilter(statsClient, 'head counts');

const route = readFileSync(resolve('app/api/recovery/recovergraph/route.ts'), 'utf8');
assert.match(route, /countAccountsForAgent/);
assert.match(route, /projected\.book = projectBookStats\(role,/);
assert.equal(/projected\.book\s*=\s*await loadBookStats/.test(route), false);
assert.equal(route.includes('placedBalanceCents: 0'), false);

const raw: RecoverBookStats = {
  placedCount: 40,
  placedBalanceCents: 9880704,
  assignedCount: 9,
  unassignedCount: 4,
  imported: true,
  arrangementCount: 3,
  paidCount: 2,
  recalledCount: 1,
  closedCount: 1,
};
const agentBook = projectBookStats('agent', raw);
assert.equal(agentBook?.assignedCount, 9);
assert.equal(agentBook?.placedCount, 9);
assert.equal(agentBook?.placedBalanceCents, null);
assert.equal(agentBook?.arrangementCount, undefined);
const viewerBook = projectBookStats('viewer', raw);
assert.equal(viewerBook?.placedCount, 40);
assert.equal(viewerBook?.placedBalanceCents, 9880704);
assert.equal(viewerBook?.arrangementCount, undefined);
assert.equal(viewerBook?.assignedCount, 0);
const ownerBook = projectBookStats('owner', raw);
assert.equal(ownerBook?.placedBalanceCents, 9880704);
assert.equal(ownerBook?.arrangementCount, 3);

const figures = accountKpiFigures({
  role: 'agent',
  rows: [
    { state: 'active', balance_cents: 5000000, assignee: 'pieter' },
    { state: 'active', balance_cents: 4880704, assignee: 'pieter' },
  ],
  stats: {
    placedCount: 999,
    placedBalanceCents: 0,
    assignedCount: 999,
    unassignedCount: 0,
    imported: true,
  },
  placedCount: 999,
  serverQuery: true,
});
assert.equal(figures.placed, 2);
assert.equal(figures.balanceCents, 9880704);
assert.notEqual(figures.placed, 999);

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
const desk: RecoverDeskPayload = {
  ready: true,
  workspace,
  role: 'owner',
  capabilities: capabilitiesFor('owner'),
  counts: { creditors: 1, mandates: 1, staff: 1 },
  creditors: [],
  mandates: [],
  staff: [],
  self: null,
  book: ownerBook,
};
const markup = renderToStaticMarkup(createElement(RecoverProcessFlow, { desk }));
assert.match(markup, /background-color:#00b4d8;color:#0f172a/);
assert.doesNotMatch(markup, /color:#fff|color:#ffffff|color:white|text-white/i);
const flow = readFileSync(resolve('components/recovery/RecoverProcessFlow.tsx'), 'utf8');
assert.equal(/setOpen\(!collapsed\)/.test(flow), false);
assert.equal(/desk\.role, collapsed/.test(flow), false);
assert.equal(/open \? \{ 'aria-controls': 'recover-process-flow-body' \}/.test(flow), false);
assert.match(flow, /aria-controls="recover-process-flow-body"/);
assert.match(flow, /id="recover-process-flow-body"/);
assert.match(flow, /hidden=\{!open\}/);
assert.match(markup, /aria-expanded="false"/);
assert.match(markup, /id="recover-process-flow-body"/);
assert.match(flow, /allowInstalled=\{desk\.ready && desk\.reason !== 'migration_pending'\}/);

console.log('brief117-scope.test.ts ok');
