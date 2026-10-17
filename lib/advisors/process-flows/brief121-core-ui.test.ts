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

function openingTag(markup: string, marker: string): string {
  const at = markup.indexOf(marker);
  assert.ok(at >= 0, marker);
  const start = markup.lastIndexOf('<', at);
  return markup.slice(start, markup.indexOf('>', start) + 1);
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
  const header = openingTag(markup, 'data-flow-header');
  assert.match(header, /background-color:#00b4d8/, module);
  assert.match(header, /color:#0f172a/, module);
  assert.doesNotMatch(header, /color:#fff\b|color:#ffffff|color:white/i, module);
  const hrefs = [...markup.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
  const allowed = new Set<string>();
  for (const step of flow.steps) {
    for (const target of [step.to, ...(step.secondary || [])]) {
      if (!target) continue;
      const raw = target.scope === 'app' ? target.path : target.path;
      const queryAt = raw.indexOf('?');
      const pathname = queryAt === -1 ? raw : raw.slice(0, queryAt);
      const search = queryAt === -1 ? '' : raw.slice(queryAt);
      const href = target.scope === 'app'
        ? `${pathname}${search}`
        : `${flow.hrefRoot.replace(/\/$/, '')}${pathname.replace(/^\//, '') ? `/${pathname.replace(/^\//, '')}` : ''}${search}`;
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

const viewerMake = paint('manufacturing', 'viewer');
assert.match(viewerMake, /href="\/dashboard\/manufacturing\/bills-of-materials"/);
assert.match(viewerMake, /href="\/dashboard\/manufacturing\/mrp"/);
assert.match(viewerMake, /does not raise a purchase order/);
assert.equal(viewerMake.includes('Not available to your role'), false);
assert.equal(viewerMake.includes('You are the viewer'), true);

const ownerShip = paint('distribution', 'owner');
assert.match(ownerShip, /Capture proof of delivery/);
assert.match(ownerShip, /Launching soon/);
assert.equal(ownerShip.includes('href="/dashboard/distribution/tracking"'), true);
assert.equal((ownerShip.match(/<a /g) || []).length, 6);

const contractorInventory = paint('inventory', 'sales_contractor');
assert.equal(contractorInventory.includes('href='), false);
assert.match(contractorInventory, /Not available to your role/);

const ownerInventory = paint('inventory', 'owner');
assert.match(ownerInventory, /href="\/dashboard\/inventory\/stock"/);
assert.match(ownerInventory, /href="\/dashboard\/inventory\/lots"/);
assert.match(ownerInventory, /href="\/dashboard\/suppliers\/po"/);
assert.match(ownerInventory, /Only the owner or an admin can override/);

const viewerQuality = paint('quality', 'viewer');
assert.match(viewerQuality, /href="\/dashboard\/quality\/inspections"/);
assert.match(viewerQuality, /href="\/dashboard\/quality\/traceability-graph"/);
assert.match(viewerQuality, /This is a drill/);
assert.match(viewerQuality, /not a submission/);

const ownerSheq = paint('sheq', 'owner');
assert.match(ownerSheq, /href="\/dashboard\/sheq\/incidents"/);
assert.match(ownerSheq, /href="\/dashboard\/quality\/inspections"/);
assert.match(ownerSheq, /You are the owner/);

const ownerProjects = paint('projects', 'owner');
assert.match(ownerProjects, /href="\/dashboard\/projects\/portfolio"/);
assert.match(ownerProjects, /href="\/dashboard\/projects\/dmaic"/);
assert.match(ownerProjects, /href="\/dashboard\/projects\/sdg"/);
assert.match(ownerProjects, /href="\/dashboard\/projects\/gantt"/);
assert.match(ownerProjects, /does not block the move/);
assert.match(ownerProjects, /The chart is read only/);
assert.equal(ownerProjects.includes('aria-expanded="true"'), false);

const viewerProjects = paint('projects', 'viewer');
assert.match(viewerProjects, /href="\/dashboard\/projects\/kanban-boards"/);
assert.match(viewerProjects, /You are the viewer/);
assert.equal(viewerProjects.includes('Not available to your role'), false);

const financeBooks = paint('accounting', 'finance');
assert.match(financeBooks, /href="\/dashboard\/accounting\/chart-of-accounts"/);
assert.match(financeBooks, /href="\/dashboard\/accounting\/journal-entries"/);
assert.match(financeBooks, /href="\/dashboard\/accounting\/payments"/);
assert.match(financeBooks, /href="\/dashboard\/accounting\/afs"/);
assert.match(financeBooks, /href="\/dashboard\/accounting\/balance-sheet"/);
assert.match(financeBooks, /compiled and unaudited/);
assert.match(financeBooks, /does not send money from a bank/);
assert.match(financeBooks, /You are the finance/);

const adminBooks = paint('accounting', 'admin');
assert.equal(adminBooks.includes('href="/dashboard/accounting/chart-of-accounts"'), false);
assert.equal(adminBooks.includes('href="/dashboard/accounting/payments"'), false);
assert.equal(adminBooks.includes('href="/dashboard/accounting/afs"'), false);
assert.match(adminBooks, /Not available to your role/);
assert.equal((adminBooks.match(/<a /g) || []).length, 0);

const memberBooks = paint('accounting', 'member');
assert.equal((memberBooks.match(/<a /g) || []).length, 0);

const ownerPeople = paint('people', 'owner');
assert.match(ownerPeople, /href="\/dashboard\/people\/directory\?new=1"/);
assert.match(ownerPeople, /href="\/dashboard\/people\/organisation"/);
assert.match(ownerPeople, /illustrative proxies/);
assert.match(ownerPeople, /does not pay staff from a bank/);
assert.match(ownerPeople, /does not keep a hearing log/);

const viewerPeople = paint('people', 'viewer');
assert.match(viewerPeople, /href="\/dashboard\/people\/payroll"/);
assert.equal(viewerPeople.includes('Not available to your role'), false);

const contractorPeople = paint('people', 'sales_contractor');
assert.equal((contractorPeople.match(/<a /g) || []).length, 0);
assert.match(contractorPeople, /Not available to your role/);

const ownerImpact = paint('sustainability', 'owner');
assert.match(ownerImpact, /href="\/dashboard\/sustainability\/carbon-tracking"/);
assert.match(ownerImpact, /href="\/dashboard\/sustainability\/regenerative-dashboard"/);
assert.match(ownerImpact, /href="\/dashboard\/sustainability\/reports"/);
assert.match(ownerImpact, /order-of-magnitude/);
assert.match(ownerImpact, /as an estimate/);
assert.match(ownerImpact, /not an audit/);
assert.equal(ownerImpact.toLowerCase().includes('net zero'), false);
assert.equal(ownerImpact.toLowerCase().includes('verified'), false);

const financeImpact = paint('sustainability', 'finance');
assert.match(financeImpact, /href="\/dashboard\/sustainability\/carbon-tracking"/);

const ownerNetwork = paint('network', 'owner');
assert.match(ownerNetwork, /href="\/dashboard\/connections\/discover"/);
assert.match(ownerNetwork, /href="\/dashboard\/connections\?tab=pending_in"/);
assert.match(ownerNetwork, /href="\/dashboard\/suppliers\/invites"/);
assert.match(ownerNetwork, /href="\/dashboard\/customers\/invites"/);
assert.match(ownerNetwork, /href="\/dashboard\/suppliers\/po"/);
assert.match(ownerNetwork, /href="\/dashboard\/customers\/quotes"/);
assert.match(ownerNetwork, /href="\/dashboard\/customers\/money"/);
assert.match(ownerNetwork, /not a public price list/);
assert.match(ownerNetwork, /does not need an accepted connection/);

const salesNetwork = paint('network', 'sales');
assert.match(salesNetwork, /href="\/dashboard\/connections\/discover"/);
assert.match(salesNetwork, /href="\/dashboard\/customers\/money"/);
assert.match(salesNetwork, /href="\/dashboard\/customers\/quotes"/);
assert.equal(salesNetwork.includes('href="/dashboard/suppliers/po"'), true);

const viewerNetwork = paint('network', 'viewer');
assert.match(viewerNetwork, /href="\/dashboard\/connections\/discover"/);
assert.equal(viewerNetwork.includes('href="/dashboard/suppliers/invites"'), true);

console.log('brief121-core-ui.test.ts ok');
