/**
 * Run: npx --yes tsx lib/advisors/process-flows/brief121-core-client.test.ts
 * Effects run. A role change must not open or close a flow by itself.
 */
import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { createRequire, Module } from 'node:module';
import { readFileSync } from 'node:fs';
import { createElement, useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://127.0.0.1:3000/' });
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

function EffectMark() {
  const [ran, setRan] = useState(false);
  useEffect(() => setRan(true), []);
  return createElement('span', { 'data-testid': 'effects-ran', 'data-ran': ran ? '1' : '0' });
}

function Host(props: { children: ReactNode }) {
  return createElement('div', null, createElement(EffectMark), props.children);
}

function show(node: ReactElement) {
  return render(createElement(Host, null, node));
}

function at(path: string) {
  window.history.pushState({}, '', path);
}

async function main() {
  const flowSrc = readFileSync('components/advisors/AdvisorProcessFlow.tsx', 'utf8');
  assert.equal((flowSrc.match(/setOpen\(/g) || []).length, 1);
  assert.match(flowSrc, /useState\(false\)/);
  assert.doesNotMatch(flowSrc, /useState\(true\)/);
  const coreSrc = readFileSync('components/advisors/CoreProcessFlow.tsx', 'utf8');
  assert.equal((coreSrc.match(/setOpen\(/g) || []).length, 0);
  assert.match(coreSrc, /useEffect\(\(\) => \{\s*setFixture\(isFixturePath\('\/preview'\)\);\s*\}, \[\]\);/);
  assert.equal(coreSrc.includes("'owner'"), false);
  assert.equal(coreSrc.includes('"owner"'), false);

  const { CoreProcessFlow } = await import('../../../components/advisors/CoreProcessFlow');

  companyRoleState.loading = true;
  companyRoleState.role = 'owner';
  at('/');
  const loading = show(createElement(CoreProcessFlow, { module: 'home' }));
  assert.equal(loading.container.querySelector('[data-testid="effects-ran"]')?.getAttribute('data-ran'), '1');
  assert.equal(loading.container.querySelector('[data-testid="advisor-flow-home"]'), null);
  loading.unmount();

  companyRoleState.loading = true;
  companyRoleState.role = null;
  at('/');
  const unknown = show(createElement(CoreProcessFlow, { module: 'customers' }));
  assert.equal(unknown.container.querySelector('[data-testid="advisor-flow-customers"]'), null);
  companyRoleState.loading = false;
  companyRoleState.role = 'owner';
  unknown.rerender(createElement(Host, null, createElement(CoreProcessFlow, { module: 'customers' })));
  const closed = unknown.container.querySelector('[data-testid="advisor-flow-customers"]');
  assert.ok(closed);
  const toggle = closed.querySelector('[data-testid="advisor-flow-toggle"]');
  assert.equal(toggle?.tagName, 'BUTTON');
  assert.equal(toggle?.getAttribute('aria-expanded'), 'false');
  assert.equal(toggle?.getAttribute('aria-controls'), 'customers-process-flow-panel');
  assert.equal(closed.querySelectorAll('#customers-process-flow-panel').length, 1);
  assert.equal(closed.querySelector('#customers-process-flow-panel')?.hasAttribute('hidden'), true);
  assert.equal(closed.querySelector('[aria-label]'), null);
  fireEvent.click(toggle as Element);
  assert.equal(toggle?.getAttribute('aria-expanded'), 'true');
  assert.equal(closed.querySelector('#customers-process-flow-panel')?.hasAttribute('hidden'), false);
  companyRoleState.role = 'viewer';
  unknown.rerender(createElement(Host, null, createElement(CoreProcessFlow, { module: 'customers' })));
  assert.equal(toggle?.getAttribute('aria-expanded'), 'true');
  assert.equal(unknown.container.querySelector('a[href="/sales/tasks"]'), null);
  assert.ok(unknown.container.querySelector('a[href="/dashboard/customers/profiles"]'));
  unknown.unmount();

  companyRoleState.loading = false;
  companyRoleState.role = null;
  at('/');
  const signedOut = show(createElement(CoreProcessFlow, { module: 'home' }));
  assert.equal(signedOut.container.querySelector('[data-testid="advisor-flow-home"]'), null);
  signedOut.unmount();

  companyRoleState.loading = false;
  companyRoleState.role = 'sales_contractor';
  at('/');
  const contractor = show(createElement(CoreProcessFlow, { module: 'home' }));
  assert.equal(contractor.container.querySelector('[data-testid="advisor-flow-home"]'), null);
  contractor.unmount();
  const contractorSales = show(createElement(CoreProcessFlow, { module: 'sales-portal' }));
  assert.equal(contractorSales.container.querySelector('[aria-expanded]')?.getAttribute('aria-expanded'), 'false');
  assert.match(contractorSales.container.textContent || '', /You are the sales contractor/);
  contractorSales.unmount();

  companyRoleState.loading = true;
  companyRoleState.role = null;
  at('/preview/dashboard');
  const fixture = show(createElement(CoreProcessFlow, { module: 'home' }));
  assert.match(fixture.container.textContent || '', /You are the owner/);
  assert.equal(fixture.container.querySelector('[aria-expanded]')?.getAttribute('aria-expanded'), 'false');
  assert.equal(fixture.container.querySelector('a[href="/dashboard/accounting/payments"]'), null);
  const fixtureHrefs = [...fixture.container.querySelectorAll('a')].map((node) => node.getAttribute('href') || '');
  assert.equal(fixtureHrefs.some((href) => href.startsWith('/dashboard')), false);
  assert.equal(fixtureHrefs.includes('/preview/po'), true);
  fixture.unmount();

  companyRoleState.loading = false;
  companyRoleState.role = 'owner';
  at('/');
  const make = show(createElement(CoreProcessFlow, { module: 'manufacturing' }));
  const makeToggle = make.container.querySelector('[data-testid="advisor-flow-toggle"]');
  assert.equal(makeToggle?.getAttribute('aria-expanded'), 'false');
  fireEvent.click(makeToggle as Element);
  assert.equal(makeToggle?.getAttribute('aria-expanded'), 'true');
  companyRoleState.role = 'viewer';
  make.rerender(createElement(Host, null, createElement(CoreProcessFlow, { module: 'manufacturing' })));
  assert.equal(makeToggle?.getAttribute('aria-expanded'), 'true');
  assert.ok(make.container.querySelector('a[href="/dashboard/manufacturing/mrp"]'));
  make.unmount();

  companyRoleState.loading = false;
  companyRoleState.role = 'sales_contractor';
  at('/');
  const contractorInventory = show(createElement(CoreProcessFlow, { module: 'inventory' }));
  assert.equal(contractorInventory.container.querySelector('[data-testid="advisor-flow-inventory"]'), null);
  contractorInventory.unmount();

  companyRoleState.loading = true;
  companyRoleState.role = null;
  at('/preview/inventory');
  const inventoryFixture = show(createElement(CoreProcessFlow, { module: 'inventory' }));
  assert.match(inventoryFixture.container.textContent || '', /You are the owner/);
  assert.equal(inventoryFixture.container.querySelector('[aria-expanded]')?.getAttribute('aria-expanded'), 'false');
  const inventoryHrefs = [...inventoryFixture.container.querySelectorAll('a')].map((node) => node.getAttribute('href') || '');
  assert.equal(inventoryHrefs.some((href) => href.startsWith('/dashboard')), false);
  assert.equal(inventoryHrefs.includes('/preview/inventory?screen=stock'), true);
  assert.equal(inventoryHrefs.includes('/preview/po'), true);
  inventoryFixture.unmount();

  companyRoleState.loading = true;
  companyRoleState.role = null;
  at('/preview/sheq');
  const sheqFixture = show(createElement(CoreProcessFlow, { module: 'sheq' }));
  assert.equal(sheqFixture.container.querySelector('[aria-expanded]')?.getAttribute('aria-expanded'), 'false');
  const sheqHrefs = [...sheqFixture.container.querySelectorAll('a')].map((node) => node.getAttribute('href') || '');
  assert.equal(sheqHrefs.some((href) => href.startsWith('/dashboard')), false);
  assert.equal(sheqHrefs.includes('/preview/sheq?screen=incidents'), true);
  assert.equal(sheqHrefs.includes('/preview/sheq?screen=capas'), true);
  sheqFixture.unmount();

  companyRoleState.loading = false;
  companyRoleState.role = 'owner';
  at('/');
  const projects = show(createElement(CoreProcessFlow, { module: 'projects' }));
  const projectsToggle = projects.container.querySelector('[data-testid="advisor-flow-toggle"]');
  assert.equal(projectsToggle?.getAttribute('aria-expanded'), 'false');
  assert.equal(projects.container.querySelector('#projects-process-flow-panel')?.hasAttribute('hidden'), true);
  fireEvent.click(projectsToggle as Element);
  assert.equal(projectsToggle?.getAttribute('aria-expanded'), 'true');
  companyRoleState.role = 'viewer';
  projects.rerender(createElement(Host, null, createElement(CoreProcessFlow, { module: 'projects' })));
  assert.equal(projectsToggle?.getAttribute('aria-expanded'), 'true');
  assert.ok(projects.container.querySelector('a[href="/dashboard/projects/portfolio"]'));
  projects.unmount();

  companyRoleState.loading = false;
  companyRoleState.role = 'owner';
  at('/');
  const books = show(createElement(CoreProcessFlow, { module: 'accounting' }));
  const booksToggle = books.container.querySelector('[data-testid="advisor-flow-toggle"]');
  assert.equal(booksToggle?.getAttribute('aria-expanded'), 'false');
  fireEvent.click(booksToggle as Element);
  assert.equal(booksToggle?.getAttribute('aria-expanded'), 'true');
  companyRoleState.role = 'finance';
  books.rerender(createElement(Host, null, createElement(CoreProcessFlow, { module: 'accounting' })));
  assert.equal(books.container.querySelector('[data-testid="advisor-flow-toggle"]')?.getAttribute('aria-expanded'), 'true');
  assert.match(books.container.textContent || '', /You are the finance/);
  companyRoleState.role = 'admin';
  books.rerender(createElement(Host, null, createElement(CoreProcessFlow, { module: 'accounting' })));
  assert.equal(books.container.querySelector('[data-testid="advisor-flow-accounting"]'), null);
  books.unmount();

  companyRoleState.loading = false;
  companyRoleState.role = 'admin';
  at('/');
  const adminBooks = show(createElement(CoreProcessFlow, { module: 'accounting' }));
  assert.equal(adminBooks.container.querySelector('[data-testid="advisor-flow-accounting"]'), null);
  adminBooks.unmount();

  companyRoleState.loading = true;
  companyRoleState.role = 'finance';
  at('/');
  const booksLoading = show(createElement(CoreProcessFlow, { module: 'accounting' }));
  assert.equal(booksLoading.container.querySelector('[data-testid="advisor-flow-accounting"]'), null);
  booksLoading.unmount();

  companyRoleState.loading = false;
  companyRoleState.role = 'sales_contractor';
  at('/');
  for (const module of ['projects', 'people', 'sustainability', 'network', 'accounting'] as const) {
    const blocked = show(createElement(CoreProcessFlow, { module }));
    assert.equal(blocked.container.querySelector(`[data-testid="advisor-flow-${module}"]`), null, module);
    blocked.unmount();
  }

  companyRoleState.loading = false;
  companyRoleState.role = 'owner';
  at('/');
  const impact = show(createElement(CoreProcessFlow, { module: 'sustainability' }));
  assert.equal(impact.container.querySelector('[aria-expanded]')?.getAttribute('aria-expanded'), 'false');
  fireEvent.click(impact.container.querySelector('[data-testid="advisor-flow-toggle"]') as Element);
  companyRoleState.role = 'operations';
  impact.rerender(createElement(Host, null, createElement(CoreProcessFlow, { module: 'sustainability' })));
  assert.equal(impact.container.querySelector('[aria-expanded]')?.getAttribute('aria-expanded'), 'true');
  assert.match(impact.container.textContent || '', /estimate/);
  impact.unmount();

  cleanup();
  console.log('brief121-core-client.test.ts ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
