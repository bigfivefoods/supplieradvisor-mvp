/**
 * Run: npx --yes tsx lib/advisors/process-flows/brief120-flow-data.test.ts
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ADVISOR_FLOWS } from './index';
import type { AdvisorFlowDef } from './types';

function read(file: string): string {
  return readFileSync(file, 'utf8');
}

function unionMembers(file: string, typeName: string): string[] {
  const src = read(file);
  const matched = src.match(new RegExp(`export type ${typeName}\\s*=\\s*([^;]+);`));
  assert.ok(matched, `${typeName} in ${file}`);
  return matched[1]
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('|')
    .map((part) => part.trim().replace(/'/g, ''))
    .filter((part) => /^[a-z0-9_]+$/.test(part));
}

function booleanFields(file: string, typeName: string): string[] {
  const src = read(file);
  const start = src.indexOf(`export type ${typeName}`);
  assert.ok(start >= 0, typeName);
  const brace = src.indexOf('{', start);
  const end = src.indexOf('};', brace);
  const body = src.slice(brace + 1, end);
  const keys: string[] = [];
  for (const line of body.split('\n')) {
    const field = line.match(/^\s*([A-Za-z0-9_]+)\??:\s*boolean\b/);
    if (field) keys.push(field[1]);
  }
  return keys;
}

function teamRoleIds(): string[] {
  const hook = read('lib/business/useCompanyRole.ts');
  assert.match(hook, /normalizeTeamRole/);
  assert.match(hook, /TeamRole/);
  return unionMembers('lib/business/permissions.ts', 'TeamRole');
}

function roleIdsFor(module: string): string[] {
  if (module === 'constructiongraph') return unionMembers('lib/construction/roles.ts', 'ConstructionRole');
  if (module === 'fleetgraph') return unionMembers('lib/fleet/types.ts', 'FleetRole');
  if (module === 'tradegraph' || module === 'apparelgraph' || module === 'containers') return teamRoleIds();
  if (module === 'health') return ['department', 'facility', 'sp'];
  throw new Error(`No role source for ${module}`);
}

function capKeysFor(module: string): string[] | null {
  if (module === 'constructiongraph') return booleanFields('lib/construction/roles.ts', 'ConstructionCapabilities');
  if (module === 'fleetgraph') return booleanFields('lib/fleet/roles.ts', 'FleetCapabilities');
  if (module === 'tradegraph' || module === 'apparelgraph' || module === 'containers' || module === 'health') return [];
  return null;
}

function walkLib(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walkLib(full, acc);
    else if (name.endsWith('.ts') && !name.includes('.test.')) acc.push(full);
  }
  return acc;
}

const flows = Object.values(ADVISOR_FLOWS).filter((flow): flow is AdvisorFlowDef => Boolean(flow));
assert.ok(flows.length > 0);

const doc = read('docs/advisor-process-flows.md');
for (const flow of flows) {
  assert.equal(doc.includes(flow.module), true, `doc lists ${flow.module}`);
  assert.equal(flow.anchorId.includes('®'), false);
  assert.equal(flow.module.includes('®'), false);
  assert.equal(flow.product.includes('®'), true, flow.module);
  assert.equal(flow.title.includes('®'), true, flow.module);
  assert.equal(flow.hrefRoot.startsWith('/dashboard/'), true, flow.hrefRoot);
  assert.ok(flow.guardrails.length >= 3 && flow.guardrails.length <= 5, flow.module);
  const roles = roleIdsFor(flow.module);
  for (const role of flow.roles) {
    assert.equal(roles.includes(role.id), true, `${flow.module} role ${role.id}`);
    assert.equal(role.id.includes('®'), false);
  }
  const caps = capKeysFor(flow.module);
  assert.ok(caps, flow.module);
  const phaseIds = new Set(flow.phases.map((phase) => phase.id));
  const counts = new Map<string, number>();
  flow.steps.forEach((step, index) => {
    assert.equal(step.n, index + 1, `${flow.module} ${step.id}`);
    assert.equal(phaseIds.has(step.phase), true, step.id);
    counts.set(step.phase, (counts.get(step.phase) || 0) + 1);
    assert.equal(step.id, step.id.toLowerCase(), step.id);
    assert.match(step.id, /^[a-z0-9_]+$/);
    assert.equal(step.id.includes('®'), false);
    assert.equal(step.sources.length >= 1, true, step.id);
    for (const source of step.sources) {
      assert.equal(existsSync(source), true, source);
      assert.equal(source.includes('®'), false, source);
    }
    if (step.status === 'soon') {
      assert.equal(step.to, null, step.id);
      assert.equal(typeof step.note, 'string', step.id);
      assert.ok(step.note && step.note.length > 0, step.id);
    }
    if (step.status === 'partial') assert.ok(step.note && step.note.length > 0, step.id);
    if (step.status === 'live') assert.ok(step.to, step.id);
    const targets = [step.to, ...(step.secondary || [])].filter((target) => target != null);
    for (const target of targets) {
      assert.equal(target.path.includes('®'), false, target.path);
      if (target.needs) assert.equal(caps.includes(target.needs), true, `${flow.module} ${target.needs}`);
    }
  });
  for (const [phase, count] of counts) {
    assert.ok(count <= 4, `${flow.module} ${phase} has ${count}`);
  }
  for (const phase of flow.phases) {
    assert.ok(flow.steps.some((step) => step.phase === phase.id), phase.id);
  }
  const ids = flow.steps.map((step) => step.id);
  assert.equal(new Set(ids).size, ids.length, flow.module);
  for (const guard of flow.guardrails) {
    assert.ok(guard.source.length > 0);
    assert.equal(existsSync(guard.source), true, guard.source);
  }
  for (const path of flow.previewPaths) assert.equal(path.includes('®'), false, path);
  for (const link of flow.around?.links || []) {
    assert.equal(link.path.includes('®'), false);
    if (link.needs) assert.equal(caps.includes(link.needs), true, link.needs);
  }
}

for (const file of walkLib('lib/advisors/process-flows')) {
  const text = read(file);
  assert.equal(text.includes("from 'react'"), false, file);
  assert.equal(text.includes('from "react"'), false, file);
  assert.equal(text.includes('next/headers'), false, file);
}

console.log('brief120-flow-data.test.ts ok');
