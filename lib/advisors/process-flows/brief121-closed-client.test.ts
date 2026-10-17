/**
 * Run: npx --yes tsx lib/advisors/process-flows/brief121-closed-client.test.ts
 * Client render. Effects run. A role change must not open a flow.
 */
import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { createRequire, Module } from 'node:module';
import { createElement, useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { cleanup, render } from '@testing-library/react';
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
import type { RecoverDeskPayload, RecoverRole, RecoverWorkspace } from '../../recovery/types';
import { resolveAdvisorFlow } from './resolve';
import { sliceHealthFlow } from './health';
const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://127.0.0.1:3000',
});
const { window } = dom;
for (const [key, value] of Object.entries({
  window,
  self: window,
  document: window.document,
  navigator: window.navigator,
  HTMLElement: window.HTMLElement,
  Element: window.Element,
  Node: window.Node,
  DocumentFragment: window.DocumentFragment,
  MutationObserver: window.MutationObserver,
  getComputedStyle: window.getComputedStyle.bind(window),
  IS_REACT_ACT_ENVIRONMENT: true,
  requestAnimationFrame: (cb: FrameRequestCallback) => window.setTimeout(() => cb(Date.now()), 0),
  cancelAnimationFrame: (id: number) => window.clearTimeout(id),
})) {
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
}

const nodeRequire = createRequire(import.meta.url);
const companyRoleMockPath = nodeRequire.resolve('./brief121-company-role-mock.cjs');
const resolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (typeof request === 'string' && request.includes('useCompanyRole')) return companyRoleMockPath;
  return resolveFilename.call(this, request, parent, isMain, options);
};
const { companyRoleState } = nodeRequire('./brief121-company-role-mock.cjs') as {
  companyRoleState: { loading: boolean; role: string | null };
};

const BESPOKE = [
  FitgraphSystemFlow,
  PhysiographSystemFlow,
  PsychiatrygraphSystemFlow,
  MedicalgraphSystemFlow,
  VetgraphSystemFlow,
  DentalgraphSystemFlow,
  HiregraphSystemFlow,
  RetailgraphSystemFlow,
  QuarrygraphSystemFlow,
  FieldgraphSystemFlow,
  NsnpSystemFlow,
];

function EffectMark() {
  const [ran, setRan] = useState(false);
  useEffect(() => {
    setRan(true);
  }, []);
  return createElement('span', { 'data-testid': 'effects-ran', 'data-ran': ran ? '1' : '0' });
}

function Host(props: { children: ReactNode }) {
  return createElement('div', null, createElement(EffectMark), props.children);
}

function assertEffectsRan(container: HTMLElement, label: string) {
  const mark = container.querySelector('[data-testid="effects-ran"]');
  assert.equal(mark?.getAttribute('data-ran'), '1', `${label} effects did not run`);
}

function assertInlineToggleNotWhite(toggle: Element, label: string) {
  const color = (toggle as HTMLElement).style.color.replace(/\s/g, '').toLowerCase();
  assert.equal(color === '#fff' || color === '#ffffff' || color === 'rgb(255,255,255)', false, label);
}

function assertClosed(container: HTMLElement, label: string, readyId?: string) {
  assertEffectsRan(container, label);
  const toggles = [...container.querySelectorAll('[aria-expanded]')];
  assert.ok(toggles.length > 0, `${label} missing toggle`);
  for (const toggle of toggles) {
    assert.equal(toggle.getAttribute('aria-expanded'), 'false', label);
    const controls = toggle.getAttribute('aria-controls');
    assert.ok(controls, label);
    assert.equal(container.querySelectorAll(`[id="${controls}"]`).length, 1, label);
    assertInlineToggleNotWhite(toggle, label);
  }
  if (readyId) {
    assert.equal(
      container.querySelector(`[data-testid="${readyId}"]`)?.getAttribute('data-flow-ready'),
      '1',
      `${label} hydration`
    );
  }
}

function show(node: ReactElement) {
  return render(createElement(Host, null, node));
}

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

function advisor(module: 'tradegraph' | 'apparelgraph' | 'containers', role?: string) {
  const hrefBase =
    module === 'tradegraph'
      ? '/dashboard/tradegraph'
      : module === 'apparelgraph'
        ? '/dashboard/apparelgraph'
        : '/dashboard/containers';
  return createElement(AdvisorProcessFlow, { module, role, hrefBase });
}

async function main() {
  const apparel = await import('../../../app/dashboard/apparelgraph/page');
  const containers = await import('../../../app/dashboard/containers/page');
  const health = await import('../../../app/dashboard/health/page');

  for (const Component of BESPOKE) {
    const view = show(createElement(Component, {}));
    assertClosed(view.container, Component.name || 'bespoke');
    view.unmount();
  }

  const gym = show(createElement(FitgraphSystemFlow, { hasFrontDesk: true }));
  assertClosed(gym.container, 'gym first');
  gym.rerender(createElement(Host, null, createElement(FitgraphSystemFlow, { hasFrontDesk: false })));
  assertClosed(gym.container, 'gym prop change');
  gym.unmount();

  const shared = show(advisor('tradegraph', undefined));
  assertClosed(shared.container, 'shared unknown', 'advisor-flow-tradegraph');
  shared.rerender(createElement(Host, null, advisor('tradegraph', 'owner')));
  assertClosed(shared.container, 'shared owner after unknown', 'advisor-flow-tradegraph');
  shared.rerender(createElement(Host, null, advisor('tradegraph', 'manager')));
  assertClosed(shared.container, 'shared manager after owner', 'advisor-flow-tradegraph');
  shared.unmount();

  for (const role of ['owner', 'manager'] as const) {
    const fresh = show(advisor('tradegraph', role));
    assertClosed(fresh.container, `shared fresh ${role}`, 'advisor-flow-tradegraph');
    fresh.unmount();
  }

  companyRoleState.loading = true;
  companyRoleState.role = null;
  const apparelView = show(createElement(apparel.ApparelFlow));
  assertClosed(apparelView.container, 'apparel loading', 'advisor-flow-apparelgraph');
  companyRoleState.loading = false;
  companyRoleState.role = 'owner';
  apparelView.rerender(createElement(Host, null, createElement(apparel.ApparelFlow)));
  assertClosed(apparelView.container, 'apparel owner', 'advisor-flow-apparelgraph');
  assert.match(apparelView.container.innerHTML, /You are the owner/);
  companyRoleState.role = 'manager';
  apparelView.rerender(createElement(Host, null, createElement(apparel.ApparelFlow)));
  assertClosed(apparelView.container, 'apparel manager', 'advisor-flow-apparelgraph');
  apparelView.unmount();

  companyRoleState.loading = true;
  companyRoleState.role = null;
  const containerView = show(createElement(containers.ContainersFlow));
  assertEffectsRan(containerView.container, 'containers loading');
  assert.equal(containerView.container.querySelectorAll('[aria-expanded]').length, 0, 'containers hidden while role loads');
  companyRoleState.loading = false;
  companyRoleState.role = 'owner';
  containerView.rerender(createElement(Host, null, createElement(containers.ContainersFlow)));
  assertClosed(containerView.container, 'containers owner', 'advisor-flow-containers');
  assert.match(containerView.container.innerHTML, /You are the owner/);
  companyRoleState.role = 'manager';
  containerView.rerender(createElement(Host, null, createElement(containers.ContainersFlow)));
  assertClosed(containerView.container, 'containers manager', 'advisor-flow-containers');
  containerView.unmount();

  const healthView = show(createElement(health.HealthFlow, { audience: 'facility' }));
  assertClosed(healthView.container, 'health facility', 'advisor-flow-health');
  healthView.rerender(createElement(Host, null, createElement(health.HealthFlow, { audience: 'department' })));
  assertClosed(healthView.container, 'health department', 'advisor-flow-health');
  healthView.rerender(createElement(Host, null, createElement(health.HealthFlow, { audience: 'sp' })));
  assertClosed(healthView.container, 'health provider', 'advisor-flow-health');
  healthView.unmount();

  const healthDirect = show(
    createElement(AdvisorProcessFlow, {
      view: resolveAdvisorFlow(sliceHealthFlow('facility'), {
        role: 'facility',
        audience: 'facility',
        hrefBase: '/dashboard/health',
      }),
    })
  );
  assertClosed(healthDirect.container, 'health view', 'advisor-flow-health');
  healthDirect.rerender(
    createElement(
      Host,
      null,
      createElement(AdvisorProcessFlow, {
        view: resolveAdvisorFlow(sliceHealthFlow('department'), {
          role: 'department',
          audience: 'department',
          hrefBase: '/dashboard/health',
        }),
      })
    )
  );
  assertClosed(healthDirect.container, 'health view changed', 'advisor-flow-health');
  healthDirect.unmount();

  const recover = show(createElement(RecoverProcessFlow, { desk: recoverDesk('agent') }));
  assertClosed(recover.container, 'recover agent');
  recover.rerender(createElement(Host, null, createElement(RecoverProcessFlow, { desk: recoverDesk('owner') })));
  assertClosed(recover.container, 'recover owner after agent');
  recover.rerender(createElement(Host, null, createElement(RecoverProcessFlow, { desk: recoverDesk('manager') })));
  assertClosed(recover.container, 'recover manager after owner');
  recover.unmount();

  for (const role of ['owner', 'manager'] as const) {
    const fresh = show(createElement(RecoverProcessFlow, { desk: recoverDesk(role) }));
    assertClosed(fresh.container, `recover fresh ${role}`);
    fresh.unmount();
  }

  cleanup();
  console.log('brief121-closed-client.test.ts ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
