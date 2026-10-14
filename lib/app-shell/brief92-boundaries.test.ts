/**
 * Brief 92 — app shell boundaries and skeleton guardrails.
 * Run: npx --yes tsx lib/app-shell/brief92-boundaries.test.ts
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import RouteError from '@/components/app-shell/RouteError';

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const requiredCore = [
  'app/dashboard/error.tsx',
  'app/global-error.tsx',
  'app/not-found.tsx',
  'app/dashboard/loading.tsx',
] as const;

for (const path of requiredCore) {
  assert.ok(existsSync(resolve(process.cwd(), path)), `${path} must exist`);
}

for (const path of ['app/dashboard/error.tsx', 'app/global-error.tsx'] as const) {
  const text = read(path);
  assert.ok(text.startsWith("'use client';"), `${path} must start with 'use client'`);
  assert.match(text, /reset/, `${path} must call or pass reset`);
}

const rootBoundaries = [
  'app/portal/error.tsx',
  'app/me/error.tsx',
  'app/member/error.tsx',
  'app/store/error.tsx',
  'app/sales/error.tsx',
  'app/reseller/error.tsx',
  'app/contractor/error.tsx',
  'app/onboarding/error.tsx',
] as const;

const sectionBoundaries = [
  'app/dashboard/accounting/error.tsx',
  'app/dashboard/procurement/error.tsx',
  'app/dashboard/inventory/error.tsx',
  'app/dashboard/customers/error.tsx',
  'app/dashboard/suppliers/error.tsx',
  'app/dashboard/manufacturing/error.tsx',
  'app/dashboard/distribution/error.tsx',
  'app/dashboard/finance/error.tsx',
] as const;

for (const path of [...rootBoundaries, ...sectionBoundaries]) {
  assert.ok(existsSync(resolve(process.cwd(), path)), `${path} must exist`);
}

const forbiddenImportPattern = /@privy-io|\bviem\b|\bwagmi\b|\bundici\b/;
const filesThatMustStayWalletFree = [
  ...requiredCore,
  ...rootBoundaries,
  ...sectionBoundaries,
  'components/app-shell/RouteError.tsx',
  'components/app-shell/DashboardLoadingSkeleton.tsx',
] as const;

for (const path of filesThatMustStayWalletFree) {
  assert.doesNotMatch(read(path), forbiddenImportPattern, `${path} must stay wallet-free`);
}

const sharedError = read('components/app-shell/RouteError.tsx');
assert.doesNotMatch(sharedError, /error\.message/, 'shared route error must not render error.message');
assert.doesNotMatch(sharedError, /error\.stack/, 'shared route error must not render error.stack');

assert.match(sharedError, /onClick=\{reset\}/, 'Try again must call the route reset prop');

const html = renderToStaticMarkup(
  createElement(RouteError, {
    error: Object.assign(new Error('boom'), { digest: 'brief92-test' }),
    reset: () => {},
    backHref: '/dashboard',
    backLabel: 'Back to dashboard',
  })
);
assert.match(html, />Try again</, 'shared route error should render Try again button');
assert.match(html, /href="\/dashboard"/);
assert.match(html, /Back to dashboard/);
assert.match(html, /brief92-test/);
assert.doesNotMatch(html, /boom/, 'rendered route error must not echo error.message');

console.log('brief92-boundaries.test.ts ok');
