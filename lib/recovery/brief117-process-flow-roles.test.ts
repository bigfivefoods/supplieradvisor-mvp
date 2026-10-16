/**
 * Run: npx --yes tsx lib/recovery/brief117-process-flow-roles.test.ts
 */
import assert from 'node:assert/strict';
import { resolveProcessFlow, type FlowChip, type FlowNodeView } from './process-flow';
import { capabilitiesFor } from './roles';
import type { RecoverBookStats, RecoverMandate, RecoverRole } from './types';

const PRIMES = {
  creditors: 2,
  mandates: 3,
  staff: 5,
  placed: 7,
  assigned: 11,
  unassigned: 13,
  arrangement: 17,
  paid: 19,
  recalled: 23,
  closed: 29,
  balance: 31,
};

const book: RecoverBookStats = {
  placedCount: PRIMES.placed,
  placedBalanceCents: PRIMES.balance,
  assignedCount: PRIMES.assigned,
  unassignedCount: PRIMES.unassigned,
  imported: true,
  arrangementCount: PRIMES.arrangement,
  paidCount: PRIMES.paid,
  recalledCount: PRIMES.recalled,
  closedCount: PRIMES.closed,
};

const mandates: RecoverMandate[] = [
  {
    id: 'm1',
    creditor_id: 'c1',
    creditor_name: 'One',
    programme_type: 'recovery',
    product_type: 'nca_credit',
    nca_regulated: true,
    processing_role: 'operator',
    status: 'active',
  },
  {
    id: 'm2',
    creditor_id: 'c2',
    creditor_name: 'Two',
    programme_type: 'recovery',
    product_type: 'trade',
    nca_regulated: false,
    processing_role: 'operator',
    status: 'active',
  },
  {
    id: 'm3',
    creditor_id: 'c3',
    creditor_name: 'Three',
    programme_type: 'recovery',
    product_type: 'levy',
    nca_regulated: true,
    processing_role: 'operator',
    status: 'draft',
  },
];

function flow(role: RecoverRole, ready = true) {
  return resolveProcessFlow({
    role,
    capabilities: capabilitiesFor(role),
    counts:
      role === 'agent' || role === 'none'
        ? { creditors: null, mandates: null, staff: null }
        : { creditors: PRIMES.creditors, mandates: PRIMES.mandates, staff: PRIMES.staff },
    mandates: role === 'agent' || role === 'none' ? [] : mandates,
    book: role === 'none' ? null : book,
    ready,
    sample: false,
    preview: 'live',
  });
}

function digits(text: string): number[] {
  return [...text.matchAll(/\d[\d\u00a0\u202f\s]*/g)].map((match) =>
    Number(match[0].replace(/[\u00a0\u202f\s]/g, ''))
  );
}

function chipNumbers(chips: FlowChip[]): number[] {
  return chips.filter((chip) => chip.tone === 'count').flatMap((chip) => digits(chip.text));
}

function allHrefs(nodes: FlowNodeView[], extras: FlowNodeView[]): string[] {
  return [...nodes, ...extras].flatMap((node) => [
    ...(node.linkHref ? [node.linkHref] : []),
    ...node.secondary.map((item) => item.href),
  ]);
}

const allowed = new Set<number>([
  PRIMES.creditors,
  PRIMES.mandates,
  PRIMES.staff,
  PRIMES.placed,
  PRIMES.assigned,
  PRIMES.unassigned,
  PRIMES.arrangement,
  PRIMES.paid,
  PRIMES.recalled,
  PRIMES.closed,
  1,
  0,
]);

function assertNumbersFromPayload(role: RecoverRole) {
  const view = flow(role);
  const chips = [...view.nodes, view.foundation, view.runs].flatMap((node) => node.chips);
  for (const n of chipNumbers(chips)) {
    assert.equal(allowed.has(n), true, `${role} chip ${n}`);
    assert.equal(n === PRIMES.balance, false, `${role} showed a balance`);
  }
  return view;
}

const owner = assertNumbersFromPayload('owner');
assert.equal(owner.defaultCollapsed, false);
assert.equal(owner.nodes.find((node) => node.id === 'creditor')?.linkHref, '/dashboard/recovergraph/creditors');
assert.equal(owner.nodes.find((node) => node.id === 'placement')?.linkHref, '/dashboard/recovergraph/imports');
assert.match(owner.nodes.find((node) => node.id === 'arrangement')?.linkHref || '', /state=arrangement/);
assert.equal(owner.nodes.find((node) => node.id === 'contact')?.linkHref, null);
assert.equal(owner.nodes.find((node) => node.id === 'remit')?.linkHref, null);
assert.equal(owner.nodes.find((node) => node.id === 'report')?.linkHref, null);
assert.equal(owner.foundation.linkHref, '/dashboard/recovergraph/settings/team');
assert.ok(chipNumbers(owner.nodes.find((node) => node.id === 'creditor')?.chips || []).includes(PRIMES.creditors));
assert.ok(chipNumbers(owner.nodes.find((node) => node.id === 'placement')?.chips || []).includes(PRIMES.placed));
assert.ok(chipNumbers(owner.foundation.chips).includes(PRIMES.staff));
assert.equal(owner.nodes.filter((node) => node.mine).some((node) => node.id === 'creditor'), true);

const manager = assertNumbersFromPayload('manager');
assert.equal(manager.defaultCollapsed, false);
assert.equal(manager.nodes.find((node) => node.id === 'escalate')?.mine, true);

const agent = assertNumbersFromPayload('agent');
assert.equal(agent.defaultCollapsed, true);
const agentHrefs = allHrefs(agent.nodes, [agent.foundation, agent.runs]).join(' ');
for (const banned of ['/creditors', '/mandates', '/imports', '/settings']) {
  assert.equal(agentHrefs.includes(banned), false, banned);
}
assert.match(agent.nodes.find((node) => node.id === 'trace')?.linkHref || '', /\/accounts$/);
assert.match(agent.nodes.find((node) => node.id === 'arrangement')?.linkHref || '', /state=arrangement/);
const agentNumbers = chipNumbers([...agent.nodes, agent.foundation].flatMap((node) => node.chips));
assert.deepEqual(agentNumbers, [PRIMES.assigned]);
assert.equal(agent.nodes.find((node) => node.id === 'creditor')?.chips.some((chip) => chip.tone === 'count'), false);
assert.match(agent.nodes.find((node) => node.id === 'placement')?.chips.map((chip) => chip.text).join(' ') || '', /assigned to you/);

const finance = assertNumbersFromPayload('finance');
assert.equal(finance.defaultCollapsed, true);
assert.equal(finance.nodes.find((node) => node.id === 'placement')?.linkHref, null);
assert.equal(finance.foundation.linkHref, null);
assert.equal(finance.nodes.find((node) => node.id === 'remit')?.mine, true);
assert.ok(finance.nodes.find((node) => node.id === 'creditor')?.linkHref);
assert.equal(chipNumbers(finance.nodes.flatMap((node) => node.chips)).includes(PRIMES.balance), false);

const compliance = assertNumbersFromPayload('compliance');
assert.equal(compliance.nodes.find((node) => node.id === 'report')?.mine, true);
assert.equal(compliance.nodes.find((node) => node.id === 'remit')?.mine, false);
assert.equal(compliance.foundation.linkHref, null);

const viewer = assertNumbersFromPayload('viewer');
const viewerNumbers = chipNumbers(viewer.nodes.flatMap((node) => node.chips));
for (const hidden of [PRIMES.assigned, PRIMES.unassigned, PRIMES.arrangement, PRIMES.paid, PRIMES.recalled, PRIMES.closed]) {
  assert.equal(viewerNumbers.includes(hidden), false, `viewer ${hidden}`);
}
assert.ok(viewerNumbers.includes(PRIMES.placed));
assert.equal(viewer.nodes.find((node) => node.id === 'placement')?.linkHref, null);
assert.ok(viewer.nodes.find((node) => node.id === 'creditor')?.linkHref);
assert.match(viewer.nodes.find((node) => node.id === 'payment')?.linkHref || '', /state=paid/);
assert.equal(viewer.nodes.some((node) => node.secondary.some((item) => item.href.includes('/queue'))), false);

const none = flow('none');
assert.equal(allHrefs(none.nodes, [none.foundation, none.runs]).length, 0);
assert.equal(chipNumbers([...none.nodes, none.foundation].flatMap((node) => node.chips)).length, 0);

const pending = flow('owner', false);
assert.equal(allHrefs(pending.nodes, [pending.foundation, pending.runs]).length, 0);
assert.equal(chipNumbers(pending.nodes.flatMap((node) => node.chips)).length, 0);
assert.ok(pending.nodes.find((node) => node.id === 'contact')?.chips.some((chip) => chip.text === 'Launching soon'));

console.log('brief117-process-flow-roles.test.ts ok');
