/**
 * Run: npx --yes tsx lib/advisors/process-flows/brief121-closed-by-default.test.ts
 * Every process flow starts closed. The toggle names a panel that stays in the page.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createElement, type ComponentType, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import FieldgraphSystemFlow from '../../../components/agri/FieldgraphSystemFlow';
import { AdvisorProcessFlow } from '../../../components/advisors/AdvisorProcessFlow';
import MedicalgraphSystemFlow from '../../../components/clinic/MedicalgraphSystemFlow';
import PhysiographSystemFlow from '../../../components/clinic/PhysiographSystemFlow';
import PsychiatrygraphSystemFlow from '../../../components/clinic/PsychiatrygraphSystemFlow';
import VetgraphSystemFlow from '../../../components/clinic/VetgraphSystemFlow';
import DentalgraphSystemFlow from '../../../components/dental/DentalgraphSystemFlow';
import FitgraphSystemFlow from '../../../components/fitness/FitgraphSystemFlow';
import HiregraphSystemFlow from '../../../components/hire/HiregraphSystemFlow';
import QuarrygraphSystemFlow from '../../../components/quarry/QuarrygraphSystemFlow';
import { RecoverProcessFlow } from '../../../components/recovery/RecoverProcessFlow';
import RetailgraphSystemFlow from '../../../components/retail/RetailgraphSystemFlow';
import NsnpSystemFlow from '../../../components/schools/NsnpSystemFlow';
import { capabilitiesFor } from '../../recovery/roles';
import { resolveProcessFlow } from '../../recovery/process-flow';
import type { RecoverDeskPayload, RecoverRole, RecoverWorkspace } from '../../recovery/types';
import { ADVISOR_FLOWS } from './index';
import { resolveAdvisorFlow } from './resolve';
import type { AdvisorFlowDef } from './types';

const BESPOKE: ReadonlyArray<{ name: string; file: string; Component: ComponentType<Record<string, unknown>> }> = [
  { name: 'FitgraphSystemFlow', file: 'components/fitness/FitgraphSystemFlow.tsx', Component: FitgraphSystemFlow as ComponentType<Record<string, unknown>> },
  { name: 'PhysiographSystemFlow', file: 'components/clinic/PhysiographSystemFlow.tsx', Component: PhysiographSystemFlow as ComponentType<Record<string, unknown>> },
  { name: 'PsychiatrygraphSystemFlow', file: 'components/clinic/PsychiatrygraphSystemFlow.tsx', Component: PsychiatrygraphSystemFlow as ComponentType<Record<string, unknown>> },
  { name: 'MedicalgraphSystemFlow', file: 'components/clinic/MedicalgraphSystemFlow.tsx', Component: MedicalgraphSystemFlow as ComponentType<Record<string, unknown>> },
  { name: 'VetgraphSystemFlow', file: 'components/clinic/VetgraphSystemFlow.tsx', Component: VetgraphSystemFlow as ComponentType<Record<string, unknown>> },
  { name: 'DentalgraphSystemFlow', file: 'components/dental/DentalgraphSystemFlow.tsx', Component: DentalgraphSystemFlow as ComponentType<Record<string, unknown>> },
  { name: 'HiregraphSystemFlow', file: 'components/hire/HiregraphSystemFlow.tsx', Component: HiregraphSystemFlow as ComponentType<Record<string, unknown>> },
  { name: 'RetailgraphSystemFlow', file: 'components/retail/RetailgraphSystemFlow.tsx', Component: RetailgraphSystemFlow as ComponentType<Record<string, unknown>> },
  { name: 'QuarrygraphSystemFlow', file: 'components/quarry/QuarrygraphSystemFlow.tsx', Component: QuarrygraphSystemFlow as ComponentType<Record<string, unknown>> },
  { name: 'FieldgraphSystemFlow', file: 'components/agri/FieldgraphSystemFlow.tsx', Component: FieldgraphSystemFlow as ComponentType<Record<string, unknown>> },
  { name: 'NsnpSystemFlow', file: 'components/schools/NsnpSystemFlow.tsx', Component: NsnpSystemFlow as ComponentType<Record<string, unknown>> },
];

const RENDER_NAMES = [...BESPOKE.map((item) => item.name), 'AdvisorProcessFlow', 'RecoverProcessFlow'];

function html(node: ReactElement): string {
  return renderToStaticMarkup(node);
}

function panelIdFrom(markup: string): string {
  const controls = [...markup.matchAll(/aria-controls="([^"]+)"/g)].map((match) => match[1]);
  assert.ok(controls.length > 0, markup.slice(0, 240));
  const ids = new Set(controls);
  assert.equal(ids.size, 1, [...ids].join(','));
  return controls[0];
}

function assertToggleClosed(markup: string, label: string) {
  assert.equal(markup.includes('aria-expanded="true"'), false, label);
  assert.match(markup, /aria-expanded="false"/, label);
  const id = panelIdFrom(markup);
  const tagAt = markup.indexOf(`id="${id}"`);
  assert.ok(tagAt > 0, `${label} ${id}`);
  const tagEnd = markup.indexOf('>', tagAt);
  const tag = markup.slice(markup.lastIndexOf('<', tagAt), tagEnd + 1);
  assert.match(tag, /\bhidden(?:=|"|\s|>)/, `${label} panel tag ${tag}`);
  const header = markup.slice(0, tagAt);
  assert.match(header, /<h2\b/, `${label} title`);
  assert.match(header, /<p\b/, `${label} summary`);
  return { id, header, tagEnd };
}

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === '.next') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, acc);
    else if (/\.(ts|tsx)$/.test(name)) acc.push(full);
  }
  return acc;
}

const shared = Object.values(ADVISOR_FLOWS).filter((flow): flow is AdvisorFlowDef => Boolean(flow));
assert.equal(shared.length, 6);
assert.equal(BESPOKE.length, 11);
assert.equal(shared.length + BESPOKE.length + 1, 18);

const roleExtras: Array<string | null | undefined> = [null, undefined, '', 'not-a-role'];

for (const flow of shared) {
  const roles: Array<string | null | undefined> = [...flow.roles.map((role) => role.id), ...roleExtras];
  for (const role of roles) {
    const view = resolveAdvisorFlow(flow, { role: role as string | undefined, hrefBase: flow.hrefRoot });
    assert.equal('open' in view, false, `${flow.module} ${String(role)}`);
    assert.equal(view.title, flow.title, flow.module);
    assert.match(view.statusLine, /live/, `${flow.module} status`);
    const markup = html(
      createElement(AdvisorProcessFlow, {
        module: flow.module,
        role: role as string | undefined,
        hrefBase: flow.hrefRoot,
      })
    );
    const closed = assertToggleClosed(markup, `${flow.module}:${String(role)}`);
    assert.ok(closed.header.includes(flow.title), flow.module);
    assert.ok(closed.header.includes(view.statusLine), `${flow.module} status line`);
    const panelBody = markup.slice(closed.tagEnd + 1, markup.indexOf('</div>', closed.tagEnd));
    assert.match(panelBody, /<li\b/, `${flow.module} panel stays mounted`);
  }
}

const advisorSource = readFileSync('components/advisors/AdvisorProcessFlow.tsx', 'utf8');
assert.match(advisorSource, /const \[open, setOpen\] = useState\(false\)/);
assert.equal(advisorSource.includes('defaultCollapsed'), false);
assert.equal(advisorSource.includes('desiredOpen'), false);
assert.equal(/useEffect\(\(\) => \{\s*setOpen/.test(advisorSource), false);

for (const item of BESPOKE) {
  const source = readFileSync(item.file, 'utf8');
  assert.match(source, /defaultCollapsed = true/, item.name);
  const tags: string[] = [];
  let from = 0;
  while (from < source.length) {
    const start = source.indexOf('<button', from);
    if (start < 0) break;
    let end = start + '<button'.length;
    while (end < source.length && !(source[end] === '>' && source[end - 1] !== '=')) end += 1;
    assert.ok(end < source.length, item.name);
    const tag = source.slice(start, end + 1);
    if (tag.includes('setOpen')) tags.push(tag);
    from = end + 1;
  }
  assert.ok(tags.length >= 1, item.name);
  const clicks = source.match(/onClick=\{\(\) => setOpen\(\(v\) => !v\)\}/g) || [];
  assert.equal(tags.length, clicks.length, `${item.name} toggle buttons`);
  for (const tag of tags) {
    assert.match(tag, /aria-expanded=\{open\}/, item.name);
    assert.match(tag, /aria-controls="/, item.name);
  }
  const markup = html(createElement(item.Component, {}));
  const closed = assertToggleClosed(markup, item.name);
  const panelBody = markup.slice(closed.tagEnd + 1, markup.indexOf('</div>', closed.tagEnd));
  assert.equal(panelBody.trim(), '', `${item.name} hides the tree while closed`);
  const title = closed.header.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/);
  assert.ok(title, item.name);
  const titleText = title[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  assert.ok(titleText.length > 0, item.name);
  assert.ok(closed.header.includes(titleText), item.name);
}

for (const audience of ['dbe', 'school', 'isp'] as const) {
  const markup = html(createElement(NsnpSystemFlow, { audience }));
  assertToggleClosed(markup, `schools ${audience}`);
}

const recoverRoles: RecoverRole[] = ['owner', 'manager', 'agent', 'finance', 'compliance', 'viewer', 'none'];
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

function recoverDesk(role: RecoverRole): RecoverDeskPayload {
  return {
    ready: true,
    workspace,
    role,
    capabilities: capabilitiesFor(role),
    counts: { creditors: null, mandates: null, staff: null },
    creditors: [],
    mandates: [],
    staff: [],
    self: null,
    book: null,
  };
}

for (const role of recoverRoles) {
  const view = resolveProcessFlow({
    role,
    capabilities: capabilitiesFor(role),
    counts: { creditors: null, mandates: null, staff: null },
    mandates: [],
    book: null,
    ready: true,
    sample: false,
    preview: 'live',
  });
  assert.equal(view.defaultCollapsed, true, role);
  const markup = html(createElement(RecoverProcessFlow, { desk: recoverDesk(role) }));
  const closed = assertToggleClosed(markup, `recover ${role}`);
  assert.ok(closed.header.includes('From placement to payment'), role);
  assert.match(closed.header, /steps are live/, role);
  const panelBody = markup.slice(closed.tagEnd + 1, markup.indexOf('</div>', closed.tagEnd));
  assert.equal(panelBody.trim(), '', `recover ${role} panel`);
}

const roots = ['app', 'components', 'lib', 'e2e'].flatMap((dir) => walk(dir));
const rendered = roots.filter((file) => {
  if (file.includes('.test.')) return false;
  const text = readFileSync(file, 'utf8');
  return RENDER_NAMES.some((name) => text.includes(`<${name}`) || text.includes(`function ${name}`));
});
assert.ok(rendered.some((file) => file.endsWith('components/advisors/AdvisorProcessFlow.tsx')));
assert.ok(rendered.some((file) => file.endsWith('components/recovery/RecoverProcessFlow.tsx')));
assert.ok(rendered.some((file) => file.endsWith('components/schools/NsnpSystemFlow.tsx')));
assert.ok(rendered.some((file) => file.includes('app/dashboard/schools/isps/page.tsx')));
function collapseBindings(text: string): string[] {
  const bad: string[] = [];
  const re = /defaultCollapsed(\s*\?\s*:|\s*=\s*\{([^{}]*)\}|\s*=\s*([^\s,/>]+))?/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    if (!match[1] || /^\s*\?\s*:/.test(match[1])) continue;
    const expr = (match[2] ?? match[3] ?? '').trim();
    if (expr === 'true') continue;
    bad.push(match[0].trim());
  }
  return bad;
}

for (const file of rendered) {
  const text = readFileSync(file, 'utf8');
  assert.deepEqual(collapseBindings(text), [], file);
  assert.equal(/\bopenByDefault\b/.test(text), false, file);
  assert.equal(/\bopenWhenRoleUnknown\b/.test(text), false, file);
  assert.equal(/\bflowDefaultOpen\b/.test(text), false, file);
}

const doc = readFileSync('docs/advisor-process-flows.md', 'utf8');
assert.match(doc, /starts closed for every role/);
assert.match(doc, /aria-expanded/);
assert.match(doc, /aria-controls/);
assert.equal(/start open/.test(doc), false);
assert.equal(doc.includes('openWhenRoleUnknown'), false);

console.log('brief121-closed-by-default.test.ts ok');
