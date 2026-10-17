/**
 * Run: npx --yes tsx lib/advisors/process-flows/brief121-core-ui.test.ts
 */
import assert from 'node:assert/strict';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdvisorProcessFlow } from '../../../components/advisors/AdvisorProcessFlow';
import { coreFlowCaps } from './core-caps';
import { CORE_FLOWS } from './core';
import type { CoreFlowModuleId } from './types';

function html(node: ReactElement): string {
  return renderToStaticMarkup(node);
}

function paint(module: CoreFlowModuleId, role: string): string {
  return html(
    createElement(AdvisorProcessFlow, {
      module,
      role,
      caps: coreFlowCaps(role),
      hrefBase: CORE_FLOWS[module].hrefRoot,
    })
  );
}

function assertClosed(markup: string, module: CoreFlowModuleId) {
  const flow = CORE_FLOWS[module];
  assert.match(markup, /aria-expanded="false"/);
  assert.match(markup, new RegExp(`aria-controls="${flow.anchorId}-panel"`));
  assert.match(markup, new RegExp(`id="${flow.anchorId}-panel"[^>]*hidden`));
  assert.match(markup, new RegExp(flow.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(markup, new RegExp(flow.lead.slice(0, 24).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.equal(markup.includes('aria-label='), false, module);
  assert.equal(markup.includes('<aside'), false, module);
  assert.equal(markup.includes('text-white'), false, module);
  assert.match(markup, /background-color:#00b4d8/);
  assert.match(markup, /color:#0f172a/);
  const hrefs = [...markup.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
  const allowed = new Set<string>();
  for (const step of flow.steps) {
    for (const target of [step.to, ...(step.secondary || [])]) {
      if (!target) continue;
      const href = target.scope === 'app' ? target.path : `${flow.hrefRoot.replace(/\/$/, '')}/${target.path.replace(/^\//, '')}`;
      allowed.add(href);
    }
  }
  for (const href of hrefs) assert.equal(allowed.has(href), true, `${module} ${href}`);
}

for (const module of Object.keys(CORE_FLOWS) as CoreFlowModuleId[]) {
  assertClosed(paint(module, 'owner'), module);
}

const viewerHome = paint('home', 'viewer');
assert.equal(viewerHome.includes('href="/dashboard/accounting/accounts-payable"'), false);
assert.equal(viewerHome.includes('href="/dashboard/accounting/payments"'), false);
assert.equal(viewerHome.includes('href="/dashboard/accounting/bank-reconciliation"'), false);
assert.match(viewerHome, /Not available to your role/);
assert.match(viewerHome, /href="\/dashboard\/suppliers\/discover"/);

const viewerCustomers = paint('customers', 'viewer');
assert.equal(viewerCustomers.includes('href="/sales/tasks"'), false);
assert.match(viewerCustomers, /href="\/dashboard\/customers\/profiles"/);

const contractorSales = paint('sales-portal', 'sales_contractor');
assert.match(contractorSales, /href="\/sales\/agreement"/);
assert.match(contractorSales, /You are the sales contractor/);

const adminHome = paint('home', 'admin');
assert.equal(adminHome.includes('href="/dashboard/accounting/accounts-payable"'), false);
assert.equal(adminHome.includes('href="/dashboard/accounting/payments"'), false);
assert.equal(adminHome.includes('href="/dashboard/accounting/bank-reconciliation"'), false);
assert.match(adminHome, /href="\/dashboard\/suppliers\/discover"/);

const financeHome = paint('home', 'finance');
assert.match(financeHome, /href="\/dashboard\/accounting\/payments"/);
assert.match(financeHome, /href="\/dashboard\/suppliers\/discover"/);

const contractorSuppliers = paint('suppliers', 'sales_contractor');
assert.equal(contractorSuppliers.includes('href='), false);
assert.match(contractorSuppliers, /Not available to your role/);

const memberSales = paint('sales-portal', 'member');
assert.equal(memberSales.includes('href='), false);
assert.match(memberSales, /Not available to your role/);

console.log('brief121-core-ui.test.ts ok');
